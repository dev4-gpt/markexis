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
| **4 — Video Production** | Short-form stock-footage videos via MoneyPrinterTurbo | 🔧 Deploy pending (MPT installed, needs Pexels API key) |
| **5 — Knowledge & Ops** | pgvector RAG, doc ingestion, full pipeline orchestrator | ✅ Live |

---

## Infrastructure: $6/month total

| Layer | Tool | Cost |
|-------|------|------|
| Orchestration | n8n self-hosted (DigitalOcean $12/mo) | $12/mo |
| AI / LLM | Groq (14,400 req/day free) → Cerebras → Sambanova | $0 |
| Image generation | Cloudflare Workers AI (Flux, 10k neurons/day free) → HuggingFace → Pollinations | $0 |
| Database + Vector | Supabase free tier + pgvector | $0 |
| Embeddings (RAG) | Jina AI (1M tokens/month free, 768-dim) | $0 |
| Company enrichment | Firecrawl free (1,000 req/mo) | $0 |
| Rank tracking | SerpBear self-hosted on VPS | $0 |
| Newsletter | Listmonk self-hosted on VPS | $0 |
| Email sending | Gmail SMTP via App Password (runs on Mac) | $0 |
| Scraping (auth platforms) | Crawlee + Playwright on local Mac | $0 |

---

## Active Webhooks (all returning 200)

| Endpoint | Workflow | Purpose |
|----------|----------|---------|
| `POST /webhook/lead-ingest` | lead-ingest-enrich-score | Normalise → enrich → score → Supabase |
| `POST /webhook/scrape/github` | github-scraper | B2B SaaS founders via GitHub REST API |
| `POST /webhook/scrape/hackernews` | hackernews-scraper | High-intent Ask HN / Show HN posters |
| `POST /webhook/scrape/google-places` | google-places-scraper | LatAm businesses via Places API |
| `POST /webhook/seo/keyword-research` | keyword-research | Google Suggest → Groq cluster → Supabase |
| `POST /webhook/content/write-article` | article-writer | Keyword → Groq outline → Groq article → WordPress |
| `POST /webhook/content/social-posts` | social-posts | Article → LinkedIn post + Twitter thread |
| `POST /webhook/content/generate-image` | image-generator | Cloudflare Flux → base64 JPEG (4-deep fallback) |
| `POST /webhook/content/produce` | content-director | Article + social + image + newsletter in one call |
| `POST /webhook/competitor/extract` | content-extractor | Firecrawl URL → competitor_articles |
| `POST /webhook/competitor/assess-threat` | threat-assessor | Groq → HIGH/MEDIUM/LOW threat score |
| `POST /webhook/ops/ingest-doc` | doc-ingester | URL/text → chunks → Jina embed → pgvector |
| `POST /webhook/ops/rag-search` | rag-searcher | Query → vector search → Groq answer |
| `POST /webhook/ops/run-pipeline` | pipeline-orchestrator | Keyword → SEO → full content → RAG ingest |

**Scheduled workflows:**
- `rank-tracker` — every 6h (SerpBear → Supabase)
- `trend-monitor` — daily 8am (Google Trends → rising signals)
- `site-audit` — Monday 9am (PageSpeed Insights desktop + mobile)
- `sitemap-crawler` — daily 7am (8 competitor domains → new URLs)
- `hackernews-scraper` — every 6h (also has webhook for manual trigger)

---

## ICP: Who Markexis Targets

**PERFECT match (score 8–10):**
- Title: CEO, Founder, CMO, VP Marketing, CRO, Head of Growth
- Company: B2B SaaS, Fintech, Healthtech, CPG, tech startup — 20–500 employees
- Geography: US/CA/UK/EU/AU companies wanting LatAm expansion, OR LatAm companies wanting to scale
- Signal: mentions LatAm, AI marketing, GTM, just raised funding, or hiring for marketing

**Cold email tracks (personalised per signal):**
- **Track A — LatAm:** `latam_signal = true` (LatAm is Markexis's strongest differentiator)
- **Track B — AI Marketing:** `ai_signal = true`
- **Track C — Revenue Growth:** default for all PERFECT leads

---

## Repository Structure

```
markexis/
├── README.md
├── CLAUDE.md                          ← full build context + tool stack
├── MARKEXIS_IMPLEMENTATION_PLAN.md   ← phase-by-phase build plan
│
├── scripts/                          ← operational scripts (run these)
│   ├── deploy.sh                     ← deploy all workflows to VPS in one shot
│   ├── smoke-test.sh                 ← verify all 12+ webhooks respond
│   └── run-pipeline.sh               ← trigger full content pipeline for a keyword
│
├── docs/
│   ├── architecture.md               ← system architecture deep-dive
│   ├── phase-0-infrastructure.md     ← VPS setup, Docker, firewall, Supabase
│   └── phase-1-lead-gen-pipeline.md  ← pipeline design, ICP scoring, email cadence
│
├── n8n-workflows/
│   ├── README.md                     ← workflow IDs + import instructions
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
│   │   ├── content-extractor.json
│   │   └── threat-assessor.json
│   └── pillar-5-ops/
│       ├── doc-ingester.json
│       ├── rag-searcher.json
│       └── pipeline-orchestrator.json
│
└── scrapers/                          ← Node.js, runs on local Mac (residential IP)
    ├── README.md                      ← setup + anti-detection rules
    ├── package.json
    ├── .env.example
    ├── index.js                       ← CLI dispatcher: node index.js --platform=linkedin
    ├── linkedin.js                    ← Crawlee + Playwright stealth scraper
    ├── outreach.js                    ← Email 1 sender (Day 1)
    ├── followup.js                    ← Email 2+3 sender (Day 5 / Day 12)
    └── lib/
        ├── schema.js                  ← unified lead schema normaliser
        ├── poster.js                  ← POST to n8n webhook
        ├── delays.js                  ← human-like random delays
        └── templates.js              ← 3 tracks × 3 emails = 9 email templates
```

---

## Quick Start

### 1. Prerequisites

- n8n self-hosted instance — see [`docs/phase-0-infrastructure.md`](docs/phase-0-infrastructure.md)
- Supabase project with schema applied — SQL in `CLAUDE.md` → "Supabase Schema"
- API keys: Groq, Firecrawl, Supabase, Google Places, GitHub token, Jina AI, Cloudflare

### 2. Deploy All n8n Workflows (one command)

```bash
# From project root:
bash scripts/deploy.sh
```

Or manually for a single workflow:
```bash
FILE=n8n-workflows/pillar-0-lead-gen/lead-ingest-enrich-score.json
ID=leadpipeline0001

scp $FILE root@67.207.89.85:/tmp/$(basename $FILE)
ssh root@67.207.89.85 "
  docker cp /tmp/$(basename $FILE) n8n-n8n-1:/tmp/ &&
  docker exec n8n-n8n-1 n8n import:workflow --input=/tmp/$(basename $FILE) &&
  docker exec n8n-n8n-1 n8n update:workflow --id=$ID --active=true
"
# Then restart: ssh root@67.207.89.85 "cd ~/n8n && docker compose restart n8n"
```

### 3. Verify Everything Is Live

```bash
bash scripts/smoke-test.sh
# Expected: all webhooks return 200
```

### 4. Trigger Lead Scrapers

```bash
# GitHub founders
curl -X POST http://67.207.89.85:5678/webhook/scrape/github

# HackerNews (also runs every 6h automatically)
curl -X POST http://67.207.89.85:5678/webhook/scrape/hackernews

# Google Places — LatAm businesses
curl -X POST http://67.207.89.85:5678/webhook/scrape/google-places \
  -H "Content-Type: application/json" \
  -d '{"city": "Mexico City", "query": "B2B software company"}'
```

### 5. Run Full Content Pipeline

```bash
# Produce article + social posts + image + RAG ingest from one keyword:
bash scripts/run-pipeline.sh "latam market entry strategy"

# Or call directly:
curl -X POST http://67.207.89.85:5678/webhook/ops/run-pipeline \
  -H "Content-Type: application/json" \
  -d '{"keyword": "latam market entry strategy", "pillar": "latam"}'
```

### 6. Send Cold Emails (runs on Mac)

```bash
cd scrapers
node outreach.js --dry-run        # preview who gets Email 1 — no sends
node outreach.js --limit=5        # send Email 1 to 5 qualified leads
node followup.js --dry-run        # preview Day 5 / Day 12 follow-ups
node followup.js --limit=10       # send follow-ups
```

---

## Results (as of 2026-06-19)

| Metric | Value |
|--------|-------|
| Workflows live on VPS | **18** (5 pillars fully deployed) |
| Lead sources live | 4 VPS scrapers + LinkedIn (Mac) |
| Leads in Supabase | **121** (GitHub, HackerNews, Google Maps) |
| ICP scored | 6 GOOD scored — NachoNacho CTO on Track B, ready to send |
| Email sequences | outreach.js + followup.js ready, Gmail SMTP connected |
| Content pipeline | article-writer → social-posts → image-generator → RAG all live |
| Competitor monitoring | 8 domains daily (demandcurve.com, cxl.com, openviewpartners.com, …) |
| Vector RAG | pgvector + Jina AI embeddings + match_knowledge_base RPC live in Supabase |
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

- [System Architecture](docs/architecture.md)
- [Phase 0: Infrastructure Setup](docs/phase-0-infrastructure.md)
- [Phase 1: Lead Gen Pipeline Design](docs/phase-1-lead-gen-pipeline.md)
- [n8n Workflow Reference](n8n-workflows/README.md)
- [Scraper Setup + Anti-Detection Rules](scrapers/README.md)
- [Full Build Context + Tool Stack](CLAUDE.md)
