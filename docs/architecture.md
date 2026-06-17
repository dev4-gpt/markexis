# System Architecture

## Overview

The Markexis AI CMO Platform is built as a **hub-and-spoke architecture** where n8n on a $6/month DigitalOcean VPS acts as the orchestration hub, coordinating free-tier APIs for AI, enrichment, and data storage. Residential-IP scraping (for auth-gated platforms like LinkedIn) runs on a local Mac and POSTs into the same n8n ingest webhook.

```
                    ┌──────────────────────────────┐
                    │    Mac (Crawlee scrapers)    │
                    │  LinkedIn / Instagram /       │
                    │  Twitter / Facebook /         │
                    │  G2 / Wellfound               │
                    │  (residential IP required)    │
                    └──────────────┬───────────────┘
                                   │ POST /webhook/lead-ingest
                    ┌──────────────▼───────────────┐
                    │   n8n (VPS 67.207.89.85)     │
                    │                               │
                    │  ┌─────────────────────────┐ │
                    │  │  VPS Scrapers (no auth)  │ │
                    │  │  • GitHub API            │ │
                    │  │  • HackerNews Algolia    │ │
                    │  │  • Google Places API     │ │
                    │  │  • Reddit API            │ │
                    │  │  • ProductHunt GraphQL   │ │
                    │  └──────────┬──────────────┘ │
                    │             │                 │
                    │  ┌──────────▼──────────────┐ │
                    │  │   Lead Ingest Pipeline   │ │
                    │  │  1. Normalise schema     │ │
                    │  │  2. Firecrawl enrich     │ │
                    │  │  3. Groq ICP score       │ │
                    │  │  4. Supabase upsert      │ │
                    │  └─────────────────────────┘ │
                    └──────────────────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │         Supabase             │
                    │  leads, outreach_log,        │
                    │  content_pipeline, keywords  │
                    │  competitor_articles,        │
                    │  knowledge_base (pgvector)   │
                    └──────────────────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │   Mac (outreach sender)      │
                    │  outreach.js → Email 1       │
                    │  followup.js → Email 2/3     │
                    │  Gmail SMTP (port 465 open   │
                    │  on residential, blocked VPS)│
                    └──────────────────────────────┘
```

## Why This Split

| Concern | Decision | Reason |
|---------|----------|--------|
| Auth-gated scraping | Local Mac | Residential IP avoids bans; account cookies persist locally |
| Public API scraping | VPS n8n | No IP restriction; runs headlessly 24/7 |
| Email sending | Local Mac | DigitalOcean blocks outbound SMTP ports 25/465/587 |
| AI inference | Free APIs (Groq first) | $0 vs OpenAI's per-token cost; Groq at 14,400 req/day is sufficient |
| Vector database | Supabase pgvector | Already in stack; eliminates Pinecone/Weaviate cost |
| Image generation | Cloudflare Workers AI (Flux) | GPU-hosted, free 10k neurons/day; dropped self-hosted ComfyUI (needs GPU + 24GB) |

## Data Flow: One Lead

```
Source (GitHub / HN / Places / LinkedIn)
    │
    ▼ POST /webhook/lead-ingest
    { name, email, company, domain, title, location,
      source_platform, source_url, raw_bio,
      company_size_signal, scraped_at }
    │
    ▼ Firecrawl /v1/scrape → company website → markdown
    { enriched_description: "Company does X for Y market..." }
    │
    ▼ Groq llama-3.1-8b-instant (JSON mode)
    { icp_score: "PERFECT", numeric_score: 9,
      latam_signal: true, ai_signal: false, growth_signal: true,
      priority_action: "email_track_latam",
      personalization_hook: "Saw you just raised Series A and are eyeing Mexico..." }
    │
    ▼ Supabase upsert (dedup on domain, merge-duplicates)
    leads table ← stored
    │
    ▼ outreach.js (manual / cron on Mac)
    pickTrack(lead) → "latam"
    renderEmail(lead, "latam", step=0) → { subject, body }
    nodemailer → Gmail SMTP → Email 1 sent
    outreach_log ← { lead_id, platform: "email", message_type: "email_1_latam", sent_at }
    leads ← { outreach_status: "email_1_sent" }
    │
    ▼ followup.js (runs at Day 5 and Day 12)
    Email 2 → outreach_status: "email_2_sent"
    Email 3 → outreach_status: "email_3_sent"
```

## n8n Workflow Architecture

All n8n workflows follow the **single Code node pattern**: one Webhook or Schedule trigger feeds into a single Code node that handles all API calls via `this.helpers.httpRequest`. This avoids HTTP Request node expression limitations and keeps error handling centralised.

```
❌ Multi-node (fragile): Webhook → HTTP Request → IF → HTTP Request → Supabase Node → ...
✅ Single Code node:     Webhook → Code (Firecrawl + Groq + Supabase all in JS) → Respond
```

**Critical n8n config required on VPS:**
```yaml
# docker-compose.yml
N8N_BLOCK_ENV_ACCESS_IN_NODE=false   # required: lets Code nodes read $env.GROQ_API_KEY etc.
N8N_RUNNERS_ENABLED=true             # required for Code node execution in n8n 2.x
volumes:
  - n8n_data:/home/node/.n8n         # n8n 2.x path (NOT /home/node/.local/share/n8n)
```

## Free Tier Limits

| Service | Daily/Monthly Limit | Our Usage |
|---------|---------------------|-----------|
| Groq | 14,400 requests/day | ~50 scoring calls/day |
| Firecrawl | 1,000 requests/month | ~1 per new lead |
| Supabase | 500MB DB, 1GB bandwidth | Very low |
| Google Places | 4,000 requests/month | ~200/month |
| GitHub API | 5,000 requests/hour | Negligible |
| HN Algolia | Unlimited | — |
| Cloudflare Workers AI | 10,000 neurons/day | ~20 image generations/day |
