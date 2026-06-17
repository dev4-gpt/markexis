# Markexis — AI CMO Platform: Full Implementation Plan

> Self-hosted n8n at `67.207.89.85:5678` | $0/month ongoing | All tools free/open-source

---

## What Markexis Does (Business Context)

Markexis is a B2B consulting firm selling:
1. **Revenue Growth & GTM Strategy** — pipeline design, demand gen, marketing-sales alignment
2. **LatAm Market Entry** — expansion consulting for brands entering Mexico, Brazil, Colombia, Argentina, Chile
3. **AI Implementation** — integrating AI into marketing/sales workflows
4. **AI Data & Insights** — analytics and marketing intelligence

**Model:** Free consultation → paid consulting engagement  
**Differentiator:** LatAm market expertise + responsible AI integration  
**Target client:** US/EU B2B SaaS, Fintech, Healthtech, CPG brands — 20–500 employees — wanting to grow revenue or expand into LatAm

---

## The Full Platform (6 Pillars)

| Pillar | What it does for Markexis |
|--------|--------------------------|
| **0 — Lead Gen** | Scrapes 12+ platforms, scores against Markexis ICP, sends cold email sequences |
| **1 — SEO** | Ranks for "latam market entry", "ai marketing", "gtm strategy b2b" keywords |
| **2 — Content** | Publishes 4 LinkedIn posts/week + 1 blog/week + newsletter automatically |
| **3 — Competitor Intel** | Monitors DemandCurve, CXL, OpenView, GTM competitors daily |
| **4 — Video** | Auto-generates short marketing videos via MoneyPrinterTurbo |
| **5 — Knowledge & Ops** | RAG over all Markexis content, brand voice enforcement, pipeline orchestrator |

---

## Phase 0 — Foundation (do this first, blocks everything)

### 0A. Supabase Setup
1. Create project at supabase.com → free tier
2. Enable pgvector extension: `create extension if not exists vector;`
3. Run schema SQL (in CLAUDE.md) — creates: leads, outreach_log, content_pipeline, keywords, competitor_articles, knowledge_base
4. Copy SUPABASE_URL and SUPABASE_ANON_KEY

### 0B. VPS Environment Variables
SSH into VPS: `ssh -i ~/.ssh/id_new_droplet root@67.207.89.85`

Add to `~/n8n/docker-compose.yml` under `environment:`:
```yaml
# LLM Providers
- GROQ_API_KEY=          # console.groq.com
- CEREBRAS_API_KEY=      # cloud.cerebras.ai
- SAMBANOVA_API_KEY=     # cloud.sambanova.ai
- NVIDIA_NIM_API_KEY=    # build.nvidia.com
- OPENROUTER_API_KEY=    # openrouter.ai
- GEMINI_API_KEY=        # aistudio.google.com

# Data & Scraping
- FIRECRAWL_API_KEY=     # app.firecrawl.dev
- SUPABASE_URL=
- SUPABASE_ANON_KEY=
- GOOGLE_PLACES_API_KEY= # console.cloud.google.com → Places API
- REDDIT_CLIENT_ID=      # reddit.com/prefs/apps
- REDDIT_CLIENT_SECRET=
- GITHUB_TOKEN=          # github.com/settings/tokens
- PEXELS_API_KEY=        # pexels.com/api
- PIXABAY_API_KEY=       # pixabay.com/api/docs
- SERPBEAR_API_KEY=      # set after SerpBear deploy

# Self-hosted
- LISTMONK_ADMIN_USER=
- LISTMONK_ADMIN_PASSWORD=
```

Then `docker-compose down && docker-compose up -d`

### 0C. Deploy SerpBear (rank tracking)
```bash
mkdir ~/serpbear && cd ~/serpbear
# Use seo/serpbear-docker-compose.yml from project
docker-compose up -d
# Access: http://67.207.89.85:3000
# Add markexis.com domain → add target keywords from CLAUDE.md keyword clusters
```

### 0D. Deploy MoneyPrinterTurbo (video)
```bash
git clone https://github.com/harry0703/MoneyPrinterTurbo.git ~/mpt
cd ~/mpt
# Edit config: set LLM to Groq, add Pexels + Pixabay API keys
docker-compose up -d
# API: http://67.207.89.85:8080/docs
```

### 0E. Deploy Listmonk (newsletter)
```bash
mkdir ~/listmonk && cd ~/listmonk
# Use email/listmonk-docker-compose.yml from project
docker-compose up -d
# Access: http://67.207.89.85:9000
# Set up: Markexis newsletter list, connect Amazon SES or Gmail SMTP
```

### 0F. Local Mac Setup (scrapers)
```bash
cd /path/to/project/scrapers
npm init -y
npm install crawlee playwright-extra playwright-extra-plugin-stealth dotenv axios

# .env file
N8N_WEBHOOK_URL=http://67.207.89.85:5678/webhook/lead-ingest
OLLAMA_URL=http://localhost:11434
COMFYUI_URL=http://localhost:8188
```

Install Ollama: `brew install ollama && ollama pull llama3.1 && ollama pull nomic-embed-text`

---

## Phase 1 — Lead Generation Pipeline (Pillar 0)

**Goal:** Automatically find Markexis ICPs across 12 platforms, score them, enrich them, and send targeted cold email sequences. Zero manual work after setup.

### 1A. Build scrapers/lib/ (Mac — run first)

**`scrapers/lib/schema.js`** — validates and normalizes all raw lead data:
```javascript
const VALID_PLATFORMS = ['linkedin','instagram','google_maps','reddit','github',
  'producthunt','yelp','twitter','g2','wellfound','facebook','hackernews'];

function validateAndNormalize(raw) {
  return {
    name: raw.name?.trim() || null,
    email: raw.email?.toLowerCase().trim() || null,
    company: raw.company?.trim() || null,
    domain: extractDomain(raw.domain || raw.website || ''),
    title: raw.title?.trim() || null,
    location: raw.location?.trim() || null,
    source_platform: VALID_PLATFORMS.includes(raw.source_platform) ? raw.source_platform : null,
    source_url: raw.source_url || null,
    raw_bio: raw.raw_bio?.slice(0, 2000) || null,
    company_size_signal: normalizeSize(raw.company_size_signal),
    scraped_at: new Date().toISOString(),
  };
}
```

**`scrapers/lib/poster.js`** — posts validated leads to n8n:
```javascript
async function postToN8n(lead) {
  const validated = validateAndNormalize(lead);
  if (!validated.name && !validated.email && !validated.company) return; // skip garbage
  await axios.post(process.env.N8N_WEBHOOK_URL, validated);
}
```

**`scrapers/lib/delays.js`** — human-like delays (non-negotiable for anti-detection):
```javascript
const humanDelay = (min = 3000, max = 12000) =>
  new Promise(r => setTimeout(r, Math.random() * (max - min) + min));
const pageDelay = () => humanDelay(2000, 5000);
const actionDelay = () => humanDelay(500, 2000);
```

### 1B. Build scrapers/g2.js (easiest — public pages, no login)
Target: G2, Clutch, Capterra — find companies that listed marketing/AI tools (their buyers are Markexis ICPs)
- Crawl G2 category pages for "GTM Software", "Marketing Analytics", "AI Marketing"
- Extract: company name, website, description, employee count
- Post to n8n webhook

### 1C. n8n: lead-ingest-dedup.json
```
Webhook trigger (POST /webhook/lead-ingest)
→ Supabase: check if email OR domain already exists
→ IF duplicate: stop
→ IF new: INSERT into leads table (status: pending)
→ Trigger enrichment workflow
```

### 1D. n8n: enrichment.json
```
Trigger: new lead inserted
→ IF domain exists: Firecrawl scrape company website
  → Extract: description, team size signals, hiring page, funding mentions, LatAm mentions, AI mentions
  → UPDATE leads SET enriched_description = ...
→ THEN trigger scoring workflow
```

### 1E. n8n: scoring.json — Markexis ICP Classifier
```
Trigger: lead enriched
→ Build prompt using EXACT system prompt from CLAUDE.md "Groq ICP Classifier Prompt" section
→ HTTP Request → Groq API (llama-3.1-8b-instant)
  → IF 429 error: retry with Cerebras
→ Parse JSON response
→ UPDATE leads SET icp_score, numeric_score, reasoning, latam_signal, ai_signal,
    growth_signal, priority_action, personalization_hook
→ IF icp_score != 'NO_MATCH': trigger outreach router
```

### 1F. n8n: outreach-router.json
```
Trigger: lead scored as PERFECT or GOOD
→ Read priority_action field
→ SWITCH:
  'email_track_latam' → load LatAm email sequence (3 emails)
  'email_track_ai'    → load AI email sequence (3 emails)
  'email_track_growth'→ load Growth email sequence (3 emails)
  'linkedin_dm'       → add to LinkedIn DM queue in Supabase (Crawlee picks up)
  'skip'              → stop

→ FOR email tracks:
  Send Email 1 via Gmail SMTP (use exact templates from CLAUDE.md)
  → INSERT into outreach_log
  → Schedule Email 2: Wait node (5 days) → send
  → Schedule Email 3: Wait node (12 days) → send
  → UPDATE leads SET outreach_status = 'contacted'
```

### 1G. n8n: Platform Scrapers (VPS — no login needed)

**google-places-scraper.json** — runs daily 9am
```
Schedule trigger
→ Loop through PLACES_QUERIES from CLAUDE.md targeting queries
→ Google Places API: search each query
→ For each result: extract name, website, phone, address
→ Map to unified schema → POST to /webhook/lead-ingest
```

**reddit-scraper.json** — runs every 6 hours
```
Schedule trigger
→ Loop through REDDIT_TARGETS from CLAUDE.md
→ Reddit OAuth API: search each subreddit + keyword combo
→ For posts/comments: extract username, check their profile for company/title
→ Filter: only users with company/title in profile
→ POST to webhook
```

**github-scraper.json** — runs daily
```
Schedule trigger
→ Loop through GH_QUERIES from CLAUDE.md
→ GitHub API: search repos matching query
→ For each repo owner: GET /users/{owner} → extract company, blog, location, bio
→ POST to webhook
```

**producthunt-scraper.json** — runs daily
```
Schedule trigger
→ ProductHunt GraphQL API: fetch posts from last 30 days, categories in PH_CATEGORIES
→ For each post: get maker profiles → extract name, username, tagline
→ Then enrich via maker's Twitter/website link
→ POST to webhook
```

### 1H. scrapers/linkedin.js (Mac — Crawlee + Playwright stealth)
```
Run: node index.js --platform=linkedin --query="VP Marketing SaaS LatAm"
→ Uses Crawlee + playwright-extra stealth plugin
→ Login with saved session cookies (never re-login from scratch)
→ Execute search queries from LINKEDIN_SEARCHES list
→ For each profile: extract name, title, company, location, about section
→ Apply human delays (3–12s between actions)
→ POST to webhook
→ Max 80 profiles/day per run
```

---

## Phase 2 — SEO Intelligence (Pillar 1)

**Goal:** Rank markexis.com for Markexis's target keywords. Automate keyword research, rank tracking, and site audits.

### 2A. keyword-research.json
```
Manual trigger (run once/week)
→ Google Ads Keyword Planner API: fetch volume + competition for all keywords in CLAUDE.md clusters
→ pytrends: fetch trend data for top 20 keywords
→ UPSERT into keywords table
→ Score each keyword: volume × (1/kd) × commercial_intent_multiplier
→ Slack notification: top 10 opportunities this week
```

### 2B. rank-tracker.json
```
Schedule: daily 7am
→ SerpBear API: GET all keyword positions for markexis.com
→ Compare to previous day
→ UPDATE keywords table (current_position, previous_position)
→ IF any keyword moved ±5 positions: Slack alert
```

### 2C. trend-monitor.json
```
Schedule: daily 8am
→ pytrends HTTP endpoint: fetch rising queries for LatAm market entry, AI marketing, GTM strategy
→ Compare to keyword database
→ IF new trending keyword found: INSERT into keywords with flag 'trending'
→ Trigger content-director to plan an article on it
```

---

## Phase 3 — Content Production (Pillar 2)

**Goal:** Publish 1 blog article/week + 4 LinkedIn posts/week + monthly newsletter — fully automated from keyword input.

### 3A. article-writer.json
```
Trigger: keyword from content_pipeline with status='planned'
→ Groq (llama-3.3-70b-versatile): generate SEO outline
→ Cerebras (llama3.1-70b): write full 1,500–2,500 word article (long output = Cerebras)
→ Groq: generate meta title + meta description
→ WordPress REST API: publish as draft
→ UPDATE content_pipeline SET status='review', article_draft=...
```

**Article writing prompt (paste into n8n system prompt):**
```
You are writing for Markexis — a premium B2B consulting firm specializing in LatAm market entry, AI implementation in marketing, and revenue growth strategy.

Voice: Expert but accessible. Confident, data-backed. No fluff. Targeted at CMOs, VPs of Marketing, and Founders at B2B SaaS companies.

Article requirements:
- Primary keyword: {keyword} — use in H1, first 100 words, 2-3 subheadings
- Length: {word_count_target} words
- Structure: Intro (problem) → 3-5 sections (each solves one aspect) → Conclusion (CTA to book consultation)
- Include: 1-2 specific LatAm data points, 1 real-world example, 1 actionable framework
- CTA at end: "Book a free consultation with Markexis to [specific outcome]"
- Tone: Like a smart consultant who's been in the room, not a content marketer
```

### 3B. social-posts.json
```
Trigger: article published
→ Groq: generate LinkedIn post from article (conversational, 150-250 words, no emojis)
→ Groq: generate Twitter/X thread (5-7 tweets, hook + value + CTA)
→ Store in content_pipeline
→ Schedule via Notion content calendar (sumamazaeem workflow pattern)
```

**LinkedIn post prompt:**
```
You write LinkedIn posts for Markexis, a B2B consulting firm. Style: direct, insight-first, no buzzwords, no "excited to share", no emojis. Start with a specific data point or counterintuitive insight. Format: 3-4 short paragraphs. End with one specific question to drive comments. Max 250 words.
```

### 3C. newsletter.json
```
Schedule: first Monday of each month
→ Pull last month's top 4 articles from WordPress
→ Pull top 3 lead gen stats from Supabase (leads found, emails sent, response rate)
→ Groq: write newsletter intro + article summaries
→ Listmonk API: create campaign → send to list
```

### 3D. image-generator.json
```
Trigger: article published
→ Extract article title + primary keyword
→ ComfyUI API (localhost:8188): generate featured image using Flux.1
  → Prompt: "Professional B2B consulting graphic, dark navy background, {keyword} concept, Markexis brand style, minimal, clean"
→ Upload to WordPress media library → attach to post
```

---

## Phase 4 — Competitor Intelligence (Pillar 3)

**Goal:** Know within 24h when a competitor publishes content on Markexis's target keywords.

### Competitors to monitor daily:
- demandcurve.com (GTM content)
- cxl.com (marketing education)
- openviewpartners.com (PLG/SaaS GTM)
- growthcollective.com (consultant marketplace)
- pavilion.com (GTM community)

### 4A. Firecrawl /monitor setup (replaces sitemap-crawler + content-extractor)

One-time setup — run this script once to create monitors for all competitors:

```javascript
// scripts/setup-competitor-monitors.js
import Firecrawl from "@mendable/firecrawl-js";

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

const COMPETITORS = [
  { name: "DemandCurve", url: "https://www.demandcurve.com/blog" },
  { name: "CXL", url: "https://cxl.com/blog" },
  { name: "OpenView", url: "https://openviewpartners.com/blog" },
  { name: "GrowthCollective", url: "https://growthcollective.com/blog" },
  { name: "Pavilion", url: "https://www.joinpavilion.com/blog" },
];

for (const competitor of COMPETITORS) {
  const monitor = await firecrawl.createMonitor({
    name: `Markexis Competitor — ${competitor.name}`,
    schedule: { text: "daily", timezone: "UTC" },
    goal: "Alert when a new blog post or article is published. Ignore navigation changes, sidebar updates, and UI changes. Only trigger on new article titles appearing.",
    targets: [{
      type: "crawl",           // crawl discovers NEW pages automatically
      url: competitor.url,
      crawlOptions: { limit: 50, maxDiscoveryDepth: 2 },
      scrapeOptions: { formats: ["markdown"] }
    }],
    webhook: {
      url: "http://67.207.89.85:5678/webhook/competitor-change",
      events: ["monitor.page"]  // fires per page, only when isMeaningful = true
    }
  });
  console.log(`Created monitor for ${competitor.name}: ${monitor.id}`);
}
```

**n8n webhook receiver (competitor-change):**
```
Webhook trigger: POST /webhook/competitor-change
→ Parse body: { url, status, isMeaningful, judgment, diff }
→ IF isMeaningful = false: stop (Firecrawl already filtered noise)
→ IF status = "new" OR (status = "changed" AND isMeaningful = true):
  → Extract: url, title from diff.text
  → INSERT into competitor_articles (url, competitor_domain, detected_at)
  → Trigger threat-assessor
```

Key advantages over old approach:
- No polling — Firecrawl pushes to n8n, no scheduled jobs needed
- `crawl` type discovers new pages that didn't exist before (new articles)
- Goal + judging = only meaningful changes fire the webhook (90% fewer tokens)
- `isMeaningful` flag means n8n only processes real new content

### 4B. threat-assessor.json
```
Trigger: competitor article extracted
→ Compare article keywords to Markexis target keyword list
→ Calculate overlap score
→ Groq: classify threat level + recommend Markexis response
  Prompt: "Markexis targets these keywords: {keyword_list}. Competitor published: {title} targeting {keywords}. 
  Classify threat: HIGH (overlaps 3+ target keywords), MEDIUM (1-2 overlap), LOW (no overlap).
  If HIGH: recommend a counter-article topic for Markexis."
→ UPDATE competitor_articles SET threat_score, keyword_overlap
→ IF threat_score = 'HIGH': Slack alert with counter-article suggestion
```

---

## Phase 5 — Knowledge & Operations (Pillar 5)

### 5A. doc-ingester.json
```
Trigger: manual (when new Markexis content added — decks, case studies, blog posts)
→ Firecrawl or PDF parser: extract text
→ Split into 500-token chunks
→ Ollama (nomic-embed-text via Mac): generate embeddings
→ INSERT into knowledge_base with embedding
```

### 5B. rag-searcher.json
```
Trigger: webhook (called by other workflows or chatbot)
Input: { "query": "what does Markexis charge for LatAm consulting?" }
→ Ollama: embed the query
→ Supabase pgvector: similarity search → top 5 chunks
→ Groq: answer question using retrieved chunks + Markexis context
→ Return answer
```

### 5C. pipeline-orchestrator.json
```
Trigger: manual input { "keyword": "latam gtm strategy 2026" }
→ keyword-research (get volume, KD, trend data)
→ content-director decides: should we write this? (score > threshold)
→ article-writer: generate full article
→ image-generator: create featured image
→ WordPress: publish
→ social-posts: generate LinkedIn + Twitter content
→ newsletter: queue for next monthly newsletter
→ Slack: notify "Article published: {title}" with link
```

---

## Phase 6 — LinkedIn Multi-Agent System

### Agent 1: Engagement Alert (Marshal)
```
Schedule: every 30 minutes
→ Crawlee (Mac): check new posts from monitored profiles list
→ IF new post found: Slack notification with preview + URL
→ Helps Markexis team engage fast → boosts organic reach
```

### Agent 2: ICP Finder
```
Schedule: daily after each Markexis LinkedIn post
→ Crawlee (Mac): get list of people who reacted to last post
→ For each reactor: Crawlee scrape their LinkedIn profile
→ POST to /webhook/lead-ingest → normal scoring + outreach pipeline kicks in
→ Top 10 PERFECT matches → Slack with personalized DM suggestions
```

### Agent 3: LinkedIn Coach
```
Schedule: weekly Monday 8am
→ Crawlee (Mac): fetch last 7 days of posts from 5 monitored competitor/inspiration profiles
→ Groq: analyze engagement patterns, best posting times, best formats
→ Slack: "This week's LinkedIn insights for Markexis" + recommended topics
```

---

## Phase 7 — Video Production (Pillar 4)

### Short-Form Marketing Videos (MoneyPrinterTurbo — available now)
```
Trigger: article published
→ Groq: generate 60-second video script from article (hook + 3 points + CTA)
→ MoneyPrinterTurbo API: POST http://67.207.89.85:8080/api/v1/videos
  Body: { "video_subject": "{article_title}", "voice_name": "en-US-JennyNeural", "video_source": "pexels" }
→ Poll for completion
→ Download MP4
→ Upload to YouTube / LinkedIn video post
```

### AI Avatar Video (deferred — needs GPU)
HeyGem.ai (GuijiAI) — defer until NVIDIA GPU available.
Interim: D-ID (20 videos/mo) + Kling AI (66 credits/mo) free tiers.

---

## Build Order (strict sequence)

### Week 1 — Get first leads flowing
- [ ] Phase 0A: Supabase project + schema
- [ ] Phase 0B: VPS env vars (sign up for Groq + Firecrawl + Supabase)
- [ ] Phase 1A: scrapers/lib/ (schema, poster, delays)
- [ ] Phase 1C: lead-ingest-dedup.json in n8n
- [ ] Phase 1D: enrichment.json in n8n
- [ ] Phase 1E: scoring.json with Markexis ICP prompt
- [ ] Phase 1G: reddit-scraper.json (easiest API, no scraping)
- [ ] Phase 1G: github-scraper.json

### Week 2 — Outreach live
- [ ] Phase 1F: outreach-router.json with all 3 email tracks
- [ ] Phase 1B: g2.js scraper (local Mac)
- [ ] Phase 1G: producthunt-scraper.json
- [ ] Phase 1G: google-places-scraper.json

### Week 3 — LinkedIn + content
- [ ] Phase 1H: linkedin.js (Crawlee stealth — hardest, do last)
- [ ] Phase 0C: SerpBear deployed on VPS
- [ ] Phase 2A: keyword-research.json
- [ ] Phase 2B: rank-tracker.json
- [ ] Phase 3A: article-writer.json

### Week 4 — Full automation
- [ ] Phase 3B: social-posts.json
- [ ] Phase 3C: newsletter.json (Listmonk deployed)
- [ ] Phase 4A–4C: competitor intel pipeline
- [ ] Phase 5C: pipeline-orchestrator.json
- [ ] Phase 6: LinkedIn agents
- [ ] Phase 0D: MoneyPrinterTurbo + Phase 7

---

## Success Metrics

After 30 days running:
- **Lead gen:** 200+ leads/week across all platforms, 60%+ scored
- **ICP match rate:** 15–25% PERFECT, 30–40% GOOD
- **Email response rate:** 5–15% (B2B cold email benchmark is 3–8% — Markexis should beat this with personalization)
- **SEO:** 3+ articles published, 20+ target keywords tracked
- **Content:** 12+ LinkedIn posts published
- **Competitor intel:** All 5 competitors monitored daily

---

## Cost Summary

| Category | Tool | Cost |
|----------|------|------|
| AI / LLM | Groq + Cerebras + Sambanova + others | $0 |
| Scraping | Crawlee (self-run) + Firecrawl free | $0 |
| Database | Supabase free tier | $0 |
| SEO | SerpBear + Google APIs | $0 |
| Email | Gmail SMTP + Listmonk | $0 |
| Video | MoneyPrinterTurbo + Pexels/Pixabay | $0 |
| Images | ComfyUI + Flux.1 (local Mac) | $0 |
| VPS | Already running (n8n) | existing |
| **Total** | | **$0/month** |
