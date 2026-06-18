# Phase 4: Competitor Intelligence

## What Was Built

Three n8n workflows that monitor 8 competitor domains daily and automatically score new content for threat level:

1. **Sitemap crawler** — daily sweep of competitor sitemaps, detects new URLs
2. **Content extractor** — Firecrawl scrapes each new URL, extracts metadata
3. **Threat assessor** — Groq scores each article for keyword overlap and strategic threat to Markexis

The pipeline is fully automatic once deployed: sitemap-crawler fans out to extractor, extractor fans out to assessor. No manual steps.

## Competitor Domains Monitored

```
demandcurve.com       — high-quality GTM content
cxl.com               — content/SEO competitor
openviewpartners.com  — PLG/SaaS GTM thought leadership
gotomarket.io         — direct GTM competitor
revenuearchitects.com — revenue growth consulting
growthcollective.com  — growth consulting marketplace
pavilion.com          — GTM community / content
klique.io             — B2B GTM tools
```

Add or remove domains by editing the `COMPETITOR_DOMAINS` array in `sitemap-crawler.json`.

## Workflows

### sitemap-crawler.json (`sitemapcrwlr001`)

**Trigger:** Schedule (daily 7am UTC)

**Flow:**
1. For each of the 8 competitor domains, fetches `https://{domain}/sitemap.xml` (tries `sitemap_index.xml` as fallback)
2. Parses `<loc>` tags with regex to extract all URLs
3. Batch-checks Supabase `competitor_articles` for which URLs already exist (avoids re-processing)
4. POSTs new URLs to `/webhook/competitor/extract` (fire-and-forget, `Promise.allSettled`)
5. Caps at 50 new URLs per domain per run to stay within Firecrawl's 1,000 req/month free limit

**Smoke test guard:** sending `{ "_smoke_test": true }` returns immediately without fetching any sitemaps.

---

### content-extractor.json (`contentextract1`)

**Trigger:** `POST /webhook/competitor/extract`

**Input:**
```json
{ "url": "https://demandcurve.com/blog/gtm-strategy", "competitor_domain": "demandcurve.com" }
```

**Flow:**
1. Firecrawl scrapes the URL (`onlyMainContent: true`, markdown format)
2. Extracts:
   - **title** — from first `# Heading` line
   - **meta_description** — first substantive paragraph (not a heading, > 50 chars)
   - **word_count** — from clean text after stripping markdown
3. Upserts to `competitor_articles` (conflict on `url` column — safe to re-call)
4. Asynchronously POSTs to `/webhook/competitor/assess-threat` (non-blocking)

**Why Firecrawl here:** competitor sites often have JS-rendered content. Firecrawl handles this, whereas a plain HTTP fetch would miss most of the content.

---

### threat-assessor.json (`threatassess01`)

**Trigger:** `POST /webhook/competitor/assess-threat`

**Two modes:**

**Single article mode** (called by extractor):
```json
{ "url": "https://demandcurve.com/blog/gtm-strategy", "title": "...", "content": "..." }
```

**Batch mode** (manually triggered to score all unscored articles):
```json
{ "batch": true }
```
In batch mode, the workflow queries Supabase for all rows where `threat_score IS NULL`, then scores them in sequence.

**Groq prompt returns:**
```json
{
  "threat_score": "HIGH" | "MEDIUM" | "LOW",
  "keyword_overlap": ["b2b gtm strategy", "latam market entry"],
  "reasoning": "One sentence explaining the score"
}
```

**Scoring criteria:**
- `HIGH` — article targets keywords Markexis is actively trying to rank for AND is from an authoritative domain (DA > 40)
- `MEDIUM` — overlapping keywords but weaker domain or only partial overlap
- `LOW` — tangentially related, unlikely to compete directly

The response uses `response_format: { type: 'json_object' }` to guarantee parseable JSON from Groq.

## Supabase Schema

```sql
CREATE TABLE competitor_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_domain text,
  url text UNIQUE,
  title text,
  word_count int,
  meta_description text,
  detected_at timestamptz,
  keyword_overlap text[],     -- array of overlapping target keywords
  threat_score text,          -- 'HIGH' | 'MEDIUM' | 'LOW' | NULL (unscored)
  reasoning text,
  created_at timestamptz DEFAULT now()
);
```

## Useful Queries

```sql
-- New HIGH-threat articles this week
SELECT competitor_domain, title, keyword_overlap, detected_at
FROM competitor_articles
WHERE threat_score = 'HIGH'
  AND detected_at > now() - interval '7 days'
ORDER BY detected_at DESC;

-- Coverage by domain
SELECT competitor_domain, threat_score, count(*)
FROM competitor_articles
GROUP BY 1, 2
ORDER BY 1, 2;

-- Articles not yet scored (run batch assessor if this grows)
SELECT count(*) FROM competitor_articles WHERE threat_score IS NULL;
```

## Response to HIGH-Threat Articles

When a HIGH-threat article is detected, typical responses:
1. **Outrank it** — trigger `run-pipeline.sh` with the overlapping keyword → publish a better article
2. **Monitor** — check their word count and update depth. If under 1,000 words and you can write 2,000+, outranking is realistic
3. **Ignore** — if the competitor domain has DA > 70 (e.g., Sequoia, a16z), the keyword isn't winnable; note it and move on

## What's Done vs Pending

### Done
- All 3 workflows deployed and active
- Daily schedule running at 7am UTC
- Threat assessor tested with single-article and batch modes
- Groq JSON response format enforced (no parse errors)

### Still Pending
- **Slack/email notification on HIGH threat** — currently stored silently in Supabase; a simple n8n IF node checking `threat_score = 'HIGH'` → Gmail notify would close this
- **DA (Domain Authority) scoring** — threat_score currently ignores domain authority; integrating Moz or Ahrefs free API would improve signal quality
- **More competitor domains** — 8 domains monitored; CLAUDE.md lists additional candidates to add
