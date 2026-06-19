// reddit.js — Reddit lead scraper using old.reddit.com (Mac only, residential IP)
//
// Reddit's JSON API returns 403 from all IPs, and www.reddit.com is a React SPA
// that defeats headless scraping. old.reddit.com is server-rendered plain HTML
// and works reliably with Playwright.
//
// Usage:
//   node index.js --platform=reddit                   # all target subreddits
//   node index.js --platform=reddit --subreddit=SaaS  # single subreddit
//   node index.js --platform=reddit --dry_run         # preview, no ingest

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { postToN8n } from "./lib/poster.js";
import { humanDelay } from "./lib/delays.js";
import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

chromium.use(StealthPlugin());
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Subreddits + search queries from Markexis ICP targeting (CLAUDE.md)
const DEFAULT_TARGETS = [
  { sub: "SaaS",         query: "gtm OR latam OR \"go-to-market\" OR \"ai marketing\"" },
  { sub: "startups",     query: "latam OR gtm OR \"marketing strategy\" OR \"series a\"" },
  { sub: "entrepreneur", query: "\"latin america\" OR latam OR \"growth strategy\"" },
  { sub: "b2bmarketing", query: "latam OR \"ai implementation\" OR \"gtm strategy\"" },
  { sub: "marketing",    query: "\"latam expansion\" OR \"ai marketing\" OR \"b2b growth\"" },
];

const CAP_PER_SUB = 10;

function extractDomain(text = "") {
  const m = text.match(/https?:\/\/([^\s<>"'()]+)/);
  if (!m) return null;
  const d = m[1].replace(/^www\./, "").split("/")[0].toLowerCase();
  const skip = ["reddit.com", "redd.it", "github.com", "twitter.com", "x.com",
                "linkedin.com", "youtube.com", "youtu.be", "medium.com",
                "instagram.com", "imgur.com"];
  return skip.some(s => d.endsWith(s)) ? null : d;
}

export async function run({ subreddit, limit = 25, dry_run } = {}) {
  const targets = subreddit
    ? [{ sub: subreddit, query: DEFAULT_TARGETS.find(t => t.sub === subreddit)?.query || "gtm latam marketing" }]
    : DEFAULT_TARGETS;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });

  const seen = new Set();
  let ingested = 0;
  let skipped = 0;

  try {
    for (const target of targets) {
      if (ingested >= parseInt(limit)) break;

      const url = `https://old.reddit.com/r/${target.sub}/search?q=${encodeURIComponent(target.query)}&restrict_sr=1&sort=new&t=year`;
      console.log(`\n→ r/${target.sub}`);

      const page = await context.newPage();
      let results = [];
      try {
        const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (resp.status() !== 200) {
          console.warn(`  [skip] HTTP ${resp.status()}`);
          await page.close();
          await humanDelay(3000, 5000);
          continue;
        }
        await humanDelay(1500, 3000);

        // old.reddit.com renders search results as .search-result-link with a.author
        results = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll(".search-result-link, .thing"));
          const out = [];
          for (const item of items) {
            const authorEl = item.querySelector("a.author");
            const titleEl = item.querySelector("a.search-title, a.title");
            const linkEl = item.querySelector("a.search-title, a.title");
            if (authorEl) {
              out.push({
                author: authorEl.textContent.trim(),
                title: (titleEl?.textContent || "").trim(),
                postUrl: linkEl?.href || "",
              });
            }
          }
          return out;
        });
        console.log(`  Found ${results.length} posts`);
      } catch (e) {
        console.warn(`  [error] r/${target.sub}: ${e.message?.slice(0, 70)}`);
        await page.close();
        await humanDelay(3000, 5000);
        continue;
      }
      await page.close();

      for (const r of results.slice(0, CAP_PER_SUB)) {
        if (ingested >= parseInt(limit)) break;
        const author = r.author;
        if (!author || author === "[deleted]" || author === "AutoModerator" || seen.has(author)) continue;
        seen.add(author);

        // Visit user profile for a real sidebar bio + linked website (best effort)
        // Reddit profiles rarely have useful bios — the POST is the real ICP signal,
        // so we always lead with the post title and append a clean bio only if found.
        let bio = "";
        let domain = null;
        try {
          await humanDelay(1500, 3500);
          const profilePage = await context.newPage();
          const presp = await profilePage.goto(`https://old.reddit.com/user/${author}/`, {
            waitUntil: "domcontentloaded", timeout: 20000
          });
          if (presp.status() === 200) {
            const raw = await profilePage.evaluate(() => {
              // The titlebox/sidebar description is the actual profile "bio"
              const desc = document.querySelector(".titlebox .md, .profile-description");
              return desc ? desc.textContent.trim().slice(0, 400) : "";
            });
            // Reject Reddit's age-gate interstitial and other non-bio noise
            if (raw && !/must be (at least )?(18|eighteen)/i.test(raw)) {
              bio = raw;
            }
            domain = extractDomain(bio);
          }
          await profilePage.close();
        } catch { /* profile optional */ }

        // Post content is the primary signal; profile bio is supplementary
        const rawBio = `r/${target.sub} post: "${r.title.slice(0, 200)}"`
          + (bio ? ` | Profile: ${bio}` : "");

        const lead = {
          name: author,
          email: null,
          company: domain || author,
          domain,
          title: null,
          location: null,
          source_platform: "reddit",
          source_url: `https://www.reddit.com/user/${author}`,
          raw_bio: rawBio,
          company_size_signal: "unknown",
          scraped_at: new Date().toISOString(),
        };

        if (dry_run) {
          console.log(`  [dry-run] ${author} | domain: ${domain || "none"} | "${r.title.slice(0, 50)}"`);
          ingested++;
          continue;
        }

        try {
          const result = await postToN8n(lead);
          console.log(`  ✓ ${author} | ${result?.summary?.icp_score || "?"} | "${r.title.slice(0, 40)}"`);
          ingested++;
        } catch (e) {
          console.warn(`  ✗ ${author}: ${e.message?.slice(0, 60)}`);
          skipped++;
        }
      }

      await humanDelay(3000, 6000); // pause between subreddits
    }
  } finally {
    await browser.close();
  }

  console.log(`\nDone: ${ingested} leads ${dry_run ? "previewed" : "ingested"}, ${skipped} failed`);
}
