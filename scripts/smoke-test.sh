#!/usr/bin/env bash
# smoke-test.sh — verify all active webhooks return 200 on the VPS
# Usage: bash scripts/smoke-test.sh
# Run from project root.

N8N="http://67.207.89.85:5678/webhook"

# Format: "webhook/path|human label"
WEBHOOKS=(
  "lead-ingest|Pillar 0  | Lead ingest (normalize → enrich → score → Supabase)"
  "scrape/github|Pillar 0  | GitHub founder scraper"
  "scrape/hackernews|Pillar 0  | HackerNews high-intent scraper"
  "scrape/google-places|Pillar 0  | Google Places LatAm scraper"
  "scrape/reddit|Pillar 0  | Reddit scraper webhook (live scraper runs on Mac via Playwright)"
  "seo/keyword-research|Pillar 1  | Keyword research (Google Suggest → Groq)"
  "content/write-article|Pillar 2  | Article writer (Groq 70b → Supabase)"
  "content/social-posts|Pillar 2  | Social posts (Groq 8b → LinkedIn + Twitter)"
  "content/generate-image|Pillar 2  | Image generator (Cloudflare Flux fallback chain)"
  "content/produce|Pillar 2  | Content director (article + social + image + newsletter)"
  "competitor/run-crawler|Pillar 3  | Sitemap crawler (manual trigger — 8 domains)"
  "competitor/extract|Pillar 3  | Competitor content extractor (Firecrawl)"
  "competitor/assess-threat|Pillar 3  | Threat assessor (Groq → HIGH/MEDIUM/LOW)"
  "ops/ingest-doc|Pillar 5  | Doc ingester (chunks → Jina embeddings → pgvector)"
  "ops/rag-search|Pillar 5  | RAG searcher (Jina embed → pgvector → Groq)"
  "ops/run-pipeline|Pillar 5  | Pipeline orchestrator (keyword → full content → RAG)"
)

echo "=== Markexis n8n Webhook Smoke Test ==="
echo "n8n: $N8N"
echo ""

PASS=0
FAIL=0

# The VPS is 1 vCPU / 2GB with a single n8n runner pool. Firing all webhooks
# back-to-back saturates it and queues requests past the timeout, producing
# false failures. One retry + a short gap between calls reflects real health.
for entry in "${WEBHOOKS[@]}"; do
  path="${entry%%|*}"
  label="${entry#*|}"

  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${N8N}/${path}" \
    -H "Content-Type: application/json" \
    -d '{"_smoke_test":true}' \
    --max-time 20)

  # One retry for a timeout/000 — covers transient runner-pool saturation
  if [[ "$code" != "200" ]]; then
    sleep 2
    code=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "${N8N}/${path}" \
      -H "Content-Type: application/json" \
      -d '{"_smoke_test":true}' \
      --max-time 20)
  fi

  if [[ "$code" == "200" ]]; then
    printf "  ✓ %-38s  %s\n" "/$path" "$label"
    ((PASS++))
  else
    printf "  ✗ %-38s  %s  [HTTP %s]\n" "/$path" "$label" "$code"
    ((FAIL++))
  fi

  sleep 1   # gap between calls keeps the runner pool from saturating
done

echo ""
echo "Result: $PASS passed, $FAIL failed"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "To fix a failed webhook:"
  echo "  1. Check the workflow is active in n8n UI: http://67.207.89.85:5678"
  echo "  2. Re-deploy everything: bash scripts/deploy.sh"
  echo "  3. If still failing: ssh -i ~/.ssh/id_new_droplet root@67.207.89.85 'docker logs n8n-n8n-1 --tail=50'"
  exit 1
fi
