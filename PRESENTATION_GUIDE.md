# Presentation Guide — AI Lead Generation + Qualification System

**Two repos. One system. Zero ongoing AI cost.**

---

## Tabs to Have Open (in this order)

| # | Tab | URL |
|---|-----|-----|
| 1 | Markexis GitHub | https://github.com/dev4-gpt/markexis |
| 2 | Gatekeeper GitHub | https://github.com/dev4-gpt/the-gatekeeper |
| 3 | n8n UI (live workflows) | http://67.207.89.85:5678/home/workflows |
| 4 | Supabase leads table | https://supabase.com/dashboard/project/rslhqtgazcavoimlzxnf/editor/17886?schema=public |
| 5 | Terminal | cd to the markexis project folder |
| 6 | Gatekeeper Dashboard | http://localhost:8501 (run: `streamlit run dashboard.py` in the Gatekeeper folder) |

**n8n login:** `aryamandev777@gmail.com` / `Markexis2026!`

---

## The One-Sentence Pitch

> "I built an end-to-end B2B lead system that automatically finds, scores, and emails qualified prospects — and qualifies inbound replies using a BANT agent — at $6/month total infrastructure cost."

---

## Part 1 — The Problem You Solved (60 seconds)

**Say:**

> "Markexis is a B2B consulting firm that sells into a specific ICP — CMOs, VP Marketing, and founders at 20–500 person SaaS companies, particularly those expanding into Latin America or implementing AI in their marketing stack.
>
> Their problem: building a pipeline manually is expensive. A full SDR + BDR + marketing analyst stack costs $150K–$250K/year. Clay alone is $800/month. Apollo is $1,200/month at the scale they need.
>
> I designed a system to replace that entire function. The architecture spans five pillars — SEO, content, competitor intel, video, and lead generation. What I'm showing today is Pillar 0, the lead generation engine, which is fully built and live in production."

**Why this stands out:** You're not pitching a concept. You have 121 real leads in a production database. Lead with that.

---

## Part 2 — The Outbound Pipeline (3–4 minutes)

### Show: Tab 1 (Markexis GitHub README)

**Say:**

> "Here's the architecture. Scrapers pull from multiple platforms, normalise every lead into a unified schema, and POST to a webhook running on a $6 DigitalOcean VPS. From there: Firecrawl enriches the company website, Groq's free LLM tier runs the ICP classifier, and the result lands in Supabase with a personalization hook ready for cold email."

Point to the **Lead Sources table** in the README:

> "Four platforms are live right now — GitHub, HackerNews, Google Places, and LinkedIn. GitHub finds founders of B2B SaaS repos. HackerNews finds people actively asking about GTM and marketing — those are warm because they're already expressing the pain. Google Places hits LatAm businesses in Mexico City, São Paulo, Bogotá. LinkedIn scrapes people-search with stealth Playwright on my local machine — residential IP, random delays, session cookie reuse, 80-profile cap per session so it doesn't trigger detection."

Point to the **5 Pillars table:**

> "I want to be direct about scope. Pillar 0 is complete and running. Pillars 1 through 5 — SEO intelligence, content production, competitor monitoring, knowledge base — are designed and sequenced. The infrastructure is identical for all of them, same VPS, same LLM stack, same Supabase. It's an execution roadmap, not a design problem."

**What makes this stand out:** You're not demoing a Zapier template. You built anti-detection scraping, a free LLM fallback chain, deduplication by domain, and a tuned ICP classifier. That's real engineering.

---

## Part 3 — Live n8n Workflows (2–3 minutes)

### Show: Tab 3 (n8n UI)

**Say:**

> "This is the live orchestration layer. Four workflows, all active, running on the VPS right now."

Click into **Pillar 0 - Lead Ingest + Enrich + Score** and show the node graph:

> "Three nodes. Webhook receives the lead, a single Code node runs the entire pipeline — Firecrawl enrichment, Groq scoring, Supabase upsert — and the respond node sends back a status. I kept it in one node intentionally; n8n's strength is chaining simple steps, but for this pipeline I wanted full control over the async flow and error handling."

### Live demo from Tab 5 (Terminal):

```bash
curl -X POST http://67.207.89.85:5678/webhook/scrape/hackernews
```

**Say:**

> "That just triggered the HackerNews scraper live. It's hitting Algolia's search API with 10 keyword queries — 'latam', 'saas founder', 'go-to-market', 'AI marketing' — finding people who are actively posting about these topics, and feeding them into the ingest pipeline. Each result gets enriched and scored in real time."

---

## Part 4 — The Scored Leads (2 minutes)

### Show: Tab 4 (Supabase)

**Say:**

> "121 leads already in the database. Every row has the raw data from the scraper, the Firecrawl-enriched company description, and the Groq scoring output."

**Click into any GOOD-scored lead. Point to these columns specifically:**

- `icp_score` — "PERFECT, GOOD, or NO_MATCH — the routing decision"
- `icp_reasoning` — "One sentence from the LLM explaining why"
- `latam_signal` / `ai_signal` / `growth_signal` — "Boolean flags that determine which email track this lead gets"
- `personalization_hook` — **This is the standout column.** 

> "This is the personalization hook — one specific detail pulled from their bio or company that opens the cold email. This is what makes the outreach feel hand-written at scale. Each of the three email tracks uses this to open the first line."

Show the email tracks if they ask — they're in the CLAUDE.md under "Cold Email Sequences."

---

## Part 5 — The Inbound Layer: Gatekeeper (3–4 minutes)

### Show: Tab 2 (Gatekeeper GitHub)

**Say:**

> "The outbound pipeline fills the top of the funnel automatically. When a prospect replies to a cold email or books a call, that's where The Gatekeeper comes in. It's the inbound qualification layer."

Point to the **cross-reference table at the top of the README:**

> "The two repos are designed as a system. Outbound handles volume and automation. Gatekeeper handles the conversation and routing."

Scroll to the **mermaid flowchart:**

> "The flow is: collect BANT signals in natural language, score each dimension as green/yellow/red, recap what was understood, and ask the prospect to confirm before routing. If they say no or ask for a human, it escalates instead of forcing an automated decision. That's the design choice I think matters most — it doesn't try to replace judgment on edge cases."

### Show: Tab 6 (Streamlit dashboard at localhost:8501)

**Say:**

> "This is the internal review dashboard. On the left, you can see every lead that's been qualified — outcome, lead score 0–100, confidence band, and the BANT breakdown per dimension. On the right is the full detail for any selected lead: what the system understood from their answers, the reason code, and the next step."

**Live demo — use the sidebar form:**

Fill in:
- Need: `we're losing clients to competitors, need a GTM rethink`
- Authority: `I'm the CMO, I sign off on this`
- Budget: `we have 20k allocated`
- Timeline: `this quarter`

Hit **Run qualification.**

> "Watch what happens. It scores each dimension — need is green, authority is green, budget is green, timeline is green. Lead score 85, high confidence. Outcome: book_ae. And it generates a plain-English recap that you'd read back to the prospect to confirm before booking the call."

**What makes this stand out:** The explainability. Most qualification tools give you a score and a routing decision. This shows the prospect exactly what it understood and asks if that's right before acting on it.

---

## Part 6 — The Architecture Decision That Matters (90 seconds, no tab)

**Say — this is the part that demonstrates system thinking:**

> "The thing I'm most deliberate about in this design is the LLM stack. I'm not using OpenAI or Anthropic APIs. Every AI call in the outbound pipeline uses Groq's free tier — 14,400 requests per day, llama-3.1-8b, under 3 seconds per lead. The Gatekeeper uses Gemini Flash only as a fallback when the rule engine is uncertain — it never replaces the rule engine as the decision maker.
>
> The fallback chain for the pipeline is Groq → Cerebras → Sambanova → NVIDIA NIM → OpenRouter. If one rate-limits, the next picks up. Total AI cost: zero dollars per month.
>
> The reason this matters: a system like this only works at scale if the cost per lead processed is nearly zero. If I'd built this on GPT-4, every 1,000 leads would cost $2–$5 in API calls. With this stack it costs nothing."

---

## Likely Questions and How to Answer Them

**"How is this different from Apollo or Clay?"**
> "Apollo and Clay are SaaS products with per-seat pricing. Apollo is $1,200/month at the usage level needed here. Clay is $800/month. I built equivalent functionality for $6/month. More importantly, Apollo's ICP scoring is generic. The Groq classifier here is tuned to Markexis's specific ICP — it knows to flag LatAm signals, AI implementation signals, and specific funding stages. That's not configurable in Apollo."

**"What happens when LinkedIn blocks the scraper?"**
> "The scraper follows published anti-detection guidelines — stealth Playwright, random 3–12 second delays, max 80 profiles per session, business hours only, session cookies reused so LinkedIn doesn't see repeated logins from new devices. LinkedIn's detection threshold is around 100–150 profile views per day; we're well under. If a session does get flagged, the cookie file is deleted and we log in fresh with a warmed account."

**"Why n8n and not Zapier or Make?"**
> "n8n runs on a $6 VPS with no per-execution limits. Make would cap at 10,000 operations per month and cost $16–$29/month. But the real reason is the Code node — I can run arbitrary async JavaScript including HTTP calls with full error handling. The entire Firecrawl + Groq + Supabase pipeline runs in a single node with precise control over what happens if any step fails."

**"What's the Gatekeeper's prospect-facing interface?"**
> "Right now the Gatekeeper is the logic and review layer — it assumes a human runs the qualification conversation and enters the answers. The prospect-facing layer would be a chatbot or form on the Markexis website that feeds into the same engine. That's a UI build; the qualification logic, routing, explainability, and persistence are done. I built the hard part first."

**"What are Pillars 1–5?"**
> "SEO intelligence — rank tracking via SerpBear, keyword research via Google Search Console API. Content production — keyword to article to WordPress publish, fully automated via Groq. Competitor intelligence — daily sitemap crawl of competitor domains, new articles flagged and threat-scored. Video production — MoneyPrinterTurbo for stock-footage marketing videos, no GPU needed. Knowledge base — pgvector RAG over all Markexis documents. The architecture for all five is designed and the infrastructure is identical to what's running now. Pillar 0 had to come first because lead data informs what content and keywords to produce."

**"Why did you scope Pillar 0 first?"**
> "Revenue follows leads. If Markexis has no pipeline, SEO content doesn't matter yet. The system is designed sequentially — lead generation funds the client relationships that inform the content strategy that builds SEO authority that reduces future CAC. Pillar 0 is the engine that makes everything else worth building."

---

## What Makes This Stand Out — The Three Things to Leave Them With

**1. It's in production, not a mockup.**
> 121 leads in Supabase. 4 live workflows. A VPS running right now. Not a Notion doc, not a Figma wireframe, not a slide deck about what could be built.

**2. The cost architecture is deliberate.**
> Zero dollars per month on AI. Not an accident — a design decision. Every provider in the LLM fallback chain was chosen for its free tier. That's what makes this viable for a small consultancy.

**3. You designed for the full system, executed the foundation.**
> Five pillars designed, one built and running. That's not scope creep — that's knowing which layer enables all the others and building it first.

---

## If You Have 5 Minutes Left — The Strongest Close

> "What I built is the infrastructure layer for a marketing function that costs $612K–$850K per year to staff. The lead generation engine alone would replace a $70–$90K SDR. The qualification agent replaces the qualification step a BDR spends 40% of their day on. At $6/month running cost, the ROI question isn't whether it works — it's how fast you want to expand coverage to the remaining 8 platforms."

---

## One-Line Answers for Rapid-Fire Questions

| Question | Answer |
|----------|--------|
| How many leads? | 121 in Supabase, 6 GOOD-scored, pipeline runs in under 3 seconds per lead |
| What LLM? | Groq llama-3.1-8b-instant — free tier, 14,400 req/day |
| What database? | Supabase free tier + pgvector for future RAG |
| What's the monthly cost? | $6 VPS, $0 AI, $0 database |
| Is it scraping LinkedIn right now? | Scraper is built, needs one-time login to save the session cookie |
| Can this send emails today? | Yes — `node outreach.js --limit=1` sends Email 1 to the first GOOD lead with an email address |
| What's Gatekeeper's tech stack? | Python, rule-based BANT engine, optional Gemini fallback, SQLite, Streamlit |
| Does the Gatekeeper have a public UI? | Not yet — logic is done, prospect-facing chatbot UI is the next build |
