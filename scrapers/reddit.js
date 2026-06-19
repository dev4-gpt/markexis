// reddit.js — Reddit lead scraper using Playwright (Mac only, residential IP)
// Reddit blocked the .json API from all IPs. Playwright renders the real page.
//
// Usage:
//   node index.js --platform=reddit                   # all target subreddits
//   node index.js --platform=reddit --subreddit=SaaS  # single subreddit
//   node index.js --platform=reddit --dry_run         # preview, no ingest
//
// Anti-detection: stealth Playwright, random delays, no login required

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { postToN8n } from "./lib/poster.js";
import { humanDelay } from "./lib/delays.js";
import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

chromium.use(StealthPlugin());
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

// Subreddits + keyword search queries (from Markexis ICP — CLAUDE.md)
const DEFAULT_TARGETS = [
  { sub: "SaaS",         query: "gtm OR latam OR \"go-to-market\" OR \"ai marketing\"" },
  { sub: "startups",     query: "latam OR gtm OR \"marketing strategy\" OR \"series a\"" },
  { sub: "entrepreneur", query: "\"latin america\" OR \"latam\" OR \"growth strategy\"" },
  { sub: "b2bmarketing", query: "latam OR \"ai implementation\" OR \"gtm strategy\"" },
  { sub: "marketing",    query: "\"latam expansion\" OR \"ai marketing\" OR \"b2b growth\"" },
];

const CAP_PER_SUB = 10;

function extractDomain(text = "") {
  const m = text.match(/https?:\/\/([^\s<>"'()]+)/);
  if (!m) return null;
  const d = m[1].replace(/^www\./, "").split("/")[0].toLowerCase();
  const skip = ["reddit.com", "github.com", "twitter.com", "linkedin.com",
                "youtube.com", "medium.com", "instagram.com"];
  return skip.some(s => d.endsWith(s)) ? null : d;
}

export async function run({ subreddit, limit = 20, dry_run } = {}) {
  const targets = subreddit
    ? [{ sub: subreddit, query: DEFAULT_TARGETS.find(t => t.sub === subreddit)?.query || "gtm latam marketing" }]
    : DEFAULT_TARGETS;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const seen = new Set();
  let ingested = 0;
  let skipped = 0;

  try {
    for (const target of targets) {
      const searchUrl = `https://www.reddit.com/r/${target.sub}/search/?q=${encodeURIComponent(target.query)}&sort=new&restrict_sr=1`;
      console.log(`\n→ r/${target.sub}: ${searchUrl}`);

      const page = await context.newPage();
      try {
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await humanDelay(2000, 4000);

        // Extract post authors from search results
        const authors = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="/user/"]'));
          return [...new Set(
            links
              .map(a => {
                const m = a.href.match(/\/user\/([^/?#]+)/);
                return m ? m[1] : null;
              })
              .filter(u => u && u !== "AutoModerator" && !u.startsWith("deleted"))
          )].slice(0, 15);
        });

        console.log(`  Found ${authors.length} authors`);

        for (const author of authors.slice(0, CAP_PER_SUB)) {
          if (seen.has(author) || ingested >= parseInt(limit)) continue;
          seen.add(author);

          await humanDelay(1500, 3500);

          // Visit user profile for bio
          let bio = "";
          let domain = null;
          try {
            const profilePage = await context.newPage();
            await profilePage.goto(`https://www.reddit.com/user/${author}/`, {
              waitUntil: "domcontentloaded", timeout: 20000
            });
            await humanDelay(1000, 2000);

            bio = await profilePage.evaluate(() => {
              const el = document.querySelector('[data-testid="user-description"]')
                || document.querySelector(".userDescription")
                || document.querySelector('[class*="description"]');
              return el ? el.textContent.trim() : "";
            });
            domain = extractDomain(bio);
            await profilePage.close();
          } catch { /* profile optional */ }

          const lead = {
            name: author,
            email: null,
            company: domain || author,
            domain,
            title: null,
            location: null,
            source_platform: "reddit",
            source_url: `https://www.reddit.com/user/${author}`,
            raw_bio: bio || `Reddit user active in r/${target.sub} (searched: ${target.query})`,
            company_size_signal: "unknown",
            scraped_at: new Date().toISOString(),
          };

          if (dry_run) {
            console.log(`  [dry-run] ${author} | domain: ${domain || "none"} | bio: ${bio.slice(0, 60) || "(none)"}`);
            ingested++;
            continue;
          }

          try {
            const result = await postToN8n(lead);
            console.log(`  ✓ ${author} | ${result?.summary?.icp_score || "?"}`);
            ingested++;
          } catch (e) {
            console.warn(`  ✗ ${author}: ${e.message?.slice(0, 60)}`);
            skipped++;
          }
        }
      } catch (e) {
        console.warn(`  [error] r/${target.sub}: ${e.message?.slice(0, 80)}`);
      } finally {
        await page.close();
      }

      await humanDelay(3000, 6000); // pause between subreddits
    }
  } finally {
    await browser.close();
  }

  console.log(`\nDone: ${ingested} leads ${dry_run ? "previewed" : "ingested"}, ${skipped} failed`);
}
