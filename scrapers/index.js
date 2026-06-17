#!/usr/bin/env node
// CLI dispatcher for Markexis platform scrapers.
//   node index.js --platform=g2 --query="marketing automation"
//   node index.js --platform=linkedin --query="VP Marketing LatAm"
//   node index.js --selftest          # validate lib wiring without scraping
import "dotenv/config";
import { validateAndNormalize } from "./lib/schema.js";
import { postToN8n } from "./lib/poster.js";

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  }
  return args;
}

// Platform scrapers land here as they're built (Phase 1).
const SCRAPERS = {
  // g2: () => import("./g2.js"),
  // linkedin: () => import("./linkedin.js"),
};

async function selftest() {
  const sample = {
    name: "Jane Doe",
    company: "Acme SaaS",
    title: "VP Marketing",
    email: "jane@acmesaas.com",
    source_platform: "g2",
    source_url: "https://www.g2.com/products/acme",
    raw_bio: "Leading GTM for a B2B SaaS expanding into LatAm.",
    company_size_signal: "51-200",
  };
  const normalized = validateAndNormalize(sample);
  console.log("[selftest] normalized lead:\n", normalized);
  if (process.env.SELFTEST_POST === "1") {
    console.log("[selftest] posting to", process.env.N8N_WEBHOOK_URL || "(default webhook)");
    console.log(await postToN8n(sample));
  } else {
    console.log("[selftest] set SELFTEST_POST=1 to also POST this sample to n8n.");
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.selftest) return selftest();

  const platform = args.platform;
  if (!platform || !SCRAPERS[platform]) {
    console.log(`Usage: node index.js --platform=<${Object.keys(SCRAPERS).join("|") || "none built yet"}> --query="..."`);
    console.log("       node index.js --selftest");
    if (platform) console.error(`\nNo scraper for "${platform}" yet — add scrapers/${platform}.js and register it in SCRAPERS.`);
    process.exit(platform ? 1 : 0);
  }
  const mod = await SCRAPERS[platform]();
  await mod.run(args);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
