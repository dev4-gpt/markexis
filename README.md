# Markexis AI CMO Platform

> **The Problem:** A full-stack B2B marketing team costs $612K–$850K/year. We replaced one with AI agents running at **$12/month total** ($0 AI) using open-source tools, free API tiers, and a self-hosted $12 VPS.

**Client:** [Markexis](https://markexis.com) — B2B consulting firm specialising in LatAm Market Entry, AI Marketing Implementation, and Revenue Growth Strategy.

---

## What Was Built

A full **AI CMO Platform** spanning 6 pillars — all deployed and live as of 2026-06-19.

```
┌──────────────────────────────────────────────────────────────┐
│  Mac (Crawlee scrapers — residential IP)                      │
│  LinkedIn · Instagram · Twitter · G2 · Wellfound · Facebook  │
└──────────────────────────┬───────────────────────────────────┘
                           │ POST /webhook/lead-ingest
┌──────────────────────────▼───────────────────────────────────┐
│  n8n (VPS 67.207.89.85:5678) — 18 active workflows          │
│                                                               │
│  Pillar 0: lead-ingest → Firecrawl enrich → Groq ICP score  │
│            → Supabase upsert → cold email queue              │
│                                                               │
│  Pillar 1: rank-tracker · keyword-research · trend-monitor   │
│            site-audit                                        │
│                                                               │
│  Pillar 2: article-writer · social-posts · image-generator   │
│            content-director (orchestrator)                   │
│                                                               │
│  Pillar 3: sitemap-crawler · content-extractor               │
│            threat-assessor                                   │
│                                                               │
│  Pillar 5: doc-ingester · rag-searcher                       │
│            pipeline-orchestrator (keyword → full content)    │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│  Supabase (free tier + pgvector)                             │
│  leads · outreach_log · content_pipeline · keywords          │
│  competitor_articles · knowledge_base (RAG)                  │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│  UI Layer (SSH tunnel → localhost)                           │
│  NocoDB :8090 — spreadsheet views of all Supabase tables     │
│  Open WebUI :3001 — AI chat + 8 tools wired to n8n webhooks  │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│  Mac (outreach sender — VPS SMTP ports blocked)              │
│  outreach.js → Email 1 · followup.js → Email 2 / 3          │
│  Gmail SMTP · 3 tracks: LatAm | AI | Revenue Growth         │
└──────────────────────────────────────────────────────────────┘
```

---

## The 6 Pillars

| Pillar | What it does | Status |
|--------|-------------|--------|
| **0 — Lead Generation** | 12-platform scrape → ICP score → cold email sequences | ✅ Live |
| **1 — SEO Intelligence** | Rank tracking (SerpBear), keyword research, trend alerts | ✅ Live |
| **2 — Content Production** | Articles → LinkedIn posts → featured images → newsletter | ✅ Live |
| **3 — Competitor Intelligence** | Daily sitemap crawl, Firecrawl extract, Groq threat score | ✅ Live |
| **4 — Video Production** | Short-form stock-footage videos via MoneyPrinterTurbo | 🔧 Deploy pending |
| **5 — Knowledge & Ops** | pgvector RAG, doc ingestion, full pipeline orchestrator | ✅ Live |

---

## Infrastructure: $6/month total

| Layer | Tool | Cost |
|-------|------|------|
| Orchestration | n8n self-hosted (DigitalOcean $12/mo) | $12/mo |
| AI / LLM | Groq (14,400 req/day free) → Cerebras → Sambanova | $0 |
| Image generation | Cloudflare Workers AI (Flux, 10k neurons/day) → HuggingFace → Pollinations | $0 |
| Database + Vector | Supabase free tier + pgvector | $0 |
| Embeddings (RAG) | Jina AI (1M tokens/month free, 768-dim) | $0 |
| Company enrichment | Firecrawl free (1,000 req/mo) | $0 |
| Rank tracking | SerpBear self-hosted on VPS | $0 |
| Newsletter | Listmonk self-hosted on VPS | $0 |
| Email sending | Gmail SMTP via App Password (runs on Mac) | $0 |
| Scraping (auth platforms) | Crawlee + Playwright on local Mac | $0 |
| **Data dashboard** | **NocoDB self-hosted on VPS** | **$0** |
| **AI chat interface** | **Open WebUI self-hosted on VPS** | **$0** |

---

## Active Webhooks (15 endpoints)

| Endpoint | Workflow | Purpose |
|----------|----------|---------|
| `POST /webhook/lead-ingest` | lead-ingest-enrich-score | Normalise → enrich → score → Supabase |
| `POST /webhook/scrape/github` | github-scraper | B2B SaaS founders via GitHub REST API |
| `POST /webhook/scrape/hackernews` | hackernews-scraper | High-intent Ask HN / Show HN posters |
| `POST /webhook/scrape/google-places` | google-places-scraper | LatAm businesses via Places API |
| `POST /webhook/seo/keyword-research` | keyword-research | Groq-powered keyword expansion → Supabase |
| `POST /webhook/content/write-article` | article-writer | Keyword → Groq outline → article → Supabase |
| `POST /webhook/content/social-posts` | social-posts | Article → LinkedIn post + Twitter thread |
| `POST /webhook/content/generate-image` | image-generator | Cloudflare Flux → base64 JPEG (4-deep fallback) |
| `POST /webhook/content/produce` | content-director | Article + social + image + newsletter in one call |
| `POST /webhook/competitor/run-crawler` | sitemap-crawler | Manual trigger — crawl all 8 competitor domains |
| `POST /webhook/competitor/extract` | content-extractor | Firecrawl URL → competitor_articles |
| `POST /webhook/competitor/assess-threat` | threat-assessor | Groq → HIGH/MEDIUM/LOW threat score |
| `POST /webhook/ops/ingest-doc` | doc-ingester | URL/text → chunks → Jina embed → pgvector |
| `POST /webhook/ops/rag-search` | rag-searcher | Query → vector search → Groq answer |
| `POST /webhook/ops/run-pipeline` | pipeline-orchestrator | Keyword → SEO → full content → RAG ingest |

**Scheduled workflows:**
- `rank-tracker` — every 6h (SerpBear → Supabase)
- `hackernews-scraper` — every 6h (also has webhook for manual trigger)
- `sitemap-crawler` — daily 7am UTC (8 competitor domains → new URLs)
- `trend-monitor` — daily 8am UTC (Google Trends → rising signals)
- `site-audit` — Monday 9am UTC (PageSpeed Insights desktop + mobile)

---

## UI Layer

### NocoDB — `localhost:8090` (via SSH tunnel)

Spreadsheet views of all Supabase tables. Connect via SSH tunnel then browse:
- `leads` — all scraped + scored leads, filter by `icp_score`
- `content_pipeline` — articles in review, set `status = published` when ready
- `keywords` — SEO clusters with priority scores
- `competitor_articles` — threat-scored competitor content
- `knowledge_base` — RAG chunks with embeddings
- `outreach_log` — email send history

### Open WebUI — `localhost:3001` (via SSH tunnel)

AI chat powered by Groq Llama 3.3 70B with 8 custom tools wired to n8n:

| Say this | What happens |
|----------|-------------|
| *"Write an article about LatAm market entry"* | Triggers full pipeline — article + social + image |
| *"Show me a leads summary"* | Queries Supabase live — count by score + platform |
| *"Scrape GitHub for new founders"* | Triggers github-scraper webhook |
| *"What do we know about Markexis's services?"* | RAG search over knowledge base |
| *"Run keyword research for AI marketing"* | Groq keyword expansion → Supabase |
| *"Run competitor crawl"* | Crawls all 8 competitor sitemaps |

**Open both UIs in one command:**
```bash
bash scripts/open-ui.sh
```

---

## ICP: Who Markexis Targets

**PERFECT match (score 8–10):**
- Title: CEO, Founder, CMO, VP Marketing, CRO, Head of Growth
- Company: B2B SaaS, Fintech, Healthtech, CPG, tech startup — 20–500 employees
- Geography: US/CA/UK/EU/AU companies wanting LatAm expansion, OR LatAm companies wanting to scale
- Signal: mentions LatAm, AI marketing, GTM, just raised funding, or hiring for marketing

**Cold email tracks (personalised per signal):**
- **Track A — LatAm:** `latam_signal = true` (Markexis's strongest differentiator)
- **Track B — AI Marketing:** `ai_signal = true`
- **Track C — Revenue Growth:** default for all PERFECT leads

---

## Repository Structure

```
markexis/
├── README.md
├── CLAUDE.md                          ← full build context + tool stack
├── MARKEXIS_IMPLEMENTATION_PLAN.md   ← phase-by-phase build plan
├── docker-compose.yml                ← n8n + NocoDB + Open WebUI (VPS)
├── open-webui-tools.py               ← 8 AI tools wired to n8n webhooks
│
├── scripts/
│   ├── deploy.sh                     ← deploy all 18 workflows to VPS
│   ├── smoke-test.sh                 ← verify all 15 webhooks respond 200
│   ├── run-pipeline.sh               ← trigger full content pipeline
│   └── open-ui.sh                    ← SSH tunnel + open NocoDB + Open WebUI
│
├── docs/
│   ├── architecture.md
│   ├── operations.md                 ← day-to-day runbook (all pillars)
│   ├── phase-0-infrastructure.md
│   ├── phase-1-lead-gen-pipeline.md
│   ├── phase-2-seo-intelligence.md
│   ├── phase-3-content-production.md
│   ├── phase-4-competitor-intelligence.md
│   └── phase-5-knowledge-operations.md
│
├── n8n-workflows/
│   ├── README.md
│   ├── pillar-0-lead-gen/
│   │   ├── lead-ingest-enrich-score.json
│   │   ├── github-scraper.json
│   │   ├── hackernews-scraper.json
│   │   └── google-places-scraper.json
│   ├── pillar-1-seo/
│   │   ├── rank-tracker.json
│   │   ├── keyword-research.json
│   │   ├── trend-monitor.json
│   │   └── site-audit.json
│   ├── pillar-2-content/
│   │   ├── article-writer.json
│   │   ├── social-posts.json
│   │   ├── image-generator.json
│   │   └── content-director.json
│   ├── pillar-3-competitor/
│   │   ├── sitemap-crawler.json
│   │   └── content-extractor.json
│   │   └── threat-assessor.json
│   └── pillar-5-ops/
│       ├── doc-ingester.json
│       ├── rag-searcher.json
│       └── pipeline-orchestrator.json
│
└── scrapers/                          ← Node.js, runs on local Mac
    ├── package.json
    ├── index.js
    ├── linkedin.js
    ├── outreach.js
    ├── followup.js
    └── lib/
        ├── schema.js
        ├── poster.js
        ├── delays.js
        └── templates.js
```

---

## Quick Start

### 1. Open the UI (daily use)

```bash
bash scripts/open-ui.sh
# Opens NocoDB at localhost:8090 and Open WebUI at localhost:3001
```

### 2. Deploy All n8n Workflows (one command)

```bash
bash scripts/deploy.sh
```

### 3. Verify Everything Is Live

```bash
bash scripts/smoke-test.sh
# Expected: 15 passed, 0 failed
```

### 4. Trigger Lead Scrapers

```bash
curl -X POST http://67.207.89.85:5678/webhook/scrape/github
curl -X POST http://67.207.89.85:5678/webhook/scrape/hackernews
curl -X POST http://67.207.89.85:5678/webhook/scrape/google-places
```

### 5. Run Full Content Pipeline

```bash
bash scripts/run-pipeline.sh "latam market entry strategy" latam
# Produces: article (1500+ words) + LinkedIn post + Twitter thread + image + RAG ingest
# Time: ~13 seconds
```

### 6. Send Cold Emails (Mac only)

```bash
cd scrapers
node outreach.js --dry-run     # preview — no sends
node outreach.js --limit=5     # send Email 1 to 5 leads
node followup.js --limit=10    # send Day 5/12 follow-ups
```

---

## Results (as of 2026-06-19)

| Metric | Value |
|--------|-------|
| Workflows live on VPS | **18** across 5 pillars |
| Active webhook endpoints | **15** |
| Lead sources live | GitHub · HackerNews · Google Places · LinkedIn (Mac) |
| Leads in Supabase | **82** unique (deduped by source_url) |
| ICP GOOD leads | **13** scored and ready for outreach |
| Content pipeline | Full pipeline in ~13s: article + social + image + RAG |
| Keywords tracked | 21+ Groq-expanded keyword clusters in Supabase |
| Competitor monitoring | 8 domains daily, 50+ articles extracted + threat-scored |
| RAG knowledge base | pgvector + Jina AI, 22+ chunks, `match_knowledge_base` RPC live |
| UI | NocoDB + Open WebUI live at localhost:8090 / :3001 |
| Monthly cost | **$0 AI + $6 VPS** |

---

## Related: The Gatekeeper

[**The Gatekeeper**](https://github.com/dev4-gpt/the-gatekeeper) is the inbound BANT qualification layer that pairs with this pipeline.

| This repo (outbound) | The Gatekeeper (inbound) |
|----------------------|--------------------------|
| Scrapes 12 platforms → ICP scores with Groq → fires cold email sequences | When a prospect replies or books a call, runs them through a BANT qualification flow |
| Fully automated — zero human time | Human-in-the-loop — confirms scoring with the prospect before routing |
| Output: 3-track email sequences in Supabase | Output: book_ae / nurture / disqualify + explainable reasoning in a Streamlit dashboard |

Together: **automated outbound fills the top of funnel, Gatekeeper qualifies what comes back.**

---

## Docs

- [Operations Runbook](docs/operations.md) — day-to-day: scrapers, content, email, deploy, troubleshoot
- [System Architecture](docs/architecture.md)
- [Phase 0: Infrastructure](docs/phase-0-infrastructure.md)
- [Phase 1: Lead Gen Pipeline](docs/phase-1-lead-gen-pipeline.md)
- [Phase 2: SEO Intelligence](docs/phase-2-seo-intelligence.md)
- [Phase 3: Content Production](docs/phase-3-content-production.md)
- [Phase 4: Competitor Intelligence](docs/phase-4-competitor-intelligence.md)
- [Phase 5: Knowledge & Operations](docs/phase-5-knowledge-operations.md)
- [n8n Workflow Reference](n8n-workflows/README.md)
- [Full Build Context + Tool Stack](CLAUDE.md)
