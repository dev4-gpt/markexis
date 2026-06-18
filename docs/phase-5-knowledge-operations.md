# Phase 5: Knowledge & Operations

## What Was Built

Three n8n workflows that form the brain of the platform — a RAG knowledge base and a single-command pipeline orchestrator:

1. **Doc ingester** — any URL or raw text → Firecrawl → sentence-boundary chunks → Jina AI embeddings → pgvector
2. **RAG searcher** — natural language query → Jina embed → Supabase vector search → optional Groq synthesis
3. **Pipeline orchestrator** — one webhook: keyword → SEO research → article → social → image → newsletter → RAG ingest

## Why pgvector over a Separate Vector DB

Supabase free tier includes pgvector. All lead data and content is already in Supabase. Using pgvector means zero extra services, zero extra cost, and joins between the knowledge base and the `leads`/`content_pipeline` tables work natively. The downside (slower at very large scale) doesn't matter until the knowledge base exceeds ~100k chunks.

## Workflows

### doc-ingester.json (`docingesterv01`)

**Trigger:** `POST /webhook/ops/ingest-doc`

**Two input modes:**

URL mode:
```json
{ "url": "https://markexis.com", "source": "markexis_website", "doc_type": "company_page" }
```

Raw text mode:
```json
{ "content": "Full text here...", "source": "markexis_deck", "doc_type": "pitch_deck" }
```

**Flow:**
1. If `url` provided: Firecrawl scrapes it (`onlyMainContent: true`, markdown) to get clean text
2. Text is split into chunks — sentence-boundary aware, max 600 chars, 100 char overlap:
   - Tries to break at sentence endings (`. `, `? `, `! `)
   - Falls back to word boundaries if no sentence boundary found in the window
   - Overlap ensures context isn't lost at chunk edges
3. Chunks are batched into groups of 8 and sent to Jina AI embeddings API (`jina-embeddings-v2-base-en`, 768 dimensions)
4. Each chunk + its embedding is inserted into `knowledge_base` via `Promise.allSettled`

**Jina AI:** free tier gives 1M tokens/month. A typical company website is ~5,000 tokens. The entire Markexis content library could be ingested hundreds of times before hitting the limit.

**Embedding model:** `jina-embeddings-v2-base-en` produces 768-dimensional vectors. This must match the `pgvector` column definition (`vector(768)`) and the index type.

---

### rag-searcher.json (`ragsearcherv01`)

**Trigger:** `POST /webhook/ops/rag-search`

**Input:**
```json
{
  "query": "what markets does Markexis help companies enter?",
  "threshold": 0.65,
  "limit": 5,
  "synthesize": true
}
```

- `threshold` (default 0.65): cosine similarity cutoff. Lower = more results but less relevant. For factual brand questions, 0.7+ is better. For exploratory queries, 0.6 works well.
- `limit` (default 5): max chunks to return
- `synthesize` (default true): if true, Groq `llama-3.1-8b-instant` reads the chunks and writes a coherent answer; if false, returns raw chunks

**Flow:**
1. Embeds the query with Jina AI (same model as ingest — consistency required)
2. Calls Supabase RPC `match_knowledge_base`:
   ```sql
   SELECT id, content, source, doc_type,
     1 - (embedding <=> query_embedding) AS similarity
   FROM knowledge_base
   WHERE 1 - (embedding <=> query_embedding) > match_threshold
   ORDER BY embedding <=> query_embedding
   LIMIT match_count;
   ```
3. If `synthesize: true`: sends chunks to Groq with the system prompt "Answer the question using only the provided context"
4. Returns `{ answer, sources[], chunks_used }`

**The Supabase RPC (`match_knowledge_base`) was created as a migration and applied once:**
```sql
CREATE OR REPLACE FUNCTION match_knowledge_base(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (id uuid, content text, source text, doc_type text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT id, content, source, doc_type,
    1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_base
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ivfflat index for fast approximate search (cosine similarity)
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx
  ON knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

The `ivfflat` index with `lists = 100` is appropriate for up to ~1M rows. Below ~10k rows the index doesn't help much (Postgres does sequential scan anyway) but it costs nothing to have it.

---

### pipeline-orchestrator.json (`pipelineorch01`)

**Trigger:** `POST /webhook/ops/run-pipeline`

**Input:**
```json
{
  "keyword": "b2b gtm strategy",
  "pillar": "gtm",
  "skip_seo": false
}
```

**Flow:**
1. **(Optional)** SEO research — POSTs to `/webhook/seo/keyword-research` with the keyword as seed to expand the cluster before writing
2. **Content production** — POSTs to `/webhook/content/produce` (content-director) which chains article-writer → social-posts → image-generator in parallel
3. **RAG ingest** — POSTs the resulting article to `/webhook/ops/ingest-doc` so it becomes searchable in the knowledge base
4. Returns a combined summary of all stages

**All internal calls use `http://localhost:5678/webhook/`** — no internet round-trips, so latency is purely compute time. This is why the full pipeline completes in ~13 seconds despite running 5 sub-workflows.

**CLI wrapper:**
```bash
bash scripts/run-pipeline.sh "b2b gtm strategy" gtm
bash scripts/run-pipeline.sh "latam market entry strategy" latam --skip-seo
```

## Supabase Schema

```sql
CREATE TABLE knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text,            -- the chunk text
  source text,             -- e.g. "markexis_website", "markexis_deck"
  doc_type text,           -- e.g. "company_page", "blog_article", "pitch_deck"
  embedding vector(768),   -- Jina jina-embeddings-v2-base-en output
  created_at timestamptz DEFAULT now()
);
```

## Seeding the Knowledge Base

Run once after deployment to give the RAG system awareness of Markexis's brand:

```bash
# Markexis website pages
for url in https://markexis.com https://markexis.com/about https://markexis.com/services; do
  curl -s -X POST http://67.207.89.85:5678/webhook/ops/ingest-doc \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"$url\",\"source\":\"markexis_website\",\"doc_type\":\"company_page\"}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('chunks_stored','?'), 'chunks from $url')"
  sleep 2
done

# Brand context (paste any internal doc as raw text)
curl -X POST http://67.207.89.85:5678/webhook/ops/ingest-doc \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Markexis is a B2B consulting firm specializing in LatAm market entry, AI marketing implementation, and revenue growth strategy. We serve B2B SaaS, Fintech, Healthtech, and CPG brands with 20-500 employees in the US, Canada, UK, and EU who want to expand into Latin America or implement AI into their marketing and sales workflows.",
    "source": "markexis_brand_brief",
    "doc_type": "brand_context"
  }'
```

Every article produced by the content pipeline is also auto-ingested via the pipeline-orchestrator, so the knowledge base grows automatically with each content run.

## Useful Queries

```sql
-- Knowledge base overview
SELECT doc_type, source, count(*), avg(length(content))::int avg_chars
FROM knowledge_base GROUP BY 1, 2 ORDER BY 3 DESC;

-- Check embeddings are populated (should all be non-null)
SELECT count(*) total, count(embedding) with_embedding FROM knowledge_base;

-- Test similarity manually (paste a vector from Jina output)
-- Not easy to do in SQL directly — use the rag-searcher webhook instead
```

## What's Done vs Pending

### Done
- All 3 workflows deployed and active
- `match_knowledge_base` RPC created and tested in Supabase
- `ivfflat` index on `knowledge_base.embedding`
- Pipeline orchestrator tested end-to-end: keyword → article (2029 words) + LinkedIn + 5 tweets + 287KB image + newsletter + RAG ingest in ~13 seconds
- RAG search tested: query embedded, vector search returned relevant chunks, Groq synthesis produced coherent answer

### Still Pending
- **Seed markexis.com** — run the seeding block above once the site is live
- **Ingest past content** — any existing blog posts, case studies, or decks should be ingested so the RAG system can reference them
- **LinkedIn Multi-Agent System (Phase 6)** — Research Agent and ICP Finder will query the RAG knowledge base to personalise their analysis
- **Doc type filtering** — RAG searcher currently searches all doc types; adding a `?doc_type=blog_article` filter would improve precision for content-specific queries
