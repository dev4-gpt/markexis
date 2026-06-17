#!/usr/bin/env node
// LinkedIn People Scraper — runs on Mac only (residential IP, stealth Playwright).
//
// First run — browser opens so you can log in manually:
//   node linkedin.js --login
//
// Subsequent runs — headless, uses saved session:
//   node linkedin.js
//   node linkedin.js --query="VP Marketing LatAm" --limit=20
//   node linkedin.js --dry-run
//
// Anti-detection rules enforced:
//   #3  random 3-12s delay between profile views
//   #4  max 80 profile views / session (--limit caps further)
//   #5  business hours only (9am-6pm local) — bypass with --any-hour
//   #8  puppeteer-extra stealth plugin always on

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { postToN8n } from "./lib/poster.js";
import { humanDelay, randomInt, isWithinBusinessHours } from "./lib/delays.js";

chromium.use(StealthPlugin());

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });
dotenv.config({ path: join(here, ".env") });

const COOKIES_DIR = join(here, "cookies");
const COOKIES_FILE = join(COOKIES_DIR, "linkedin.json");
const SESSION_CAP = 80; // rule #4: max profile views/day
const DEFAULT_LIMIT = 30;

// ICP-targeting search queries (CLAUDE.md)
const DEFAULT_QUERIES = [
  "VP Marketing Latin America",
  "CMO LatAm expansion SaaS",
  "Head of Growth SaaS international",
  "VP Marketing AI B2B SaaS",
  "Chief Marketing Officer AI implementation",
  "Head of Growth Series A",
  "CMO startup scaling growth",
  "Founder B2B go-to-market",
  "CEO CMO Mexico City SaaS",
  "VP Marketing Brazil fintech",
];

function parseArgs(argv) {
  const a = {};
  for (const x of argv.slice(2)) {
    const m = x.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) a[m[1]] = m[2] === undefined ? true : m[2];
  }
  return a;
}

function loadCookies() {
  if (!existsSync(COOKIES_FILE)) return null;
  try {
    return JSON.parse(readFileSync(COOKIES_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveCookies(cookies) {
  mkdirSync(COOKIES_DIR, { recursive: true });
  writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  console.log(`[linkedin] cookies saved → ${COOKIES_FILE}`);
}

/** Check whether the current page is the LinkedIn login wall. */
async function isLoggedOut(page) {
  const url = page.url();
  if (url.includes("/login") || url.includes("/checkpoint") || url.includes("/authwall")) return true;
  // LinkedIn sometimes shows the feed even when session expired — look for nav
  const hasNav = await page.$('nav[aria-label="Primary navigation"]').catch(() => null);
  return !hasNav;
}

/**
 * Build a LinkedIn people-search URL.
 * LinkedIn encodes spaces as %20 in these URLs; `encodeURIComponent` handles it.
 */
function searchUrl(query) {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}&origin=GLOBAL_SEARCH_HEADER`;
}

/**
 * Extract all visible profile cards from a search-results page.
 * Returns an array of raw objects; caller does the normalization.
 */
async function extractCards(page) {
  return page.evaluate(() => {
    const cards = [];
    // LinkedIn search results use a list of entity-result items
    const items = document.querySelectorAll(".entity-result__item");
    for (const item of items) {
      // Name is in an aria-hidden span inside the profile link
      const link = item.querySelector('a[href*="/in/"]');
      const nameEl = link?.querySelector("span[aria-hidden='true']");
      const name = nameEl?.innerText?.trim() || null;
      if (!name || name === "LinkedIn Member") continue; // skip locked profiles

      const profileUrl = link?.href?.split("?")[0] || null;

      // Headline combines title + company in LinkedIn's search UI
      const headlineEl = item.querySelector(".entity-result__primary-subtitle");
      const headline = headlineEl?.innerText?.trim() || null;

      // Location
      const locationEl = item.querySelector(
        ".entity-result__secondary-subtitle, .entity-result__tertiary-subtitle"
      );
      const location = locationEl?.innerText?.trim() || null;

      // Try to split "Title at Company" → { title, company }
      let title = headline;
      let company = null;
      if (headline) {
        const atIdx = headline.lastIndexOf(" at ");
        if (atIdx > 0) {
          title = headline.slice(0, atIdx).trim();
          company = headline.slice(atIdx + 4).trim();
        }
      }

      cards.push({ name, profileUrl, title, company, headline, location });
    }
    return cards;
  });
}

/** Scroll the page to trigger lazy-loading of all result cards. */
async function scrollToBottom(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let last = 0;
      const id = setInterval(() => {
        window.scrollBy(0, 400);
        if (document.body.scrollHeight === last) {
          clearInterval(id);
          resolve();
        }
        last = document.body.scrollHeight;
      }, 300);
    });
  });
  await page.waitForTimeout(800);
}

async function scrapeQuery(page, query, limit, isDryRun) {
  console.log(`\n[linkedin] searching: "${query}"`);
  const results = [];

  for (let pageNum = 1; results.length < limit; pageNum++) {
    const url = searchUrl(query) + (pageNum > 1 ? `&page=${pageNum}` : "");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for results list or "no results" indicator
    await page
      .waitForSelector(".reusable-search__entity-result-list, .search-no-results__container", {
        timeout: 12000,
      })
      .catch(() => null);

    if (await isLoggedOut(page)) {
      console.error("[linkedin] session expired mid-run. Run with --login to re-authenticate.");
      break;
    }

    await scrollToBottom(page);
    const cards = await extractCards(page);

    if (!cards.length) {
      console.log(`  page ${pageNum}: no results — stopping pagination`);
      break;
    }

    console.log(`  page ${pageNum}: ${cards.length} cards`);

    for (const c of cards) {
      if (results.length >= limit) break;

      const lead = {
        name: c.name,
        email: null,
        company: c.company || c.name,
        domain: null,
        title: c.title,
        location: c.location,
        source_platform: "linkedin",
        source_url: c.profileUrl || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`,
        raw_bio: c.headline || "",
        company_size_signal: "unknown",
      };

      if (isDryRun) {
        console.log(`  [dry] ${c.name} — ${c.title} @ ${c.company} (${c.location})`);
      } else {
        await postToN8n(lead);
      }

      results.push(lead);

      // Rule #3: random 3-12s delay between profile views
      await humanDelay(3000, 12000);
    }

    // LinkedIn caps search results at 10 pages
    if (pageNum >= 10) break;

    // Inter-page delay — slightly longer (8-20s)
    await humanDelay(8000, 20000);
  }

  return results;
}

export async function run(args = {}) {
  const isLogin = !!args.login;
  const isDryRun = !!args["dry-run"];
  const anyHour = !!args["any-hour"];
  const customQuery = args.query;
  const limit = Math.min(parseInt(args.limit || DEFAULT_LIMIT, 10), SESSION_CAP);
  const queries = customQuery ? [customQuery] : DEFAULT_QUERIES;

  if (!anyHour && !isWithinBusinessHours()) {
    console.error("[linkedin] outside business hours (9am-6pm). Use --any-hour to override.");
    process.exit(1);
  }

  if (isDryRun) console.log("[linkedin] DRY RUN — no leads will be posted.\n");

  const cookies = loadCookies();
  const needsLogin = isLogin || !cookies;
  const headless = !needsLogin;

  if (needsLogin && !isLogin) {
    console.error(
      "[linkedin] No saved session. Run once with --login to authenticate:\n" +
        "  node linkedin.js --login"
    );
    process.exit(1);
  }

  console.log(`[linkedin] launching ${headless ? "headless" : "visible"} browser…`);
  const browser = await chromium.launch({
    headless,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    slowMo: headless ? 0 : 50,
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
  });

  // Load saved cookies if available
  if (cookies) {
    await context.addCookies(cookies);
    console.log(`[linkedin] loaded ${cookies.length} saved cookies`);
  }

  const page = await context.newPage();

  try {
    if (needsLogin) {
      // Manual login flow
      console.log("\n[linkedin] Opening LinkedIn login page…");
      console.log("[linkedin] Please log in manually in the browser window.");
      console.log("[linkedin] After logging in, press ENTER here to save your session.\n");
      await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });

      // Wait for user to press ENTER
      await new Promise((resolve) => {
        process.stdin.setEncoding("utf8");
        process.stdout.write("Press ENTER after you have logged in…\n");
        process.stdin.once("data", resolve);
      });

      if (await isLoggedOut(page)) {
        console.error("[linkedin] Still not logged in. Try again.");
        await browser.close();
        process.exit(1);
      }

      // Save fresh cookies
      saveCookies(await context.cookies());
      console.log("[linkedin] Session saved. You can now run without --login.\n");
    } else {
      // Verify session is still valid
      await page.goto("https://www.linkedin.com/feed/", {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (await isLoggedOut(page)) {
        console.error("[linkedin] Saved session expired. Re-run with --login.");
        await browser.close();
        process.exit(1);
      }
      console.log("[linkedin] session valid ✓");
    }

    let totalScraped = 0;
    const perQuery = Math.ceil(limit / queries.length);

    for (const q of queries) {
      if (totalScraped >= limit) break;
      const remaining = limit - totalScraped;
      const results = await scrapeQuery(page, q, Math.min(perQuery, remaining), isDryRun);
      totalScraped += results.length;
      console.log(`[linkedin] query done — ${results.length} leads (total: ${totalScraped})`);

      // Save cookies after each query (session refresh)
      saveCookies(await context.cookies());

      // Inter-query pause: 30-90s
      if (totalScraped < limit) await humanDelay(30000, 90000);
    }

    console.log(`\n[linkedin] done — ${totalScraped} leads processed.`);
  } finally {
    // Always save cookies before closing
    try {
      saveCookies(await context.cookies());
    } catch {}
    await browser.close();
  }
}

// Allow direct invocation: node linkedin.js [flags]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(parseArgs(process.argv)).catch((e) => {
    console.error("[linkedin fatal]", e.message);
    process.exit(1);
  });
}
