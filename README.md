# Markexis AI CMO Platform — Case Study

> **The Problem:** A full-stack B2B marketing team costs $612K–$850K/year. We replaced one with 45+ AI agents running at **$0/month** using open-source tools, free API tiers, and self-hosted infrastructure.

**Client:** [Markexis](https://markexis.com) — a B2B consulting firm specialising in LatAm Market Entry, AI Marketing Implementation, and Revenue Growth Strategy.

---

## What Was Built

A full **AI CMO Platform** spanning 5 pillars plus a lead generation pipeline (Pillar 0). This repo contains the complete, production code for **Pillar 0 (Lead Generation)** — the engine that scrapes leads across 12 platforms, scores them against Markexis's ICP, and fires personalised cold-email sequences automatically.

```
Lead Sources (12 platforms)
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  n8n (VPS: 67.207.89.85:5678) — Ingest + Scoring Pipeline │
│                                                         │
│  POST /webhook/lead-ingest                              │
│    → Normalise to unified schema                        │
│    → Firecrawl: enrich company website                  │
│    → Groq llama-3.1-8b: ICP score (PERFECT/GOOD/SKIP)  │
│    → Supabase: upsert with dedup on domain              │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  Outreach (runs on Mac — VPS SMTP ports are blocked)    │
│                                                         │
│  outreach.js  → Email 1 to qualified leads              │
│  followup.js  → Email 2 at Day 5, Email 3 at Day 12    │
│  3 tracks: LatAm | AI Implementation | Revenue Growth   │
│  Gmail SMTP via nodemailer, cap 50/day                  │
└─────────────────────────────────────────────────────────┘
```

---

## The 5 Pillars (full platform)

| Pillar | What it does | Status |
|--------|-------------|--------|
| **0 — Lead Generation** | 12-platform scrape → ICP score → cold email | ✅ Built (this repo) |
| **1 — SEO Intelligence** | Rank tracking, keyword research, trend alerts | 🔧 Phase 2 |
| **2 — Content Production** | Articles, LinkedIn posts, newsletters, video scripts | 🔧 Phase 3 |
| **3 — Competitor Intelligence** | Sitemap crawling, keyword overlap, threat scoring | 🔧 Phase 4 |
| **5 — Knowledge & Operations** | Vector RAG, brand voice, WordPress publishing | 🔧 Phase 5 |

---

## Infrastructure: $0/month

| Layer | Tool | Cost |
|-------|------|------|
| Orchestration | n8n self-hosted (DigitalOcean $6/mo droplet) | $6/mo shared |
| AI / LLM | Groq (14,400 req/day free) → Cerebras → Sambanova → NVIDIA NIM | $0 |
| Database + Vector | Supabase free tier + pgvector | $0 |
| Company enrichment | Firecrawl free (1,000 req/mo) | $0 |
| Email sending | Gmail SMTP via App Password | $0 |
| Scraping (auth platforms) | Crawlee + Playwright on local Mac (residential IP) | $0 |

---

## Lead Sources

| Platform | Where | Method |
|----------|-------|--------|
| GitHub | VPS (n8n) | REST API — founders of B2B SaaS repos |
| HackerNews | VPS (n8n) | Algolia search — high-intent Ask HN posts |
| Google Maps/Places | VPS (n8n) | Places API — LatAm businesses |
| Reddit | VPS (n8n) | OAuth API (pending approval) |
| ProductHunt | VPS (n8n) | GraphQL API |
| LinkedIn | Local Mac | Crawlee + Playwright stealth (**built** — `scrapers/linkedin.js`) |
| Instagram, Twitter/X | Local Mac | Crawlee + Playwright |
| Facebook Groups | Local Mac | Crawlee + Playwright |
| G2, Clutch, Wellfound | Local Mac | Crawlee (public pages) |
| Yelp | VPS (n8n) | Fusion API |

---

## ICP: Who Markexis Targets

**PERFECT match (score 8–10):**
- Title: CEO, Founder, CMO, VP Marketing, CRO, Head of Growth
- Company: B2B SaaS, Fintech, Healthtech, CPG, tech startup — 20–500 employees
- Geography: US/CA/UK/EU/AU companies wanting LatAm expansion, OR LatAm companies wanting to scale
- Signal: mentions LatAm, AI marketing, GTM, just raised funding, or hiring for marketing

**Cold email tracks (personalised per signal):**
- **Track A — LatAm:** for `latam_signal = true`
- **Track B — AI Marketing:** for `ai_signal = true`
- **Track C — Revenue Growth:** default

---

## Repository Structure

```
markexis/
├── README.md                          ← you are here
├── CLAUDE.md                          ← full build context + tool stack
│
├── docs/
│   ├── architecture.md               ← system architecture deep-dive
│   ├── phase-0-infrastructure.md     ← VPS setup, Docker, firewall
│   └── phase-1-lead-gen-pipeline.md  ← pipeline design decisions
│
├── n8n-workflows/
│   ├── README.md                     ← how to import and deploy
│   └── pillar-0-lead-gen/
│       ├── lead-ingest-enrich-score.json   ← core pipeline (Webhook → Firecrawl → Groq → Supabase)
│       ├── github-scraper.json             ← B2B SaaS founders via GitHub API
│       ├── hackernews-scraper.json         ← high-intent leads via HN Algolia search
│       └── google-places-scraper.json      ← LatAm businesses via Google Places API
│
└── scrapers/                          ← Node.js, runs on local Mac (residential IP)
    ├── README.md                     ← how to run scrapers
    ├── package.json
    ├── .env.example
    ├── index.js                      ← CLI dispatcher
    ├── outreach.js                   ← Email 1 sender (Day 1)
    ├── followup.js                   ← Email 2+3 sender (Day 5 / Day 12)
    └── lib/
        ├── schema.js                 ← unified lead schema normaliser
        ├── poster.js                 ← POST to n8n webhook
        ├── delays.js                 ← human-like random delays
        └── templates.js             ← 3 tracks × 3 emails = 9 email templates
```

---

## Quick Start

### 1. Prerequisites

- n8n self-hosted instance (see [`docs/phase-0-infrastructure.md`](docs/phase-0-infrastructure.md))
- Supabase project with schema applied (SQL in `CLAUDE.md`)
- API keys: Groq, Firecrawl, Supabase, Google Places, GitHub token

### 2. Deploy n8n Workflows (VPS)

```bash
# See n8n-workflows/README.md for full instructions
# Short version — for each JSON file:
scp n8n-workflows/pillar-0-lead-gen/lead-ingest-enrich-score.json root@YOUR_VPS:/tmp/
ssh root@YOUR_VPS "
  docker cp /tmp/lead-ingest-enrich-score.json n8n-n8n-1:/tmp/
  docker exec n8n-n8n-1 n8n import:workflow --input=/tmp/lead-ingest-enrich-score.json
  docker exec n8n-n8n-1 n8n publish:workflow --id=leadpipeline0001
  docker compose -f ~/n8n/docker-compose.yml restart n8n
"
# Note: use publish:workflow (not update:workflow --active) for n8n 2.x
```

### 3. Set Up Local Scrapers (Mac)

```bash
cd scrapers
cp .env.example .env   # fill in your values
npm install
node outreach.js --dry-run    # preview who would get emailed
node outreach.js --limit=5    # send Email 1 to 5 leads
node followup.js --dry-run    # preview Day 5/12 follow-ups
```

### 4. Trigger Lead Scrapers

```bash
# GitHub scraper — fires once, ingests up to 6 founders
curl -X POST http://67.207.89.85:5678/webhook/scrape/github

# HackerNews — runs on schedule (every 6h), or trigger manually
curl -X POST http://67.207.89.85:5678/webhook/scrape/hackernews

# Google Places — trigger with custom city/type
curl -X POST http://67.207.89.85:5678/webhook/scrape/google-places \
  -H "Content-Type: application/json" \
  -d '{"city": "Mexico City", "query": "B2B software company"}'
```

---

## Results (as of 2026-06-18)

| Metric | Value |
|--------|-------|
| Lead sources live | 4 VPS (GitHub, HackerNews, Google Places, Reddit pending) + LinkedIn (Mac) |
| Leads in Supabase | **121** across Google Maps, HackerNews, GitHub |
| PERFECT / GOOD scored | 6 GOOD (incl. NachoNacho CTO — track B, ready to send) |
| Email outreach | 0 sent (dry-run confirmed — 1 GOOD lead with email ready) |
| LinkedIn scraper | Built — `node linkedin.js --login` to authenticate, then headless |
| Monthly cost | $0 AI + $6 VPS |

---

## Docs

- [System Architecture](docs/architecture.md)
- [Phase 0: Infrastructure Setup](docs/phase-0-infrastructure.md)
- [Phase 1: Lead Gen Pipeline Design](docs/phase-1-lead-gen-pipeline.md)
- [Full Build Context + Tool Stack](CLAUDE.md)
