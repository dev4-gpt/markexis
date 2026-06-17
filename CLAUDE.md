# AI CMO Platform — Markexis Build Context

## What We're Building
A full **AI CMO Platform** for **Markexis** (markexis.com — premium marketing solutions client).
45+ specialized agents across 5 pillars that replace an entire marketing team ($612K–$850K/year headcount).
**Cost constraint: $0/month ongoing.** Everything uses free tiers, open-source, or self-hosted tools.

### The 5 Pillars
1. **SEO Intelligence** — keyword research, rank tracking, site audits, trend monitoring
2. **Content Production** — articles, newsletters, LinkedIn/Twitter posts, video scripts, images
3. **Competitor Intelligence** — sitemap crawling, keyword overlap, threat scoring
4. **Video Production** — AI avatar scripts, thumbnails (avatar video deferred — needs GPU)
5. **Knowledge & Operations** — vector RAG, brand voice, WordPress publishing, pipeline orchestrator

### Plus: Lead Generation Pipeline (Pillar 0)
End-to-end lead scraping → scoring → cold email across 12+ platforms, feeding the CMO machine.

---

## Infrastructure
- **n8n:** `http://67.207.89.85:5678` (self-hosted Docker, Ubuntu 24.04, DigitalOcean NYC1)
- **Server:** 1 vCPU / 2GB RAM — sufficient for n8n orchestration, not for GPU workloads
- **SSH:** `ssh -i ~/.ssh/id_new_droplet root@67.207.89.85`
- **Docker:** `~/n8n/docker-compose.yml`
- **GitHub repo:** `https://github.com/dev4-gpt/n8n`
- **Project folder (local Mac):** current working directory

---

## Complete Free Tool Stack

### AI / LLM — Full Fallback Chain (all $0, all OpenAI-compatible)

All providers below use the same HTTP Request node pattern in n8n — just swap the URL, key, and model name. Build a fallback chain: if Groq rate-limits, route to Cerebras, then Sambanova, then NVIDIA NIM, etc.

| Priority | Provider | Base URL | Best Free Model | Free Limit | Best For |
|----------|----------|----------|-----------------|------------|----------|
| 1 — Primary | **Groq** | `api.groq.com/openai/v1` | `llama-3.1-8b-instant` | 14,400 req/day | Speed, classification, all default tasks |
| 2 — Fallback | **Cerebras** | `api.cerebras.ai/v1` | `llama3.1-70b` | Free tier (generous) | Fastest inference (~900 tok/s), good for long outputs |
| 3 — Fallback | **Sambanova Cloud** | `api.sambanova.ai/v1` | `Meta-Llama-3.1-405B-Instruct` | Free tier | Long context, 405B quality at $0 |
| 4 — Fallback | **NVIDIA NIM** | `integrate.api.nvidia.com/v1` | `meta/llama-3.1-405b-instruct` | Free credits on signup | Largest free models, Nemotron, Mistral |
| 5 — Fallback | **OpenRouter (free)** | `openrouter.ai/api/v1` | `nvidia/nemotron-3-ultra-550b-a55b:free` (or `meta-llama/llama-3.3-70b-instruct:free` for speed) | Rate-limited, $0 | 550B model at $0, 1M ctx — 20+ free models via one key |
| 5.5 — Bonus | **Merge Gateway** | `api-gateway.merge.dev/v1/openai` | `openai/gpt-4o` or `anthropic/claude-sonnet-4-20250514` | Free promo (expires) | GPT-4o + Claude Sonnet + DeepSeek R1 + Mistral + Gemini via one key — 20+ providers. Use for highest-quality tasks while promo lasts |
| 6 — Fallback | **Google Gemini Flash** | Gemini API | `gemini-1.5-flash` | 1,500 req/day | Multimodal tasks (image + text) |
| 7 — Long tasks | **Cloudflare Workers AI** | `api.cloudflare.com/client/v4/accounts/{id}/ai/v1` | `@cf/meta/llama-3.1-8b-instruct` | Free (10k neurons/day) | Lightweight, no rate-limit surprise |
| Local (unlimited) | **Ollama** | `localhost:11434/v1` | `qwen2.5:3b` (already installed) | Unlimited | Mac M-series only — zero API calls |

**API signup URLs:**
- Groq: https://console.groq.com
- Cerebras: https://cloud.cerebras.ai
- Sambanova: https://cloud.sambanova.ai
- NVIDIA NIM: https://build.nvidia.com
- OpenRouter: https://openrouter.ai
- Gemini: https://aistudio.google.com/apikey
- Cloudflare: https://dash.cloudflare.com → AI → Workers AI

**n8n fallback pattern (IF node chain):**
```
Groq HTTP Request → IF error/429 → Cerebras HTTP Request → IF error/429 → Sambanova
```
Or use n8n's built-in Error Trigger to catch rate limit errors and re-route.

**OpenAI-compatible base pattern (works for ALL providers above except Gemini/Cloudflare):**
```json
POST {base_url}/chat/completions
Headers: Authorization: Bearer {{$env.PROVIDER_API_KEY}}
Body: {
  "model": "{model_name}",
  "messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}],
  "temperature": 0.3,
  "max_tokens": 1024
}
```

**Model selection guide:**
- Scoring/classification (fast, high-volume) → Groq `llama-3.1-8b-instant`
- Long article writing (2,000+ words) → Cerebras `llama3.1-70b` or Sambanova `405B`
- Content requiring reasoning → NVIDIA NIM `llama-3.1-405b-instruct`
- Image analysis (thumbnails, screenshots) → Gemini Flash (multimodal)
- Zero-internet tasks → Ollama local

**Never use OpenAI or Anthropic API** — adds cost when the above covers 100% of tasks at $0.

### Scraping & Crawling
| Use | Tool | Cost |
|-----|------|------|
| All platforms needing residential IP | **Crawlee** + **Playwright** — run on local Mac | $0 |
| VPS-safe public scraping | **Crawlee** on VPS (no login needed: G2, Clutch, sitemaps) | $0 |
| Company website enrichment | **Firecrawl** free tier — `api.firecrawl.dev/v1/scrape` | Free (1,000 req/mo) |
| SERP scraping (rank checks) | **ScrapingRobot** free tier | Free (5,000 req/mo) |

### SEO Tools (replaces DataForSEO)
| Use | Tool | GitHub / URL |
|-----|------|------|
| Rank tracking, SERP position | **SerpBear** self-hosted | [towfiqi/serpbear](https://github.com/towfiqi/serpbear) — deploy on VPS via Docker |
| Keyword volume data | **Google Ads Keyword Planner API** | Free with any Google Ads account |
| Real rank + impression data | **Google Search Console API** | Free, direct from Google |
| Full Semrush/Ahrefs alternative | **OpenSEO** | [every-app/open-seo](https://github.com/every-app/open-seo) |
| Trend monitoring | **pytrends** (unofficial Google Trends Python client) | pip install pytrends, no API key |
| Site audits | **Lighthouse CI** (headless, free) | Run via n8n Code node or CLI |

### Image Generation — FREE API fallback chain (replaces self-hosted ComfyUI)

**Decision (2026-06-17): dropped self-hosted ComfyUI/Flux** — it needs a GPU + ~24GB disk on the Mac. Instead use a 4-deep chain of free, GPU-hosted image APIs called directly from n8n on the VPS (no Mac, no disk, $0). Same HTTP Request pattern as the LLM chain — swap URL/key/model on failure. **Verified working: Cloudflare Flux returns a 1024×1024 JPEG from existing creds.**

| Priority | Provider | Model | Free limit | Auth |
|----------|----------|-------|-----------|------|
| 1 — Primary | **Cloudflare Workers AI** | `@cf/black-forest-labs/flux-1-schnell` | 10k neurons/day | `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (set) |
| 2 — Fallback | **Google Gemini** | image generation (Imagen) | ~500/day | `GEMINI_API_KEY` (set) |
| 3 — Fallback | **Hugging Face Inference** | `black-forest-labs/FLUX.1-schnell` or SDXL | rate-limited free | HF account (`dev4-gpt`) |
| 4 — Fallback | **Pollinations.ai** | Flux-based | unlimited-ish, **no key** | none |

**Cloudflare Flux call (primary):**
```
POST https://api.cloudflare.com/client/v4/accounts/{{$env.CLOUDFLARE_ACCOUNT_ID}}/ai/run/@cf/black-forest-labs/flux-1-schnell
Headers: Authorization: Bearer {{$env.CLOUDFLARE_API_TOKEN}}
Body: { "prompt": "<image prompt>", "steps": 4 }
Response: { "result": { "image": "<base64 JPEG>" }, "success": true }
# base64-decode result.image → JPEG bytes (NOT PNG)
```

### Email / Newsletter (replaces paid email platforms)
| Use | Tool | GitHub |
|-----|------|--------|
| Newsletter sending | **Listmonk** self-hosted | [listmonk/listmonk](https://github.com/listmonk/listmonk) — 15k+ stars, Go + PostgreSQL |
| Cold email sequences | n8n → **Gmail SMTP** | Already in stack |
| Email delivery | **Amazon SES** free tier (62k emails/mo free on EC2) or Gmail | $0 |

### Video (replaces HeyGen — fully covered at $0)
| Use | Tool | Notes |
|-----|------|-------|
| **Short marketing videos** (PRIMARY) | **MoneyPrinterTurbo** | [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) — 30k+ stars. **No GPU needed.** Runs on VPS via Docker. REST API callable from n8n. Topic → script → stock footage → TTS voiceover → subtitles → rendered video. |
| MoneyPrinterTurbo LLM | Groq (already in stack) or Ollama | Free, already configured |
| MoneyPrinterTurbo stock footage | **Pexels API** + **Pixabay API** | Both free tiers, no GPU needed |
| MoneyPrinterTurbo TTS | **EdgeTTS** (Microsoft, free) | No API key needed |
| MoneyPrinterTurbo API endpoint | `http://67.207.89.85:8080/docs` | After Docker deploy on VPS — call from n8n HTTP Request node |
| AI avatar video (future) | **HeyGem.ai** | [GuijiAI/HeyGem.ai](https://github.com/GuijiAI/HeyGem.ai) — 12.1k stars. **Needs NVIDIA GPU.** Deferred until GPU available. |
| Free avatar interim | **D-ID** (20 videos/mo) + **Kling AI** (66 credits/mo) | Use while HeyGem deferred |

**MoneyPrinterTurbo Docker deploy on VPS:**
```bash
git clone https://github.com/harry0703/MoneyPrinterTurbo.git
cd MoneyPrinterTurbo
docker-compose up -d
# Web UI: http://67.207.89.85:8501
# API docs: http://67.207.89.85:8080/docs
```

**n8n → MoneyPrinterTurbo API call:**
```
HTTP Request node:
  Method: POST
  URL: http://67.207.89.85:8080/api/v1/videos
  Body: {
    "video_subject": "{{ $json.article_title }}",
    "video_language": "en",
    "voice_name": "en-US-JennyNeural",
    "video_source": "pexels",
    "video_aspect": "16:9"
  }
```

### Database & Vector Store (replaces paid vector DB)
| Use | Tool | Notes |
|-----|------|-------|
| Primary database | **Supabase** free tier | Already in stack |
| Vector embeddings / RAG | **pgvector** (built into Supabase) | Zero extra setup — enable extension in Supabase dashboard |
| Embeddings model | **Jina AI** free API — `api.jina.ai/v1/embeddings` | Free (1M tokens/mo) — no local model needed, no Ollama pull required |

### Content Publishing
| Use | Tool | Notes |
|-----|------|-------|
| WordPress publishing | **WordPress REST API** (built-in) | n8n has native WordPress node |
| Social scheduling | n8n → platform APIs directly | LinkedIn, Twitter, Instagram via HTTP Request nodes |
| Notion content calendar | **Notion API** (free) | n8n has Notion node |

---

## Lead Generation Pipeline (Pillar 0) — Platform Strategy

### Unified Lead Schema
Every scraper outputs this exact shape → POST to `/webhook/lead-ingest`:
```json
{
  "name": "string",
  "email": "string | null",
  "company": "string",
  "domain": "string",
  "title": "string",
  "location": "string",
  "source_platform": "linkedin|instagram|google_maps|reddit|github|producthunt|yelp|twitter|g2|wellfound|facebook|hackernews",
  "source_url": "string",
  "raw_bio": "string",
  "company_size_signal": "1-10|11-50|51-200|201+|unknown",
  "scraped_at": "ISO8601 timestamp"
}
```

### Platform Router
| Platform | Runs On | Method | Cost |
|----------|---------|--------|------|
| Google Maps/Places | VPS (n8n HTTP node) | Google Places API | Free (~4k/mo) |
| Reddit | VPS (n8n HTTP node) | Reddit OAuth API | Free (100 req/min) |
| GitHub | VPS (n8n HTTP node) | GitHub REST API | Free (5k req/hr) |
| ProductHunt | VPS (n8n HTTP node) | GraphQL API | Free |
| Yelp | VPS (n8n HTTP node) | Yelp Fusion API | Free (500/day) |
| HackerNews | VPS (n8n HTTP node) | Official API | Free, unlimited |
| LinkedIn | Local Mac (Crawlee) | Playwright stealth | $0 |
| Instagram | Local Mac (Crawlee) | Playwright | $0 |
| Facebook Groups | Local Mac (Crawlee) | Playwright | $0 |
| Twitter/X | Local Mac (Crawlee) | Playwright (API too limited) | $0 |
| G2 / Clutch / Capterra | Local Mac (Crawlee) | Public pages, no login | $0 |
| AngelList/Wellfound | Local Mac (Crawlee) | Playwright stealth | $0 |

### Crawlee Anti-Detection Rules (non-negotiable)
1. One account per IP — never reuse from different IP
2. Save/reuse cookies — no fresh login each run
3. Random 3–12s delay between actions (never fixed intervals)
4. Max 80–100 profile views/day per account
5. Business hours only: 9am–6pm local
6. Warm up accounts 1–2 weeks before scraping
7. No likes/comments/connects in same session as scraping
8. Use `playwright-extra` + `stealth` plugin always

---

## Reference GitHub Repos (already researched — use these)

### Lead Generation & Outreach
- **Lead scraping + cold email:** [JohnEvansOkyere/lead-generation-and-cold-email-automation](https://github.com/JohnEvansOkyere/lead-generation-and-cold-email-automation) — Google Places → Sheets → GPT email → Gmail. Import `Lead Generation.json` into n8n.
- **Lead scoring orchestrator:** [jeremylongshore/lead-followup-system-n8n](https://github.com/jeremylongshore/lead-followup-system-n8n) — Tally webhook → AI scoring → Airtable → notifications. Scoring: company size (4pt) + timeline (3pt) + role (2pt).
- **Lead qualifier (real estate pattern, reusable):** [ganiru/lead-qualifier-workflow](https://github.com/ganiru/lead-qualifier-workflow) — webhook → cleanup → AI qualify → CRM sync → notification.

### Social Media & Content
- **Social scheduling (Notion → all platforms):** [sumamazaeem/Automating-Social-Media-Posts-with-Notion-n8n](https://github.com/sumamazaeem/Automating-Social-Media-Posts-with-Notion-n8n) — Notion DB → fetch content → upload media → post to LinkedIn/Facebook/Twitter/YouTube/TikTok → mark Done.
- **n8n workflow collection:** [Jharilela/n8n-workflows](https://github.com/Jharilela/n8n-workflows) — assorted workflow templates.
- **More n8n workflows:** [DINAKAR-S/N8N-Workflows](https://github.com/DINAKAR-S/N8N-Workflows)

### AI & Efficiency
- **Token reducer (cut AI costs 63%):** [drona23/claude-token-efficient](https://github.com/drona23/claude-token-efficient) — drop `CLAUDE.md` in project, use `profiles/CLAUDE.agents.md` for agent system prompts.
- **Client onboarding (Node.js + n8n):** [LouisYangga/OnboardingAutomation](https://github.com/LouisYangga/OnboardingAutomation) — API triggers n8n webhook for full onboarding flow.

### LinkedIn Multi-Agent System (GTM Strategist)
4 agents built in n8n — already analyzed from screenshots:
1. **Research Agent** — pulls posts from profiles → Supabase → AI analysis → Miro board
2. **Engagement Alert (Marshal Agent)** — runs every 30min, checks for new posts → Slack notification
3. **ICP Finder** — checks post reactions → ProxyCurl profile enrichment → AI classifier → top 15 to Slack. Replaces Clay+HeyReach ($228/mo).
4. **LinkedIn Coach** — weekly post analysis from select profiles → AI insights → Slack. Has chatbot mode.
Source: https://knowledge.gtmstrategist.com/p/4-ai-agents-for-linkedin-research

---

## Markexis Business Intelligence

### What Markexis Sells
Markexis is a B2B consulting/agency firm. Model: free consultation → paid engagement. Four service lines:
1. **Revenue Growth** — GTM strategy, sales pipeline design, demand generation
2. **LatAm Market Entry** — Market expansion consulting for brands entering Latin America (Mexico, Brazil, Colombia, Argentina, Chile)
3. **AI Implementation** — Integrating AI into marketing and sales workflows responsibly
4. **AI Data & Insights** — Analytics, data-driven decision-making, marketing intelligence

**Positioning:** "We help brands identify opportunities, design an actionable strategy, and connect marketing with sales, integrating Artificial Intelligence responsibly."

**Unique angle:** LatAm market expertise + AI integration. Most GTM consultants don't have deep LatAm coverage. This is the differentiator to lead with in all outreach and content.

---

## Markexis ICP — Full Definition

### PERFECT Match (score: 10) — prioritize immediately
All of the following:
- **Title:** CEO, Founder, CMO, VP Marketing, Chief Revenue Officer, Head of Growth, Marketing Director, VP Sales
- **Company type:** B2B SaaS, Fintech, Healthtech, E-commerce (with B2B component), CPG brand, Tech startup
- **Size:** 20–500 employees (big enough to afford consulting, small enough to need it)
- **Geography:** US, Canada, UK, EU, Australia — companies WANTING to expand into LatAm
- **At least one in-market signal:**
  - Mentions LatAm, Latin America, Mexico, Brazil, Colombia, LATAM expansion
  - OR mentions AI in marketing, marketing automation, GTM strategy, revenue growth
  - OR recently funded (Seed/Series A/B) and needs to deploy capital into growth
  - OR hiring for marketing roles (signal they're scaling)
  - OR complaining about CAC, pipeline, GTM, growth plateaus

### GOOD Match (score: 6–9) — outreach within 48h
- Right title but company type is adjacent (media company, agency client, professional services)
- OR right company type but title is slightly junior (Marketing Manager, Growth Manager)
- OR LatAm-based company (Mexico, Brazil, Colombia) wanting to scale marketing with AI
- OR US company already in LatAm wanting better strategy

### NO_MATCH (score: 1–5) — skip
- Local brick-and-mortar, restaurants, retail with no growth ambition
- Enterprise 5,000+ employees (have in-house teams, too slow to close)
- Pre-revenue, pre-product startups (no budget)
- Competitors: other GTM consultants, marketing agencies
- B2C only consumer brands with no strategic marketing need

---

## Groq ICP Classifier Prompt

Use this exact system prompt in the `scoring.json` n8n workflow:

```
You are a lead qualifier for Markexis — a premium B2B consulting firm specializing in:
1. Revenue Growth & GTM Strategy
2. Latin America Market Entry (Mexico, Brazil, Colombia, Argentina, Chile)
3. AI Implementation in Marketing & Sales
4. AI Data & Insights

Your job: classify incoming leads as PERFECT, GOOD, or NO_MATCH for Markexis's services.

PERFECT (use when 3+ criteria match):
- Title is CEO, Founder, CMO, VP Marketing, CRO, Head of Growth, VP Sales, Marketing Director
- Company is B2B SaaS, Fintech, Healthtech, CPG brand, tech startup, or e-commerce with B2B component
- Company size 20–500 employees
- Based in US, Canada, UK, EU, Australia (or LatAm company wanting to scale)
- Has at least one signal: mentions "Latin America", "LATAM", "Mexico", "Brazil", "Colombia", "AI marketing", "go-to-market", "GTM", "MRR growth", "pipeline", "Series A", "just raised", "scaling", "expanding", "CMO hire", "growth strategy"

GOOD (use when 2 criteria match, or profile is promising but signal is weak):
- Right industry, slightly wrong title (Marketing Manager, Growth Analyst)
- Right title, adjacent industry
- LatAm-based company wanting to improve marketing

NO_MATCH (any of these disqualifies):
- Local business (restaurant, clinic, retail store)
- Enterprise 5,000+ employees
- Pre-revenue or pre-product
- Other marketing agency or consultant (competitor)
- Consumer-only brand with no B2B component
- No budget signals (volunteer org, nonprofit)

Lead data:
Name: {name}
Title: {title}
Company: {company}
Company size: {company_size_signal}
Location: {location}
Bio/Description: {raw_bio}
Enriched company info: {enriched_description}
Source platform: {source_platform}

Respond ONLY with valid JSON — no explanation outside the JSON:
{
  "icp_score": "PERFECT" | "GOOD" | "NO_MATCH",
  "numeric_score": 1-10,
  "reasoning": "One sentence explaining the classification",
  "latam_signal": true | false,
  "ai_signal": true | false,
  "growth_signal": true | false,
  "priority_action": "email_track_latam" | "email_track_ai" | "email_track_growth" | "linkedin_dm" | "skip",
  "personalization_hook": "One specific detail from their bio/company to open the email with"
}
```

---

## Cold Email Sequences

All emails sent via Gmail SMTP from n8n. Max 50 emails/day per Gmail account. Use personalization_hook from Groq scorer.

### Track A — LatAm Expansion (trigger: latam_signal = true)

**Email 1 — Day 1**
```
Subject: {company}'s LatAm play — a few things worth knowing

Hi {first_name},

{personalization_hook} — which is exactly why I'm reaching out.

Latin America is the fastest-growing B2B SaaS market right now, but 70% of US companies that enter do it wrong: they treat it like a US market with a Spanish translation.

At Markexis we've helped [X] brands enter Mexico, Brazil, and Colombia without burning their expansion budget on the wrong channels, wrong messaging, or wrong local partners.

Worth a 20-minute call to walk through what's working in your specific vertical?

[Book a call →]

{signature}
```

**Email 2 — Day 5**
```
Subject: The LatAm mistake most {industry} companies make

Hi {first_name},

Quick follow-up. The most common mistake we see from {industry} companies entering LatAm: assuming the ICP is the same as in the US.

In Mexico City, the decision-maker for {type_of_product} is usually {local_role}, not the CMO. In Brazil, procurement cycles are 40% longer. In Colombia, referral > inbound, always.

We build the GTM playbook around these realities before spending a dollar on paid.

If LatAm is on the roadmap for 2026, it might be worth talking before you lock in the strategy.

[20-min strategy call →]

{signature}
```

**Email 3 — Day 12**
```
Subject: Last note on {company} + LatAm

Hi {first_name},

I'll keep this short — I know your inbox is full.

If LatAm expansion is something {company} is actively planning, we can run a free LatAm Opportunity Audit: identify your top 2 entry markets, flag the 3 biggest risks, and map a 90-day go-to-market plan.

No pitch. If it's useful, great. If not, you've lost 20 minutes.

[Claim your free audit →]

If the timing isn't right, no worries — I'll leave it here.

{signature}
```

---

### Track B — AI Marketing Implementation (trigger: ai_signal = true)

**Email 1 — Day 1**
```
Subject: How {company} could cut CAC by 30–40% with AI in the funnel

Hi {first_name},

{personalization_hook}.

Most marketing teams are using AI for content but leaving the highest-leverage use case untouched: AI-driven lead scoring, pipeline qualification, and campaign optimization that actually closes the gap between marketing and sales.

We've implemented this for B2B SaaS companies and seen CAC drop 30–40% in 90 days — not from more spend, but from smarter routing.

Happy to show you exactly what we'd build for {company}'s stack in a 20-minute walkthrough.

[Book the walkthrough →]

{signature}
```

**Email 2 — Day 5**
```
Subject: Quick AI audit for {company}'s marketing stack

Hi {first_name},

Following up. I don't want to oversell this — AI implementation only works if it's built around your specific funnel, not a generic template.

That's why we start every engagement with a free AI Marketing Audit: map your current stack, identify the 3 highest-ROI AI integrations, and give you a build-vs-buy recommendation.

Takes 30 minutes. You walk away with a concrete roadmap whether you work with us or not.

[Run the free audit →]

{signature}
```

**Email 3 — Day 12**
```
Subject: One last thing on AI + {company}

Hi {first_name},

Last one, I promise.

If you're evaluating AI implementation for your marketing/sales pipeline this year, the biggest risk isn't the tech — it's integrating it in a way that your team actually uses and that maps to revenue.

We've made the mistakes on other people's dime so you don't have to.

If the timing ever works, you know where to find us.

[markexis.com/ai-implementation]

{signature}
```

---

### Track C — Revenue Growth / GTM (trigger: growth_signal = true OR default for PERFECT leads)

**Email 1 — Day 1**
```
Subject: {company}'s pipeline — one question

Hi {first_name},

{personalization_hook}.

One question: is your current marketing-to-sales handoff costing you deals you shouldn't be losing?

It's the most common revenue leak we find at {company_size}-stage B2B companies — qualified leads going cold because the transition from marketing intent to sales follow-up takes too long or loses context.

We fix that. Usually in 60–90 days.

Worth 20 minutes to see if it applies to {company}?

[Book a call →]

{signature}
```

**Email 2 — Day 5**
```
Subject: What's actually blocking {company}'s revenue growth

Hi {first_name},

Following up on my last note.

The three revenue blockers we see most at your stage: (1) ICP drift — targeting too broad, CAC creeping up; (2) funnel leakage — MQL to SQL conversion below 20%; (3) channel over-reliance — 80% of pipeline from 1–2 sources.

Any of those resonate for {company}?

If yes, that's exactly what our Revenue Growth diagnostic uncovers in a free 30-minute session.

[Book the diagnostic →]

{signature}
```

**Email 3 — Day 12**
```
Subject: Closing the loop on {company}

Hi {first_name},

Last email from me.

If growth strategy isn't a priority right now, totally understood. But if you ever hit the point where you're not sure why pipeline has stalled or which channel to double down on — that's exactly the kind of problem we solve.

Free consultation is always open: markexis.com

Good luck with {company},
{signature}
```

---

## Platform-Specific Targeting Queries

### LinkedIn (Crawlee on Mac)
```javascript
// Search queries to run — rotate through all
const LINKEDIN_SEARCHES = [
  // LatAm expansion ICPs
  '"VP Marketing" "Latin America" OR "LATAM" OR "Mexico" OR "Brazil"',
  '"CMO" "expansion" "LatAm" OR "Latin America"',
  '"Head of Growth" "SaaS" "international"',
  // AI marketing ICPs
  '"VP Marketing" "AI" OR "artificial intelligence" "B2B SaaS"',
  '"Chief Marketing Officer" "AI implementation" OR "marketing automation"',
  // Revenue growth ICPs
  '"Head of Growth" "Series A" OR "Series B"',
  '"CMO" "startup" "scaling" OR "growth"',
  '"Founder" "B2B" "go-to-market"',
  // LatAm-based decision makers
  '"CEO" OR "CMO" location:"Mexico City" OR "São Paulo" OR "Bogotá" OR "Buenos Aires"',
];

// Filter: company size 20-500, industries: SaaS, Fintech, Healthtech, E-commerce, CPG
// Exclude: agencies, consultants, enterprises 5000+
```

### Reddit (VPS n8n — HTTP API)
```javascript
// Subreddits to monitor
const REDDIT_TARGETS = [
  { sub: 'SaaS', keywords: ['latam', 'latin america', 'mexico', 'brazil', 'expand', 'international', 'GTM', 'go-to-market', 'marketing help', 'AI marketing'] },
  { sub: 'startups', keywords: ['latam', 'international expansion', 'marketing strategy', 'GTM', 'CAC', 'pipeline', 'series a', 'AI marketing'] },
  { sub: 'entrepreneur', keywords: ['latin america', 'latam market', 'marketing consultant', 'growth strategy', 'AI tools marketing'] },
  { sub: 'b2bmarketing', keywords: ['latam', 'latin america', 'AI implementation', 'GTM strategy', 'pipeline', 'revenue'] },
  { sub: 'marketing', keywords: ['latam expansion', 'AI marketing', 'GTM', 'B2B growth'] },
  { sub: 'digitalnomad', keywords: ['latam business', 'mexico city', 'bogota', 'colombia', 'b2b'] },
];

// Extract: username → check profile for company/title → score → if GOOD+ add to leads
```

### ProductHunt (VPS n8n — GraphQL)
```javascript
// Target: newly launched B2B SaaS products — makers need GTM help immediately
// Query: products launched in last 30 days, upvotes 50+, categories: SaaS, Marketing, Productivity, Dev Tools, AI
// Extract maker profiles → LinkedIn URL → enrich → score
const PH_CATEGORIES = ['saas', 'marketing', 'artificial-intelligence', 'developer-tools', 'productivity', 'fintech'];
const PH_MIN_UPVOTES = 30; // Signal of real traction
```

### GitHub (VPS n8n — REST API)
```javascript
// Target: founders/CTOs of SaaS repos who likely need GTM
// Search: repos with 50-2000 stars, topics: saas, b2b, startup, marketing
// Owner type: User (not org) → likely founder
// Then look up their profile for company/LinkedIn
const GH_QUERIES = [
  'topic:saas stars:50..2000',
  'topic:b2b-saas stars:50..2000',
  'topic:startup stars:100..5000',
  'topic:marketing-automation stars:50..1000',
];
```

### HackerNews (VPS n8n — Official API)
```javascript
// Monitor: Ask HN, Show HN posts
// Keywords: 'latam', 'latin america', 'marketing', 'GTM', 'go-to-market', 'growth', 'CAC', 'B2B'
// Extract: poster username → HN profile → personal site → company
// High-intent: people ASKING about GTM/marketing/LatAm are warm leads
```

### Google Maps / Places (VPS n8n)
```javascript
// For Markexis: less about local scraping, more about finding LatAm businesses
// Search: businesses in target LatAm cities that might want Markexis's reverse service (AI + growth)
// OR: US companies with LatAm office presence (signal they're already expanding)
const PLACES_QUERIES = [
  { query: 'B2B software company', location: 'Mexico City' },
  { query: 'SaaS startup', location: 'São Paulo' },
  { query: 'technology company', location: 'Bogotá' },
  { query: 'fintech startup', location: 'Buenos Aires' },
  { query: 'marketing agency', location: 'Mexico City' }, // potential partners
];
```

---

## SEO & Content Strategy (Pillar 1 + 2)

### Target Keyword Clusters

**Cluster 1 — LatAm Market Entry (highest commercial intent)**
Primary: `latam market entry strategy`
Supporting: `how to enter latin america market`, `b2b saas latin america`, `mexico market entry`, `brazil market expansion`, `go-to-market latam`, `latam gtm strategy`, `latin america business expansion guide`

**Cluster 2 — AI Marketing Implementation**
Primary: `ai implementation marketing`
Supporting: `ai marketing strategy b2b`, `ai sales marketing alignment`, `marketing ai tools saas`, `artificial intelligence marketing automation`, `ai go-to-market`

**Cluster 3 — Revenue Growth / GTM**
Primary: `b2b gtm strategy`
Supporting: `go-to-market consulting`, `revenue growth strategy b2b`, `b2b pipeline strategy`, `saas gtm framework`, `marketing sales alignment`, `cac reduction strategy`, `b2b lead generation strategy`

**Cluster 4 — Competitor Keywords (steal their traffic)**
Primary: `latam expansion consulting`
Supporting: `gtm consulting agency`, `b2b growth consulting`, `revenue growth consultant`

### Competitor Domains to Monitor (Pillar 3)
```
# Add to sitemap-crawler.json — check daily for new content
competitors:
  - gotomarket.io
  - revenuearchitects.com
  - latammarketing.com (if exists)
  - growthcollective.com
  - pavilion.com
  - klique.io
  - demandcurve.com  # high-quality GTM content competitor
  - cxl.com          # content/SEO competitor
  - openviewpartners.com  # PLG/SaaS GTM thought leadership
```

### Content Calendar — 4 Posts/Week on LinkedIn
- **Monday:** LatAm market insight (country-specific data point or trend)
- **Wednesday:** AI in marketing tip (practical, implementation-focused)
- **Friday:** Revenue/GTM framework (tactical thread format)
- **Sunday:** Case study or data point (social proof)

### Blog Topics — Priority Order (by search intent + volume)
1. "How to Enter the Latin American Market in 2026: A B2B SaaS Guide"
2. "AI Marketing Implementation: What Actually Works (And What's Hype)"
3. "Mexico vs Brazil vs Colombia: Which LatAm Market Should You Enter First?"
4. "The B2B GTM Framework That Reduced CAC by 35% in 90 Days"
5. "Marketing-Sales Alignment: Why Your Pipeline is Leaking and How to Fix It"
6. "LatAm Market Entry Mistakes US Companies Make (And How to Avoid Them)"
7. "AI Data & Insights: Building a Marketing Intelligence Stack for $0"
8. "Go-to-Market Strategy for Series A SaaS: A Complete Playbook"

### Video Topics (MoneyPrinterTurbo — stock footage style)
1. "Latin America is the Fastest Growing B2B SaaS Market — Here's Why"
2. "3 Signs Your GTM Strategy is Broken"
3. "How AI is Changing B2B Marketing in 2026"
4. "Mexico Market Entry: What No One Tells You"

---

## Outreach Routing Logic

After scoring, the `outreach-router.json` workflow routes leads:

```
IF icp_score = "PERFECT"
  → assign email track based on priority_action
  → send Email 1 immediately
  → schedule Email 2 at +5 days
  → schedule Email 3 at +12 days
  → also add to LinkedIn DM queue (separate Crawlee task)

IF icp_score = "GOOD"
  → assign email track based on priority_action
  → send Email 1 immediately
  → schedule Email 2 at +7 days
  → no Email 3 (lower priority)

IF icp_score = "NO_MATCH"
  → update outreach_status = 'skipped'
  → stop

EMAIL TRACK ASSIGNMENT:
  latam_signal = true  → email_track_latam
  ai_signal = true AND latam_signal = false → email_track_ai
  growth_signal = true OR default → email_track_growth
  
  If multiple signals: latam > ai > growth (LatAm is Markexis's strongest differentiator)
```

---

## Enrichment Logic (Firecrawl)

When a lead's domain is available, run Firecrawl enrichment before scoring:

```
Extract from company website:
1. Company description (what they actually do)
2. Markets they serve (do they mention LatAm? AI? B2B?)
3. Company size signals (team page count, "we are X people")
4. Funding signals ("backed by", "raised", "investors")
5. Hiring signals (scrape /careers page — hiring for marketing = good signal)
6. Technology signals (look for AI, automation, SaaS keywords)

Feed all of this into {enriched_description} in the Groq classifier prompt.
```

---

## LinkedIn DM Templates (for Crawlee — PERFECT leads only)

**DM 1 — LatAm track**
```
Hi {first_name}, came across {company} and noticed you're {signal}. We work with B2B companies on LatAm market entry — would love to share a few things that have worked in your vertical. Worth a quick chat?
```

**DM 2 — AI track**
```
Hi {first_name}, {personalization_hook}. We help {industry} companies implement AI into their marketing/sales funnel — not the generic stuff, but workflows that actually move pipeline. Open to a 15-min call?
```

Keep DMs under 300 characters. No links in first message. Wait 48h before follow-up if no reply.

---

## Supabase Schema

```sql
-- leads (Pillar 0: lead gen)
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, email text, company text, domain text,
  title text, location text, source_platform text, source_url text,
  raw_bio text, company_size_signal text,
  icp_score text, -- 'PERFECT' | 'GOOD' | 'NO_MATCH'
  icp_reasoning text, enriched_description text,
  outreach_status text DEFAULT 'pending',
  scraped_at timestamptz, created_at timestamptz DEFAULT now(),
  UNIQUE(email), UNIQUE(domain)
);

-- outreach_log
CREATE TABLE outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  platform text, message_type text,
  sent_at timestamptz, status text, reply_received boolean DEFAULT false
);

-- content_pipeline (Pillar 2: content production)
CREATE TABLE content_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text, topic text, status text DEFAULT 'pending',
  -- 'pending' | 'planned' | 'writing' | 'review' | 'published'
  pillar text, word_count_target int,
  article_draft text, linkedin_post text, twitter_thread text,
  newsletter_section text, video_script text,
  wordpress_post_id int, published_url text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- keywords (Pillar 1: SEO)
CREATE TABLE keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text UNIQUE, volume int, kd int, cpc numeric,
  priority_score int, pillar text, cluster text,
  current_position int, previous_position int,
  last_checked timestamptz, created_at timestamptz DEFAULT now()
);

-- competitor_articles (Pillar 3: competitor intel)
CREATE TABLE competitor_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_domain text, url text UNIQUE,
  title text, word_count int, meta_description text,
  detected_at timestamptz, keyword_overlap text[],
  threat_score text, -- 'HIGH' | 'MEDIUM' | 'LOW'
  created_at timestamptz DEFAULT now()
);

-- knowledge_base (Pillar 5: RAG)
CREATE TABLE knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text, source text, doc_type text,
  embedding vector(768), -- pgvector
  created_at timestamptz DEFAULT now()
);
```

---

## File Structure to Build

```
/
├── CLAUDE.md                          ← you are here
├── MARKEXIS_IMPLEMENTATION_PLAN.md   ← full phase-by-phase plan
│
├── scrapers/                          ← Node.js, runs on local Mac
│   ├── package.json                   ← crawlee, playwright-extra, stealth
│   ├── index.js                       ← CLI: node index.js --platform=linkedin --query="CMO Austin"
│   ├── lib/
│   │   ├── schema.js                  ← validateAndNormalize(rawLead) → unified schema
│   │   ├── poster.js                  ← postToN8n(lead) → POST /webhook/lead-ingest
│   │   └── delays.js                  ← humanDelay(min, max) — random 3–12s
│   ├── linkedin.js
│   ├── instagram.js
│   ├── twitter.js
│   ├── wellfound.js
│   └── g2.js                          ← build first (no login, easiest)
│
├── n8n-workflows/                     ← JSON exports — import at 67.207.89.85:5678
│   ├── pillar-0-lead-gen/
│   │   ├── lead-ingest-dedup.json     ← webhook + Supabase dedup
│   │   ├── enrichment.json            ← Firecrawl enrichment
│   │   ├── scoring.json               ← Groq ICP classifier
│   │   ├── outreach-router.json       ← Gmail sequences + DM routing
│   │   ├── google-places-scraper.json
│   │   ├── reddit-scraper.json
│   │   ├── github-scraper.json
│   │   └── producthunt-scraper.json
│   ├── pillar-1-seo/
│   │   ├── rank-tracker.json          ← SerpBear API → Supabase
│   │   ├── keyword-research.json      ← Google Ads API → keyword clusters
│   │   ├── trend-monitor.json         ← pytrends → daily signals
│   │   └── site-audit.json            ← Lighthouse CI → health score
│   ├── pillar-2-content/
│   │   ├── content-director.json      ← orchestrator: keyword → all formats
│   │   ├── article-writer.json        ← Groq → long-form → WordPress
│   │   ├── social-posts.json          ← LinkedIn + Twitter from article
│   │   ├── newsletter.json            ← Listmonk integration
│   │   └── image-generator.json       ← Cloudflare Flux API (free chain) → featured image
│   ├── pillar-3-competitor/
│   │   ├── sitemap-crawler.json       ← crawl competitor sitemaps daily
│   │   ├── content-extractor.json     ← Firecrawl → metadata extraction
│   │   └── threat-assessor.json       ← Groq → threat scoring → Supabase
│   ├── pillar-4-video/
│   │   ├── script-generator.json      ← Groq → video script from article
│   │   └── thumbnail-generator.json   ← Cloudflare Flux API (free chain) → thumbnail image
│   └── pillar-5-ops/
│       ├── doc-ingester.json          ← PDF/URL → chunks → pgvector embeddings
│       ├── rag-searcher.json          ← natural language → pgvector search
│       └── pipeline-orchestrator.json ← keyword → plan → write → publish
│
├── seo/
│   ├── serpbear-docker-compose.yml   ← SerpBear on VPS
│   └── lighthouse-runner.js          ← headless Lighthouse audit script
│
├── email/
│   └── listmonk-docker-compose.yml   ← Listmonk newsletter on VPS
│
└── docker-compose.yml                 ← n8n (already running on VPS)
```

---

## n8n Key Node Patterns

### Groq (use for ALL AI tasks)
```
HTTP Request node:
  Method: POST
  URL: https://api.groq.com/openai/v1/chat/completions
  Headers: Authorization: Bearer {{$env.GROQ_API_KEY}}
  Body (JSON):
    {
      "model": "llama-3.1-8b-instant",
      "messages": [
        {"role": "system", "content": "..."},
        {"role": "user", "content": "{{ $json.prompt }}"}
      ],
      "temperature": 0.3,
      "max_tokens": 1024
    }
```

### Firecrawl (company enrichment)
```
HTTP Request node:
  Method: POST
  URL: https://api.firecrawl.dev/v1/scrape
  Headers: Authorization: Bearer {{$env.FIRECRAWL_API_KEY}}
  Body: { "url": "{{ $json.domain }}", "formats": ["markdown"] }
```

### Supabase (insert lead)
Use n8n's native Supabase node OR HTTP Request to:
```
POST https://[project].supabase.co/rest/v1/leads
Headers:
  apikey: {{$env.SUPABASE_ANON_KEY}}
  Authorization: Bearer {{$env.SUPABASE_ANON_KEY}}
  Content-Type: application/json
  Prefer: resolution=merge-duplicates
```

### SerpBear API (rank data)
```
GET http://67.207.89.85:3000/api/keywords?domain=markexis.com
Headers: Authorization: Bearer {{$env.SERPBEAR_API_KEY}}
```
(Deploy SerpBear on VPS port 3000 via Docker)

### Image generation (Cloudflare Flux — primary of the free 4-deep chain)
```
POST https://api.cloudflare.com/client/v4/accounts/{{$env.CLOUDFLARE_ACCOUNT_ID}}/ai/run/@cf/black-forest-labs/flux-1-schnell
Headers: Authorization: Bearer {{$env.CLOUDFLARE_API_TOKEN}}
Body: { "prompt": "<image prompt>", "steps": 4 }
```
Response: `{ "result": { "image": "<base64 JPEG>" }, "success": true }` — base64-decode `result.image` (JPEG). On 429/error, fall back: Gemini → HuggingFace → Pollinations. See the Image Generation table above.

---

## Build Order (strict — each step enables the next)

### Phase 0 — Foundation (do first, blocks everything)
- [ ] Create Supabase project → run schema SQL above → enable pgvector extension
- [ ] Set env vars on VPS: `GROQ_API_KEY`, `FIRECRAWL_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- [ ] Deploy SerpBear on VPS (`docker-compose` in `seo/serpbear-docker-compose.yml`)
- [ ] Install Listmonk on VPS (`docker-compose` in `email/listmonk-docker-compose.yml`)
- [x] ~~Install ComfyUI + Flux.1 on local Mac~~ DROPPED — use free image API chain (Cloudflare Flux primary) called from n8n. No Mac/GPU/disk needed.
- [ ] Install Ollama on local Mac (`ollama pull llama3.1`, `ollama pull nomic-embed-text`)
- [ ] `scrapers/` Node.js project: `npm init` → install crawlee, playwright-extra, stealth plugin
- [ ] Build `scrapers/lib/schema.js`, `poster.js`, `delays.js`

### Phase 1 — Lead Gen Pipeline (Pillar 0)
- [ ] `scrapers/g2.js` — first scraper (public pages, no auth)
- [ ] n8n: `lead-ingest-dedup.json` — webhook + Supabase dedup
- [ ] n8n: `enrichment.json` — Firecrawl scrape on each new lead
- [ ] n8n: `scoring.json` — Groq ICP classifier (use Markexis ICP above)
- [ ] n8n: `google-places-scraper.json` — Google Places API
- [ ] n8n: `reddit-scraper.json` — Reddit OAuth API
- [ ] n8n: `outreach-router.json` — Gmail cold email sequence
- [ ] `scrapers/linkedin.js` — Crawlee + Playwright stealth

### Phase 2 — SEO Intelligence (Pillar 1)
- [ ] n8n: `keyword-research.json` — Google Ads Keyword Planner API → clusters → Supabase
- [ ] n8n: `rank-tracker.json` — SerpBear API → pull positions → Supabase
- [ ] n8n: `trend-monitor.json` — pytrends HTTP endpoint → rising keywords
- [ ] n8n: `site-audit.json` — Lighthouse headless → health score

### Phase 3 — Content Production (Pillar 2)
- [ ] n8n: `article-writer.json` — keyword → Groq outline → Groq article → WordPress publish
- [ ] n8n: `social-posts.json` — article → LinkedIn post + Twitter thread (Groq)
- [ ] n8n: `image-generator.json` — article headline → Cloudflare Flux API (free chain) → featured image
- [ ] n8n: `newsletter.json` — weekly digest → Listmonk campaign
- [ ] n8n: `content-director.json` — orchestrator that chains all of the above

### Phase 4 — Competitor Intelligence (Pillar 3)
- [ ] n8n: `sitemap-crawler.json` — fetch competitor sitemaps daily → detect new URLs
- [ ] n8n: `content-extractor.json` — Firecrawl new competitor URLs → metadata
- [ ] n8n: `threat-assessor.json` — keyword overlap → Groq threat score → Supabase

### Phase 5 — Knowledge & Operations (Pillar 5)
- [ ] n8n: `doc-ingester.json` — PDF/URL → chunks → Ollama embeddings → pgvector
- [ ] n8n: `rag-searcher.json` — natural language query → pgvector similarity search
- [ ] n8n: `pipeline-orchestrator.json` — one trigger: keyword → SEO → write → image → publish

### Phase 6 — LinkedIn Multi-Agent System
- [ ] n8n: Engagement Alert (Marshal Agent) — every 30min, new posts → Slack
- [ ] n8n: ICP Finder — post reactions → Groq classifier → top 15 to Slack
- [ ] n8n: Research Agent — profiles → post analysis → Miro board
- [ ] n8n: LinkedIn Coach — weekly analysis → Slack + chatbot mode

### Phase 7 — Video (deferred until GPU available)
- [ ] Script generator (Groq — can build now)
- [ ] Thumbnail generator (Cloudflare Flux API — free chain, can build now)
- [ ] HeyGem.ai avatar video — needs NVIDIA GPU (Vast.ai on-demand or dedicated machine)

---

## Environment Variables Needed

```bash
# On VPS — add to ~/n8n/docker-compose.yml environment section

# --- LLM Providers (all free — fill in as you sign up) ---
GROQ_API_KEY=              # console.groq.com — primary
CEREBRAS_API_KEY=          # cloud.cerebras.ai — fallback 1 (fastest inference)
SAMBANOVA_API_KEY=         # cloud.sambanova.ai — fallback 2 (405B free)
NVIDIA_NIM_API_KEY=        # build.nvidia.com — fallback 3 (large models + Nemotron)
OPENROUTER_API_KEY=        # openrouter.ai — fallback 4 (20+ free models)
MERGE_GATEWAY_API_KEY=     # api-gateway.merge.dev — bonus: GPT-4o + Claude Sonnet via promo
GEMINI_API_KEY=            # aistudio.google.com — fallback 5 (multimodal)
CLOUDFLARE_ACCOUNT_ID=     # dash.cloudflare.com → AI
CLOUDFLARE_API_TOKEN=      # Cloudflare Workers AI — fallback 6

# --- LLM Base URLs (for n8n HTTP Request nodes) ---
GROQ_BASE_URL=https://api.groq.com/openai/v1
CEREBRAS_BASE_URL=https://api.cerebras.ai/v1
SAMBANOVA_BASE_URL=https://api.sambanova.ai/v1
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# --- Data & Scraping ---
FIRECRAWL_API_KEY=         # firecrawl.dev — 1,000 req/mo free
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_ANON_KEY=
GOOGLE_PLACES_API_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
YELP_API_KEY=
GITHUB_TOKEN=
PEXELS_API_KEY=            # pexels.com/api — free, for MoneyPrinterTurbo
PIXABAY_API_KEY=           # pixabay.com/api — free, for MoneyPrinterTurbo
JINA_API_KEY=              # jina.ai — free, 1M tokens/mo, for RAG embeddings (replaces nomic-embed-text)

# --- Self-hosted services ---
SERPBEAR_API_KEY=
LISTMONK_API_KEY=

# Local Mac only (scrapers/.env)
N8N_WEBHOOK_URL=http://67.207.89.85:5678/webhook/lead-ingest
OLLAMA_URL=http://localhost:11434
# COMFYUI_URL — removed; image gen now uses the free Cloudflare Flux API chain from n8n
```

### LLM model names reference
```bash
# Use these in n8n HTTP Request body "model" field
GROQ_MODEL=llama-3.1-8b-instant           # or llama-3.3-70b-versatile for harder tasks
CEREBRAS_MODEL=llama3.1-70b
SAMBANOVA_MODEL=Meta-Llama-3.1-405B-Instruct
NVIDIA_MODEL=meta/llama-3.1-405b-instruct  # or nvidia/nemotron-4-340b-instruct
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
GEMINI_MODEL=gemini-1.5-flash
CLOUDFLARE_MODEL=@cf/meta/llama-3.1-8b-instruct
OLLAMA_MODEL=qwen2.5:3b  # already installed on Mac — use for local/offline tasks only
```

---

## Key Decisions Already Made
1. **Groq over OpenAI** — free 14,400 req/day, same quality for classification tasks
2. **Crawlee on Mac** for auth-required platforms — residential IP, avoids VPS IP bans
3. **pgvector in Supabase** for RAG — already in stack, zero extra setup
4. **SerpBear** for rank tracking — replaces DataForSEO rank endpoint completely
5. **HeyGem.ai deferred** — needs NVIDIA GPU; use D-ID/Kling free tiers in interim
6. **Listmonk** for newsletters — self-hosted, 15k stars, production-ready
7. **Free image API chain (Cloudflare Flux → Gemini → HuggingFace → Pollinations)** for images — dropped self-hosted ComfyUI/Flux (needed GPU + 24GB Mac disk). Runs from n8n on VPS, $0, verified working.
8. **Unified lead schema** — all 12 platform scrapers output the same shape to one webhook
9. **Supabase free tier** has all tables + pgvector — no paid DB needed

---

## Reference
- n8n UI: `http://67.207.89.85:5678/home/workflows`
- Supabase dashboard: https://app.supabase.com
- SerpBear (after deploy): `http://67.207.89.85:3000`
- Listmonk (after deploy): `http://67.207.89.85:9000`
- Image generation: Cloudflare Flux API (free chain) — no local service
- Ollama (local Mac): `http://localhost:11434`
