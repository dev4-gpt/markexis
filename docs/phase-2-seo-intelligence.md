# Phase 2: SEO Intelligence

## What Was Built

Four n8n workflows that replace DataForSEO and a full-time SEO analyst:

1. **Keyword research** — expands seed terms into clusters using Google Suggest + Groq analysis → Supabase
2. **Rank tracker** — pulls live SERP positions from SerpBear every 6 hours → Supabase
3. **Trend monitor** — detects rising keywords daily via Google Trends → flags priority targets
4. **Site audit** — PageSpeed Insights (desktop + mobile) on a schedule → stores health scores

All workflows run on the VPS (n8n), no external paid API required.

## Workflows

### keyword-research.json (`keywordresearch1`)

**Trigger:** `POST /webhook/seo/keyword-research`

**Flow:**
1. Receives a `{ seeds: ["keyword 1", "keyword 2"] }` body
2. Calls the Google Suggest autocomplete endpoint for each seed (free, no key)
3. Sends all suggestions to Groq (`llama-3.1-8b-instant`) to classify each into a pillar and score it for commercial intent
4. Upserts to the `keywords` table in Supabase

**Example call:**
```bash
curl -X POST http://67.207.89.85:5678/webhook/seo/keyword-research \
  -H "Content-Type: application/json" \
  -d '{"seeds":["latam market entry","b2b gtm strategy","ai marketing implementation"]}'
```

**Priority scoring logic (Groq assigns):**
- Score 10: high commercial intent + matches Markexis service line directly
- Score 7–9: related, good volume signal
- Score 1–6: informational, low commercial intent

**Cluster assignment:**
- `latam` — market entry, country-specific, expansion terms
- `ai` — AI marketing, automation, implementation terms
- `gtm` — revenue growth, go-to-market, pipeline terms
- `competitor` — competitor brand/domain keywords

---

### rank-tracker.json (`ranktrackerv001`)

**Trigger:** Schedule (every 6 hours)

**Flow:**
1. Queries the SerpBear API at `http://67.207.89.85:3000/api/keywords?domain=markexis.com`
2. For each keyword returned, updates `current_position` and saves previous as `previous_position`
3. Upserts to `keywords` table

**SerpBear setup:** self-hosted on the VPS at port 3000. Add keywords via the SerpBear UI at `http://67.207.89.85:3000`. SerpBear auto-refreshes SERP positions using rotating Google search queries — no paid API needed.

**What to watch in Supabase:**
```sql
-- Keywords improving (position dropped = moved up in results)
SELECT keyword, previous_position, current_position,
  (previous_position - current_position) AS improvement
FROM keywords
WHERE current_position IS NOT NULL
ORDER BY improvement DESC LIMIT 20;
```

---

### trend-monitor.json (`trendmonitor001`)

**Trigger:** Schedule (daily 8am UTC)

**Flow:**
1. Calls a Google Trends endpoint for the Markexis keyword clusters
2. Groq evaluates which terms are trending up vs flat
3. Sets `priority_score = 10` on trending keywords in Supabase so `content-director` picks them up first

**Why this matters:** content written about a trending keyword gets indexed while search volume is rising — compound timing advantage vs publishing after the peak.

---

### site-audit.json (`siteauditv0001`)

**Trigger:** Schedule (Monday 9am UTC)

**Flow:**
1. Calls Google PageSpeed Insights API (free) for `https://markexis.com` — desktop and mobile
2. Extracts Core Web Vitals: LCP, FID/INP, CLS, performance score
3. Stores in `content_pipeline` with `status = 'audit'` and `pillar = 'seo'`

**No SerpBear dependency** — PageSpeed is a separate Google API, requires `GOOGLE_PLACES_API_KEY` (same key works for PageSpeed Insights if Places + PageSpeed Insights are both enabled on the GCP project).

## Supabase Schema

```sql
CREATE TABLE keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text UNIQUE,
  volume int,           -- search volume estimate (from Google Ads Keyword Planner if available)
  kd int,               -- keyword difficulty 0-100
  cpc numeric,          -- cost-per-click
  priority_score int,   -- 1-10, set by trend-monitor
  pillar text,          -- 'latam' | 'ai' | 'gtm' | 'competitor'
  cluster text,         -- sub-group within pillar
  current_position int,
  previous_position int,
  last_checked timestamptz,
  created_at timestamptz DEFAULT now()
);
```

## What's Done vs Pending

### Done
- All 4 workflows deployed and active on VPS
- SerpBear deployed at `http://67.207.89.85:3000`
- Keyword seed runs tested — clusters populate correctly in Supabase

### Still Pending
- **Add markexis.com keywords to SerpBear** — do this once via the UI; tracker will then run automatically
- **Google Ads Keyword Planner API** — free with any Google Ads account, gives real volume + KD data; `volume` and `kd` columns empty until this is wired up
- **WordPress publishing** — site-audit findings are stored but not yet auto-converted to an SEO report post
