# Phase 3: Content Production

## What Was Built

Four n8n workflows that replace a content team — one keyword in, full multi-format content out:

1. **Article writer** — keyword → Groq outline → full 1,500–2,000 word HTML article
2. **Social posts** — article → LinkedIn post + Twitter thread (5 tweets)
3. **Image generator** — headline → Cloudflare Flux JPEG (featured image + thumbnail)
4. **Content director** — orchestrator that chains all three above in one HTTP call

Plus the **pipeline orchestrator** (Phase 5) wraps everything including RAG ingest as a single command.

## Workflows

### article-writer.json (`articlewriterv1`)

**Trigger:** `POST /webhook/content/write-article`

**Input:**
```json
{ "keyword": "latam market entry strategy", "pillar": "latam", "word_count": 1500 }
```

**Flow:**
1. Groq `llama-3.3-70b-versatile` (the 70b model — better for long-form writing) generates a structured outline: H2s, key points, expert angle
2. Same model writes the full article in HTML using the outline
3. Stores to `content_pipeline` with `status = 'review'`

**Why 70b here:** the 8b model is fine for classification; for 1,500-word articles with consistent structure and depth, the 70b model produces noticeably better output. It's still free on Groq (14,400 req/day shared limit).

**Fallback chain:** if Groq 70b hits rate limit → Cerebras `llama3.1-70b` → Sambanova `Meta-Llama-3.1-405B-Instruct`.

**Output columns in `content_pipeline`:**
- `article_draft` — full HTML article
- `topic` — article title
- `word_count_target` — target (actual word count may vary)
- `status = 'review'` — set here; you manually change to `'published'` after editing

---

### social-posts.json (`socialpostsv001`)

**Trigger:** `POST /webhook/content/social-posts`

**Input:**
```json
{ "keyword": "latam market entry", "title": "How to Enter LatAm", "article": "<html>..." }
```

**Flow:**
1. Groq `llama-3.1-8b-instant` reads the article and writes a LinkedIn post (150–200 words, thought leadership tone) and a 5-tweet Twitter thread with a hook tweet
2. Updates the matching `content_pipeline` row with `linkedin_post` and `twitter_thread`

**LinkedIn post format:** insight + 3 numbered takeaways + call to action. No hashtag spam.

**Twitter thread format:** tweet 1 is a bold hook claim, tweets 2–5 expand each point, final tweet has the CTA and link.

---

### image-generator.json (`imagegenv00001`)

**Trigger:** `POST /webhook/content/generate-image`

**Input:**
```json
{ "keyword": "latam market entry", "title": "How to Enter LatAm", "style": "featured" }
```

**style:** `"featured"` → 1200×628px (blog header), `"thumbnail"` → 1280×720px (YouTube/video)

**Flow (4-deep fallback chain):**

| Priority | Provider | Model | Notes |
|----------|----------|-------|-------|
| 1 | Cloudflare Workers AI | `@cf/black-forest-labs/flux-1-schnell` | 10k neurons/day free. Returns base64 JPEG. |
| 2 | Google Gemini | Imagen | ~500/day free |
| 3 | Hugging Face Inference | FLUX.1-schnell | Rate-limited free tier |
| 4 | Pollinations.ai | Flux-based | Unlimited, no key needed |

**Cloudflare Flux response format:**
```json
{ "result": { "image": "<base64 JPEG string>" }, "success": true }
```
The Code node base64-decodes `result.image` and stores the JPEG bytes. The workflow responds with the raw image bytes (`Content-Type: image/jpeg`).

**Prompt construction:** the Code node builds a prompt like:
```
Professional blog header image for article titled: "How to Enter the Latin American Market in 2026".
Topic: latam market entry. Style: modern, clean, business/marketing context.
No text overlay. 1200x628 aspect ratio. High quality.
```

---

### content-director.json (`contentdirector1`)

**Trigger:** `POST /webhook/content/produce`

**Input:**
```json
{ "keyword": "b2b gtm strategy", "pillar": "gtm", "word_count": 1500 }
```

**Flow:**
1. Calls `article-writer` webhook → waits for response (article HTML + title)
2. In parallel: calls `social-posts` + `image-generator` (both get the article as input)
3. Calls `doc-ingester` to add the article to the knowledge base (optional, controlled by `ingest_to_rag` flag)
4. Returns a combined JSON with all four outputs

**This is the primary endpoint for content production.** Use `run-pipeline.sh` as the CLI wrapper.

## Image Generation — Key Gotchas

1. **Cloudflare returns JPEG, not PNG.** Base64-decode `result.image` — it is already a JPEG. Do not try to parse it as PNG.
2. **`steps: 4`** is the correct value for Flux Schnell (fast). Higher values aren't supported on this model.
3. **Neurons quota:** Cloudflare charges ~1 neuron per pixel per step. 1024×1024 at 4 steps = ~4M neurons. The free quota is 10k neurons/day = ~2,500 images/day at that size. At the smaller featured image size, the quota is effectively unlimited for this use case.

## Content Pipeline Table

```sql
CREATE TABLE content_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text,
  topic text,               -- article title
  status text DEFAULT 'pending',
  -- flow: 'pending' → 'planned' → 'writing' → 'review' → 'published'
  pillar text,              -- 'latam' | 'ai' | 'gtm' | 'competitor'
  word_count_target int,
  article_draft text,       -- full HTML
  linkedin_post text,
  twitter_thread text,
  newsletter_section text,
  video_script text,
  wordpress_post_id int,
  published_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## Example End-to-End Test

```bash
bash scripts/run-pipeline.sh "latam market entry strategy" latam
# Returns in ~13 seconds:
# - Article: "Crafting a Winning LatAm Market Entry Strategy" (2029 words)
# - LinkedIn post (~180 words)
# - Twitter thread (5 tweets)
# - Featured image (287KB JPEG from Cloudflare Flux)
# - Newsletter section (~600 chars)
# - RAG ingestion: OK (6 chunks stored)
```

## What's Done vs Pending

### Done
- All 4 workflows deployed and tested end-to-end
- Full pipeline runs in ~13 seconds for article + social + image + newsletter + RAG
- Cloudflare Flux verified working (returns 1024×1024 JPEG from free creds)

### Still Pending
- **WordPress publish** — `article-writer` stores to Supabase with `status='review'`; auto-publish to WordPress requires setting `WORDPRESS_URL`, `WORDPRESS_USER`, `WORDPRESS_APP_PASSWORD` in VPS env and adding a publish step to `article-writer.json`
- **Newsletter sending** — Listmonk is deployed; the `newsletter.json` workflow stub needs connecting to Listmonk's campaign API
- **LinkedIn/Twitter auto-post** — posts are generated but not auto-posted; requires LinkedIn OAuth and Twitter API v2 access (rate-limited free tier)
- **Video scripts** — `video_script` column exists; MoneyPrinterTurbo integration not yet built (Phase 7)
