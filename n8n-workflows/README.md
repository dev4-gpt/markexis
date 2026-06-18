# n8n Workflows

All 18 workflows run on the self-hosted n8n instance at `http://67.207.89.85:5678`.

---

## Deploying Workflows

### Deploy all at once (recommended)

```bash
# From project root:
bash scripts/deploy.sh
```

### Deploy a single workflow

```bash
# From project root:
FILE=n8n-workflows/pillar-0-lead-gen/lead-ingest-enrich-score.json
ID=leadpipeline0001

scp "$FILE" root@67.207.89.85:/tmp/$(basename "$FILE")
ssh root@67.207.89.85 "
  docker cp /tmp/$(basename $FILE) n8n-n8n-1:/tmp/ &&
  docker exec n8n-n8n-1 n8n import:workflow --input=/tmp/$(basename $FILE) &&
  docker exec n8n-n8n-1 n8n update:workflow --id=$ID --active=true
"
# Restart n8n once after all imports to register webhooks:
ssh root@67.207.89.85 "cd ~/n8n && docker compose restart n8n"
```

**Notes:**
- JSON files **must have a top-level `"id"` field** — n8n import fails without it (`SQLITE_CONSTRAINT: NOT NULL constraint failed`)
- A single restart registers all newly imported webhooks — you don't need to restart per workflow
- Use `update:workflow --active=true` (not `publish:workflow`) for n8n 2.x activation
- Do NOT use `n8n execute --id` while n8n is running — it starts a conflicting task broker on port 5679

---

## Complete Workflow Reference

### Pillar 0 — Lead Generation

| File | ID | Trigger | Purpose |
|------|----|---------|---------|
| `pillar-0-lead-gen/lead-ingest-enrich-score.json` | `leadpipeline0001` | `POST /webhook/lead-ingest` | Normalise → Firecrawl enrich → Groq ICP score → Supabase upsert |
| `pillar-0-lead-gen/github-scraper.json` | `githubscraper001` | `POST /webhook/scrape/github` | B2B SaaS founders via GitHub REST API (topic:saas, stars 80–1500) |
| `pillar-0-lead-gen/hackernews-scraper.json` | `hnscraper00001` | Schedule 6h + `POST /webhook/scrape/hackernews` | Ask HN / Show HN posters matching GTM/LatAm/AI keywords |
| `pillar-0-lead-gen/google-places-scraper.json` | `gplacesscraper1` | `POST /webhook/scrape/google-places` | LatAm businesses via Google Places API — body: `{"city":"...","query":"..."}` |

**Test:**
```bash
curl -X POST http://67.207.89.85:5678/webhook/scrape/github
curl -X POST http://67.207.89.85:5678/webhook/scrape/hackernews
curl -X POST http://67.207.89.85:5678/webhook/scrape/google-places \
  -H "Content-Type: application/json" \
  -d '{"city":"Mexico City","query":"B2B software company"}'
# Ingest a test lead:
curl -X POST http://67.207.89.85:5678/webhook/lead-ingest \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Lead","company":"Acme SaaS","domain":"acme.io","title":"VP Marketing","location":"Austin TX","source_platform":"github","source_url":"https://github.com/test","raw_bio":"B2B SaaS VP Marketing interested in LatAm expansion","company_size_signal":"51-200","scraped_at":"2026-06-19T00:00:00Z"}'
```

---

### Pillar 1 — SEO Intelligence

| File | ID | Trigger | Purpose |
|------|----|---------|---------|
| `pillar-1-seo/rank-tracker.json` | `ranktrackerv001` | Schedule every 6h | SerpBear API → keyword positions → Supabase upsert |
| `pillar-1-seo/keyword-research.json` | `keywordresearch1` | `POST /webhook/seo/keyword-research` | Google Suggest → Groq cluster classification → Supabase |
| `pillar-1-seo/trend-monitor.json` | `trendmonitor001` | Schedule daily 8am | Google Trends unofficial JSON → rising signals → priority_score=10 |
| `pillar-1-seo/site-audit.json` | `siteauditv0001` | Schedule Monday 9am | PageSpeed Insights (desktop + mobile) → content_pipeline |

**Test:**
```bash
curl -X POST http://67.207.89.85:5678/webhook/seo/keyword-research \
  -H "Content-Type: application/json" \
  -d '{"seeds":["latam market entry","b2b gtm strategy"]}'
```

---

### Pillar 2 — Content Production

| File | ID | Trigger | Purpose |
|------|----|---------|---------|
| `pillar-2-content/article-writer.json` | `articlewriterv1` | `POST /webhook/content/write-article` | Keyword → Groq 70b outline → Groq 70b article (HTML) → Supabase + optional WordPress |
| `pillar-2-content/social-posts.json` | `socialpostsv001` | `POST /webhook/content/social-posts` | Article → Groq 8b → LinkedIn post + Twitter thread |
| `pillar-2-content/image-generator.json` | `imagegenv00001` | `POST /webhook/content/generate-image` | Cloudflare Flux → base64 JPEG (fallback: HuggingFace → Pollinations) |
| `pillar-2-content/content-director.json` | `contentdirector1` | `POST /webhook/content/produce` | Orchestrator: article (blocking) → social + image (parallel) → newsletter section |

**Test:**
```bash
# Write an article (takes ~30–60s):
curl -X POST http://67.207.89.85:5678/webhook/content/write-article \
  -H "Content-Type: application/json" \
  -d '{"keyword":"latam market entry strategy","pillar":"latam","word_count":1500}'

# Generate an image:
curl -X POST http://67.207.89.85:5678/webhook/content/generate-image \
  -H "Content-Type: application/json" \
  -d '{"keyword":"latam market entry","title":"How to Enter the Latin American Market in 2026","style":"featured"}'

# Full pipeline (article + social + image + newsletter — takes ~2–3 min):
curl -X POST http://67.207.89.85:5678/webhook/content/produce \
  -H "Content-Type: application/json" \
  -d '{"keyword":"b2b gtm strategy","pillar":"gtm","word_count":1500}'
```

---

### Pillar 3 — Competitor Intelligence

| File | ID | Trigger | Purpose |
|------|----|---------|---------|
| `pillar-3-competitor/sitemap-crawler.json` | `sitemapcrwlr001` | Schedule daily 7am | Fetches sitemaps for 8 competitor domains, sends new URLs to content-extractor |
| `pillar-3-competitor/content-extractor.json` | `contentextract1` | `POST /webhook/competitor/extract` | Firecrawl scrape → extract title/meta/wordcount → Supabase → fires threat-assessor |
| `pillar-3-competitor/threat-assessor.json` | `threatassess01` | `POST /webhook/competitor/assess-threat` | Groq 8b → HIGH/MEDIUM/LOW vs Markexis keyword clusters → updates competitor_articles |

**Competitor domains monitored:**
`gotomarket.io` · `revenuearchitects.com` · `growthcollective.com` · `pavilion.com` · `klique.io` · `demandcurve.com` · `cxl.com` · `openviewpartners.com`

**Test:**
```bash
# Extract and score a specific URL manually:
curl -X POST http://67.207.89.85:5678/webhook/competitor/extract \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.demandcurve.com/blog/gtm-strategy","competitor_domain":"demandcurve.com"}'

# Run batch threat assessment on all unscored articles:
curl -X POST http://67.207.89.85:5678/webhook/competitor/assess-threat \
  -H "Content-Type: application/json" \
  -d '{"batch":true}'
```

---

### Pillar 5 — Knowledge & Operations

| File | ID | Trigger | Purpose |
|------|----|---------|---------|
| `pillar-5-ops/doc-ingester.json` | `docingesterv01` | `POST /webhook/ops/ingest-doc` | URL or raw text → sentence-boundary chunks → Jina AI 768-dim embeddings → pgvector |
| `pillar-5-ops/rag-searcher.json` | `ragsearcherv01` | `POST /webhook/ops/rag-search` | Query → Jina embed → cosine similarity search → optional Groq synthesis |
| `pillar-5-ops/pipeline-orchestrator.json` | `pipelineorch01` | `POST /webhook/ops/run-pipeline` | Keyword → SEO research → content-director → RAG ingest (full machine in one call) |

**Test:**
```bash
# Ingest a URL into the knowledge base:
curl -X POST http://67.207.89.85:5678/webhook/ops/ingest-doc \
  -H "Content-Type: application/json" \
  -d '{"url":"https://markexis.com","source":"markexis_website","doc_type":"company_page"}'

# Ingest raw text:
curl -X POST http://67.207.89.85:5678/webhook/ops/ingest-doc \
  -H "Content-Type: application/json" \
  -d '{"content":"Markexis specializes in LatAm market entry consulting for B2B SaaS companies...","source":"markexis_about","doc_type":"company_description"}'

# Search the knowledge base:
curl -X POST http://67.207.89.85:5678/webhook/ops/rag-search \
  -H "Content-Type: application/json" \
  -d '{"query":"what markets does Markexis help companies enter?","synthesize":true}'

# Full pipeline — keyword → article → social → image → RAG (takes 3–5 min):
curl -X POST http://67.207.89.85:5678/webhook/ops/run-pipeline \
  -H "Content-Type: application/json" \
  -d '{"keyword":"latam gtm strategy 2026","pillar":"latam"}'
```

---

## Architecture Note

All workflows follow the **single Code node pattern**: one trigger feeds into a single `n8n-nodes-base.code` node that handles all HTTP calls via `this.helpers.httpRequest`. This avoids n8n HTTP Request node expression limitations and keeps error handling centralised.

```
✅  Webhook → Code (all API calls in JS) → RespondToWebhook
❌  Webhook → HTTP Request → IF → HTTP Request → Supabase node → ...
```

**Required VPS environment variables** (in `/root/n8n/docker-compose.yml`):
```
N8N_BLOCK_ENV_ACCESS_IN_NODE=false   # REQUIRED: Code nodes can read $env.KEY
N8N_RUNNERS_ENABLED=true             # REQUIRED: Code node execution in n8n 2.x

GROQ_API_KEY          CEREBRAS_API_KEY      SAMBANOVA_API_KEY
FIRECRAWL_API_KEY     SUPABASE_URL          SUPABASE_ANON_KEY
GOOGLE_PLACES_API_KEY GITHUB_TOKEN          JINA_API_KEY
CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN  SERPBEAR_API_KEY
```
