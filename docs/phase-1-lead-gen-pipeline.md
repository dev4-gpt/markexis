# Phase 1: Lead Generation Pipeline

## What Was Built

A complete B2B lead generation machine with 5 components:

1. **Unified ingestion webhook** — one endpoint accepts leads from all 12 platform scrapers
2. **Enrichment** — Firecrawl scrapes the company website to get context the scraper didn't surface
3. **ICP scoring** — Groq (free LLM) classifies each lead as PERFECT / GOOD / NO_MATCH with signals
4. **Multi-source scrapers** — GitHub, HackerNews, Google Places (VPS); LinkedIn, G2 etc. (Mac)
5. **Email outreach** — 3 personalised tracks × 3 follow-ups; Day 1 / 5 / 12 cadence

## The Unified Lead Schema

Every scraper — regardless of platform — outputs this exact shape before POSTing to `/webhook/lead-ingest`:

```json
{
  "name": "string",
  "email": "string | null",
  "company": "string",
  "domain": "string | null",
  "title": "string | null",
  "location": "string | null",
  "source_platform": "linkedin|instagram|google_maps|reddit|github|producthunt|yelp|twitter|g2|wellfound|facebook|hackernews",
  "source_url": "string",
  "raw_bio": "string",
  "company_size_signal": "1-10|11-50|51-200|201+|unknown",
  "scraped_at": "ISO8601 timestamp"
}
```

**Why a unified schema matters:** each scraper only needs to know how to get data from its platform and map it to this shape. The ingest pipeline doesn't care where the lead came from — it enriches and scores every lead identically.

## ICP Scoring

The Groq classifier (`llama-3.1-8b-instant`) receives the normalised lead data + Firecrawl-enriched company description and returns:

```json
{
  "icp_score": "PERFECT | GOOD | NO_MATCH",
  "numeric_score": 1-10,
  "reasoning": "One sentence",
  "latam_signal": true | false,
  "ai_signal": true | false,
  "growth_signal": true | false,
  "priority_action": "email_track_latam | email_track_ai | email_track_growth | skip",
  "personalization_hook": "One specific detail to open the email with"
}
```

**Tested examples:**
- Pizzeria → `NO_MATCH / 2` — local business, no B2B component
- FinTech CMO mentioning LatAm → `PERFECT / 9` with generated personalization_hook

## Email Outreach

### Track Assignment (latam > ai > growth)

```javascript
function pickTrack(lead) {
  if (lead.latam_signal) return "latam";
  if (lead.ai_signal) return "ai";
  return "growth";
}
```

LatAm is Markexis's strongest differentiator, so it takes priority.

### Cadence

```
Day 1  → outreach.js sends Email 1  → outreach_status: "email_1_sent"
Day 5  → followup.js sends Email 2  → outreach_status: "email_2_sent"
Day 12 → followup.js sends Email 3  → outreach_status: "email_3_sent"
```

### SMTP Architecture Note

**DigitalOcean blocks outbound SMTP ports 25, 465, and 587 on all Droplets.** Email cannot send from the VPS. The solution: `outreach.js` and `followup.js` run on the Mac where Gmail SMTP on port 465 works fine. If you need always-on sending (i.e., you're not running the Mac 24/7), the alternative is an HTTP-based email API (Brevo, Resend, etc.) called from n8n via port 443.

## Platform Scrapers

### On VPS (n8n Code nodes, no auth needed)

| Scraper | Source | Lead Type | File |
|---------|--------|-----------|------|
| GitHub | B2B SaaS founders | User-type repo owners, `topic:saas stars:80..1500` | `github-scraper.json` |
| HackerNews | High-intent posters | Ask HN / Show HN matching GTM/LatAm/AI keywords | `hackernews-scraper.json` |
| Google Places | LatAm businesses | B2B companies in MX/BR/CO/AR/CL cities | `google-places-scraper.json` |

### On Mac (Crawlee + Playwright, residential IP required)

| Scraper | Auth Required | Anti-Detection Rules |
|---------|--------------|---------------------|
| LinkedIn | Yes | Playwright stealth, 80 views/day max, business hours only |
| Instagram | Yes | Same rules |
| Twitter/X | No (but rate-limited) | Playwright, no official API for DMs |
| G2, Clutch | No | Public pages, Crawlee default browser |
| Wellfound | Yes | Playwright stealth |

**Why Mac for these:** LinkedIn and Instagram detect VPS/datacenter IPs and immediately block scraping. Residential IPs (home/Mac) are required. Cookies from a logged-in session must be saved and reused — never log in fresh each time.

## Supabase Schema (key tables)

```sql
-- Primary storage
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, email text, company text, domain text,
  title text, location text, source_platform text, source_url text,
  raw_bio text, company_size_signal text,
  icp_score text,           -- 'PERFECT' | 'GOOD' | 'NO_MATCH'
  numeric_score int,
  icp_reasoning text, enriched_description text,
  latam_signal boolean, ai_signal boolean, growth_signal boolean,
  personalization_hook text,
  outreach_status text DEFAULT 'pending',
  scraped_at timestamptz, created_at timestamptz DEFAULT now(),
  UNIQUE(email), UNIQUE(domain)
);

-- Outreach tracking
CREATE TABLE outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  platform text, message_type text,   -- e.g. "email_1_latam"
  sent_at timestamptz, status text, reply_received boolean DEFAULT false
);
```

## What's Done vs Pending

### Done
- **LinkedIn scraper** — `scrapers/linkedin.js` built with Crawlee + playwright-extra stealth, cookie persistence via `scrapers/browsers/`
- **RLS** — enabled on all 6 tables (`leads`, `outreach_log`, `content_pipeline`, `keywords`, `competitor_articles`, `knowledge_base`) with permissive anon policies so n8n ANON key can read/write. Migration applied 2026-06-18.
- **outreach.js + followup.js** — Gmail SMTP via nodemailer, 3-track templates in `lib/templates.js`, dry-run mode, per-day limits

### Still Pending
- **Reddit scraper** — Reddit API approval pending (`REDDIT_CLIENT_ID=SKIP_PENDING_APPROVAL` in env)
- **ProductHunt scraper** — GraphQL API key not yet applied for
- **LinkedIn DM routing** — leads without email should route to a LinkedIn DM queue; not built yet (Phase 6)
- **Email volume** — 0 sent to date; first batch pending manual `node outreach.js --limit=5` trigger
