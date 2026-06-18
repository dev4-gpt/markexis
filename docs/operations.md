# Operations Runbook

Everything you need to operate, test, and debug the Markexis AI CMO Platform day-to-day.

> **Infrastructure:** n8n at `67.207.89.85:5678` · Supabase `rslhqtgazcavoimlzxnf` · Mac for outreach + LinkedIn scraping

---

## What Runs Automatically

These workflows run on schedule without any manual action:

| Schedule | Workflow | What it does |
|----------|----------|-------------|
| Every 6h | `hackernews-scraper` | Scrapes Ask HN / Show HN for founders, ingests → scores → Supabase |
| Every 6h | `rank-tracker` | Pulls SerpBear keyword positions → Supabase keywords table |
| Daily 7am UTC | `sitemap-crawler` | Fetches 8 competitor sitemaps → sends new articles to content-extractor |
| Daily 8am UTC | `trend-monitor` | Google Trends → flags rising keywords with priority_score=10 |
| Monday 9am UTC | `site-audit` | PageSpeed Insights (desktop + mobile) for markexis.com → content_pipeline |

**All other workflows are triggered manually** (webhooks or scraper CLI commands on Mac).

---

## Health Check

Run this before doing any manual work to confirm everything is live:

```bash
bash scripts/smoke-test.sh
# Expected: 14 passed, 0 failed
```

If any webhook returns 404 or 000, see [Troubleshooting](#troubleshooting) below.

---

## Lead Generation

### Trigger VPS scrapers manually

```bash
# GitHub — founders of B2B SaaS repos (stars 80–1500)
curl -X POST http://67.207.89.85:5678/webhook/scrape/github

# HackerNews — runs automatically every 6h, but can trigger manually
curl -X POST http://67.207.89.85:5678/webhook/scrape/hackernews

# Google Places — LatAm businesses (runs default 7 preset city+type queries)
curl -X POST http://67.207.89.85:5678/webhook/scrape/google-places

# Google Places — custom search
curl -X POST http://67.207.89.85:5678/webhook/scrape/google-places \
  -H "Content-Type: application/json" \
  -d '{"city": "Mexico City", "query": "fintech startup"}'
```

Each scraper normalises leads to the unified schema → posts to `/webhook/lead-ingest` → Firecrawl enrichment → Groq ICP scoring → Supabase upsert (dedup on `domain`).

### LinkedIn scraper (Mac only — residential IP required)

```bash
cd scrapers

# First-time auth: opens browser, log in manually, saves session cookies
node linkedin.js --login

# Run a search (uses saved cookies — no re-login)
node index.js --platform=linkedin --query="VP Marketing SaaS LatAm"

# Rules: max 80 profiles/day, business hours only (9am–6pm local), human delays
```

### Ingest a lead manually

```bash
curl -X POST http://67.207.89.85:5678/webhook/lead-ingest \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@acmesaas.com",
    "company": "Acme SaaS",
    "domain": "acmesaas.com",
    "title": "VP Marketing",
    "location": "Austin TX",
    "source_platform": "linkedin",
    "source_url": "https://linkedin.com/in/janesmith",
    "raw_bio": "VP Marketing at B2B SaaS startup focused on LatAm expansion",
    "company_size_signal": "51-200",
    "scraped_at": "2026-06-19T00:00:00Z"
  }'
```

---

## Cold Email Outreach

Email sends **from Mac only** — DigitalOcean blocks SMTP ports 25/465/587 on the VPS.

```bash
cd scrapers

# Preview who would receive Email 1 — no sends
node outreach.js --dry-run

# Send a test email to yourself (Track C - Growth format)
node outreach.js --test=your@email.com

# Send Email 1 to 5 leads (safe daily limit test)
node outreach.js --limit=5

# Live send — cap is 50/day
node outreach.js

# Preview Day 5 / Day 12 follow-ups
node followup.js --dry-run

# Send follow-ups to up to 10 leads
node followup.js --limit=10
```

**Email tracks:**
- **Track A (LatAm):** `latam_signal = true` — used when LatAm is detected (highest priority)
- **Track B (AI):** `ai_signal = true AND latam_signal = false`
- **Track C (Growth):** default for all PERFECT leads

**Outreach status flow in Supabase:**
`pending` → `email_1_sent` → `email_2_sent` → `email_3_sent`

---

## Content Production

### Full pipeline — one keyword → everything

```bash
# Fastest way — runs article + social + image + newsletter + RAG ingest (~13s)
bash scripts/run-pipeline.sh "latam market entry strategy" latam

# Other examples
bash scripts/run-pipeline.sh "ai marketing implementation" ai
bash scripts/run-pipeline.sh "b2b gtm strategy" gtm --skip-seo
```

### Individual content endpoints

```bash
# Write an article only (30–60s — Groq 70b outline then full article)
curl -X POST http://67.207.89.85:5678/webhook/content/write-article \
  -H "Content-Type: application/json" \
  -d '{"keyword":"latam market entry strategy","pillar":"latam","word_count":1500}'

# Generate social posts from an existing article
curl -X POST http://67.207.89.85:5678/webhook/content/social-posts \
  -H "Content-Type: application/json" \
  -d '{"keyword":"latam market entry","title":"How to Enter LatAm","article":"<HTML>"}'

# Generate a featured image (returns base64 JPEG)
curl -X POST http://67.207.89.85:5678/webhook/content/generate-image \
  -H "Content-Type: application/json" \
  -d '{"keyword":"latam market entry","title":"How to Enter LatAm","style":"featured"}'
  # style: "featured" (1200x628) or "thumbnail" (YouTube 1280x720)

# Full content director — article + social + image + newsletter in one call
curl -X POST http://67.207.89.85:5678/webhook/content/produce \
  -H "Content-Type: application/json" \
  -d '{"keyword":"b2b gtm strategy","pillar":"gtm","word_count":1500}'
```

### Article review and publish

1. Open Supabase → `content_pipeline` table
2. Find rows with `status = 'review'`
3. Read `article_draft` (HTML), `linkedin_post`, `twitter_thread`
4. Edit as needed, set `status = 'published'`
5. To publish to WordPress: set `WORDPRESS_URL`, `WORDPRESS_USER`, `WORDPRESS_APP_PASSWORD` in VPS env, then re-trigger article-writer with the keyword

---

## SEO & Keyword Research

```bash
# Expand keyword clusters from seed terms (Google Suggest → Groq → Supabase)
curl -X POST http://67.207.89.85:5678/webhook/seo/keyword-research \
  -H "Content-Type: application/json" \
  -d '{"seeds":["latam market entry","b2b gtm strategy","ai marketing implementation"]}'

# Check rank data (runs every 6h automatically — can also trigger via SerpBear UI)
# SerpBear UI: http://67.207.89.85:3000 (IP allowlisted in docker-port-firewall)
```

To add your IP to the SerpBear allowlist:
```bash
ssh -i ~/.ssh/id_new_droplet root@67.207.89.85 \
  "echo 'YOUR.IP.ADDRESS' >> /etc/docker-port-allowlist.v4 && systemctl restart docker-port-firewall"
```

---

## Competitor Intelligence

The `sitemap-crawler` runs daily at 7am UTC and automatically fans out to `content-extractor` → `threat-assessor` for any new articles. No manual action needed unless you want to force a run:

```bash
# Force-assess a specific competitor URL
curl -X POST http://67.207.89.85:5678/webhook/competitor/extract \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.demandcurve.com/blog/gtm-strategy","competitor_domain":"demandcurve.com"}'

# Batch-assess all unscored competitor articles
curl -X POST http://67.207.89.85:5678/webhook/competitor/assess-threat \
  -H "Content-Type: application/json" \
  -d '{"batch":true}'
```

Check HIGH-threat articles in Supabase → `competitor_articles` → filter `threat_score = 'HIGH'`.

---

## Knowledge Base (RAG)

### Ingest content

```bash
# Ingest a URL (Firecrawl scrapes → chunks → Jina AI embeddings → pgvector)
curl -X POST http://67.207.89.85:5678/webhook/ops/ingest-doc \
  -H "Content-Type: application/json" \
  -d '{"url":"https://markexis.com","source":"markexis_website","doc_type":"company_page"}'

# Ingest raw text (e.g. a deck summary, case study, or email template)
curl -X POST http://67.207.89.85:5678/webhook/ops/ingest-doc \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Markexis specializes in helping B2B SaaS companies enter the LatAm market...",
    "source": "markexis_about",
    "doc_type": "company_description"
  }'
```

### Search the knowledge base

```bash
# Search with Groq synthesis (recommended — returns an answer, not just chunks)
curl -X POST http://67.207.89.85:5678/webhook/ops/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query":"what markets does Markexis help companies enter?","synthesize":true}'

# Raw chunks only (no synthesis — faster, useful for debugging)
curl -X POST http://67.207.89.85:5678/webhook/ops/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query":"Markexis pricing","synthesize":false,"threshold":0.6}'
```

### Seed the RAG with Markexis content (run once)

```bash
for url in \
  "https://markexis.com" \
  "https://markexis.com/about" \
  "https://markexis.com/services"; do
  curl -s -X POST http://67.207.89.85:5678/webhook/ops/ingest-doc \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"$url\",\"source\":\"markexis_website\",\"doc_type\":\"company_page\"}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('chunks_stored','?'), 'chunks stored from', '$url')"
  sleep 2
done
```

---

## Deploying / Redeploying Workflows

### Full redeploy (fresh VPS or after bulk changes)

```bash
bash scripts/deploy.sh
# Deploys all 18 workflows, activates each, restarts n8n, runs smoke-test
```

### Single workflow update

```bash
FILE=n8n-workflows/pillar-2-content/article-writer.json
ID=articlewriterv1

scp -i ~/.ssh/id_new_droplet "$FILE" root@67.207.89.85:/tmp/$(basename "$FILE")
ssh -i ~/.ssh/id_new_droplet root@67.207.89.85 "
  docker cp /tmp/$(basename $FILE) n8n-n8n-1:/tmp/ &&
  docker exec n8n-n8n-1 n8n import:workflow --input=/tmp/$(basename $FILE) &&
  docker exec n8n-n8n-1 n8n update:workflow --id=$ID --active=true &&
  cd ~/n8n && docker compose restart n8n
"
```

> **Critical:** always run `update:workflow --id=X --active=true` AND restart n8n after import. Without both steps the webhook won't register. Importing alone sets `active: false`.

---

## Supabase — Key Queries

```sql
-- Leads overview
SELECT source_platform, icp_score, count(*) FROM leads GROUP BY 1,2 ORDER BY 3 DESC;

-- PERFECT leads ready to email
SELECT name, company, title, location, personalization_hook, priority_action
FROM leads WHERE icp_score = 'PERFECT' AND outreach_status = 'pending'
ORDER BY created_at DESC LIMIT 20;

-- Email queue status
SELECT outreach_status, count(*) FROM leads GROUP BY 1;

-- Content in review
SELECT keyword, topic, status, created_at FROM content_pipeline
WHERE status = 'review' ORDER BY created_at DESC;

-- HIGH threat competitor articles
SELECT competitor_domain, url, title, keyword_overlap, detected_at
FROM competitor_articles WHERE threat_score = 'HIGH'
ORDER BY detected_at DESC;

-- RAG knowledge base size
SELECT doc_type, count(*), avg(length(content)) avg_chunk_chars
FROM knowledge_base GROUP BY 1;
```

---

## Environment Variables

### VPS (`/root/n8n/docker-compose.yml`)

| Variable | Value | Purpose |
|----------|-------|---------|
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | `false` | REQUIRED — lets Code nodes read `$env.*` |
| `N8N_RUNNERS_ENABLED` | `true` | REQUIRED — Code node execution in n8n 2.x |
| `GROQ_API_KEY` | set | Primary LLM (14,400 req/day free) |
| `CEREBRAS_API_KEY` | set | LLM fallback 1 |
| `SAMBANOVA_API_KEY` | set | LLM fallback 2 (405B model) |
| `FIRECRAWL_API_KEY` | set | Company enrichment (1,000 req/mo free) |
| `SUPABASE_URL` | set | Database |
| `SUPABASE_ANON_KEY` | set | Database auth |
| `GOOGLE_PLACES_API_KEY` | set | Places API scraper |
| `GITHUB_TOKEN` | set | GitHub API scraper (5k req/hr) |
| `JINA_API_KEY` | set | Embeddings for RAG (1M tokens/mo free) |
| `CLOUDFLARE_ACCOUNT_ID` | set | Image generation |
| `CLOUDFLARE_API_TOKEN` | set | Cloudflare Flux API |
| `SERPBEAR_API_KEY` | `sbmkx2026a9f3e1d8c4b7` | Rank tracking (see `PHASE0_DEPLOYMENT.secrets.md`) |

After any env var change: `ssh root@67.207.89.85 "cd ~/n8n && docker compose down && docker compose up -d"`

### Mac scrapers (root `.env`)

```
SUPABASE_URL=https://rslhqtgazcavoimlzxnf.supabase.co
SUPABASE_ANON_KEY=...
GMAIL_USER=...@gmail.com
GMAIL_APP_PASSWORD=...          # Google Account → Security → App passwords
GMAIL_FROM_NAME=Aryaman from Markexis
N8N_WEBHOOK_URL=http://67.207.89.85:5678/webhook/lead-ingest
```

---

## Troubleshooting

### Webhook returns 404

```bash
# Check the workflow is active in n8n
ssh -i ~/.ssh/id_new_droplet root@67.207.89.85 \
  "docker exec n8n-n8n-1 n8n list:workflow 2>&1 | grep -E 'active|false'"

# Activate a specific workflow by ID
ssh -i ~/.ssh/id_new_droplet root@67.207.89.85 \
  "docker exec n8n-n8n-1 n8n update:workflow --id=WORKFLOW_ID --active=true"

# Then restart
ssh -i ~/.ssh/id_new_droplet root@67.207.89.85 "cd ~/n8n && docker compose restart n8n"
```

### n8n not responding (all webhooks fail)

```bash
ssh -i ~/.ssh/id_new_droplet root@67.207.89.85 "
  docker logs n8n-n8n-1 --tail=30
  cd ~/n8n && docker compose ps
"
# If container is stopped: docker compose up -d
```

### Workflow execution errors

Check the n8n execution log in the UI at `http://67.207.89.85:5678` → Executions. Or via SSH:
```bash
ssh -i ~/.ssh/id_new_droplet root@67.207.89.85 \
  "docker logs n8n-n8n-1 --tail=100 2>&1 | grep -i error"
```

### Groq rate limit (429)

All workflows have a Groq → Cerebras → Sambanova fallback chain. If Groq is saturated (14,400 req/day limit), Cerebras takes over automatically. Check usage at [console.groq.com](https://console.groq.com).

### Supabase insert failures

```bash
# Test connection from VPS
ssh -i ~/.ssh/id_new_droplet root@67.207.89.85 \
  "curl -s -o /dev/null -w '%{http_code}' 'https://rslhqtgazcavoimlzxnf.supabase.co/rest/v1/leads?limit=1' \
   -H 'apikey: SUPABASE_ANON_KEY'"
# Expected: 200 or 206
```

### Email not sending

- Confirm running from Mac (not VPS) — DO blocks SMTP
- Check Gmail App Password is still valid (Google Account → Security → App passwords)
- Test: `node scrapers/outreach.js --test=you@gmail.com`
- Confirm daily limit: Gmail SMTP cap is 500/day; `outreach.js` self-limits to 50

### SerpBear not updating keywords

```bash
# SerpBear is IP-allowlisted — add your current IP if needed
ssh -i ~/.ssh/id_new_droplet root@67.207.89.85 \
  "echo 'YOUR.IP' >> /etc/docker-port-allowlist.v4 && systemctl restart docker-port-firewall"

# Access UI at http://67.207.89.85:3000
# API key: sbmkx2026a9f3e1d8c4b7 (see PHASE0_DEPLOYMENT.secrets.md)
```

---

## Workflow IDs Reference

| ID | Workflow | Webhook path |
|----|----------|-------------|
| `leadpipeline0001` | Lead ingest + enrich + score | `POST /webhook/lead-ingest` |
| `githubscraper001` | GitHub founder scraper | `POST /webhook/scrape/github` |
| `hnscraper00001` | HackerNews scraper | `POST /webhook/scrape/hackernews` |
| `gplacesscraper1` | Google Places scraper | `POST /webhook/scrape/google-places` |
| `keywordresearch1` | Keyword research | `POST /webhook/seo/keyword-research` |
| `ranktrackerv001` | Rank tracker | Schedule (6h) |
| `trendmonitor001` | Trend monitor | Schedule (daily 8am) |
| `siteauditv0001` | Site audit | Schedule (Monday 9am) |
| `articlewriterv1` | Article writer | `POST /webhook/content/write-article` |
| `socialpostsv001` | Social posts | `POST /webhook/content/social-posts` |
| `imagegenv00001` | Image generator | `POST /webhook/content/generate-image` |
| `contentdirector1` | Content director | `POST /webhook/content/produce` |
| `sitemapcrwlr001` | Sitemap crawler | Schedule (daily 7am) |
| `contentextract1` | Content extractor | `POST /webhook/competitor/extract` |
| `threatassess01` | Threat assessor | `POST /webhook/competitor/assess-threat` |
| `docingesterv01` | Doc ingester | `POST /webhook/ops/ingest-doc` |
| `ragsearcherv01` | RAG searcher | `POST /webhook/ops/rag-search` |
| `pipelineorch01` | Pipeline orchestrator | `POST /webhook/ops/run-pipeline` |
