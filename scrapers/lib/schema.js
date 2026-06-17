// Unified lead schema. Every platform scraper MUST output this exact shape
// before posting to /webhook/lead-ingest. Keep in lockstep with the Supabase
// `leads` table and the schema block in CLAUDE.md.

export const SOURCE_PLATFORMS = [
  "linkedin", "instagram", "google_maps", "reddit", "github",
  "producthunt", "yelp", "twitter", "g2", "wellfound",
  "facebook", "hackernews",
];

export const COMPANY_SIZE_SIGNALS = ["1-10", "11-50", "51-200", "201+", "unknown"];

const clean = (v) => (typeof v === "string" ? v.trim() : v);

/** Best-effort domain extraction from an email or a URL string. */
function deriveDomain(rawDomain, email) {
  if (rawDomain) {
    return String(rawDomain)
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase() || null;
  }
  if (email && email.includes("@")) {
    const d = email.split("@")[1]?.toLowerCase();
    // skip free inboxes — they aren't company domains
    const free = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "proton.me"];
    if (d && !free.includes(d)) return d;
  }
  return null;
}

/**
 * Validate + normalize a raw scraped lead into the unified schema.
 * Throws on hard-invalid input (no company AND no source_url, or bad platform).
 * Returns the normalized lead object ready to POST.
 */
export function validateAndNormalize(raw = {}) {
  const platform = clean(raw.source_platform);
  if (!SOURCE_PLATFORMS.includes(platform)) {
    throw new Error(`Invalid source_platform "${platform}". Expected one of: ${SOURCE_PLATFORMS.join(", ")}`);
  }

  const email = clean(raw.email)?.toLowerCase() || null;
  const company = clean(raw.company) || null;
  const sourceUrl = clean(raw.source_url) || null;

  if (!company && !sourceUrl) {
    throw new Error("Lead must have at least a company or a source_url to be useful.");
  }

  let sizeSignal = clean(raw.company_size_signal);
  if (!COMPANY_SIZE_SIGNALS.includes(sizeSignal)) sizeSignal = "unknown";

  return {
    name: clean(raw.name) || null,
    email,
    company,
    domain: deriveDomain(clean(raw.domain), email),
    title: clean(raw.title) || null,
    location: clean(raw.location) || null,
    source_platform: platform,
    source_url: sourceUrl,
    raw_bio: clean(raw.raw_bio) || null,
    company_size_signal: sizeSignal,
    scraped_at: raw.scraped_at || new Date().toISOString(),
  };
}
