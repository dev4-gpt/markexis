#!/usr/bin/env bash
# run-pipeline.sh — trigger the full content pipeline for a keyword
# Usage:
#   bash scripts/run-pipeline.sh "latam market entry strategy"
#   bash scripts/run-pipeline.sh "b2b gtm strategy" latam
#   bash scripts/run-pipeline.sh "ai marketing implementation" ai --skip-seo
#
# Arguments:
#   $1 — keyword (required)
#   $2 — pillar: latam | ai | gtm (optional, default: gtm)
#   $3 — --skip-seo: skip keyword research step (optional, makes it faster)
#
# What it does:
#   1. Triggers the pipeline-orchestrator webhook on n8n
#   2. Orchestrator calls: keyword-research → content-director → doc-ingester
#   3. content-director calls: article-writer → social-posts + image-generator (parallel) → newsletter
#   4. doc-ingester chunks the article → Jina AI embeddings → pgvector RAG
#   Total time: ~3–5 minutes for a full run

N8N="http://67.207.89.85:5678/webhook"

KEYWORD="${1:-}"
PILLAR="${2:-gtm}"
SKIP_SEO=false

if [[ -z "$KEYWORD" ]]; then
  echo "Usage: bash scripts/run-pipeline.sh \"keyword\" [pillar] [--skip-seo]"
  echo ""
  echo "Examples:"
  echo "  bash scripts/run-pipeline.sh \"latam market entry strategy\" latam"
  echo "  bash scripts/run-pipeline.sh \"ai marketing implementation\" ai"
  echo "  bash scripts/run-pipeline.sh \"b2b gtm strategy\" gtm --skip-seo"
  exit 1
fi

# Check for --skip-seo in any position
for arg in "$@"; do
  if [[ "$arg" == "--skip-seo" ]]; then SKIP_SEO=true; fi
done

echo "=== Markexis Full Content Pipeline ==="
echo "Keyword : $KEYWORD"
echo "Pillar  : $PILLAR"
echo "Skip SEO: $SKIP_SEO"
echo ""
echo "Calling /webhook/ops/run-pipeline ..."
echo "(Expected time: 3–5 minutes)"
echo ""

START=$(date +%s)

RESPONSE=$(curl -s -X POST "${N8N}/ops/run-pipeline" \
  -H "Content-Type: application/json" \
  -d "{
    \"keyword\": $(echo "$KEYWORD" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),
    \"pillar\": \"$PILLAR\",
    \"skip_seo\": $SKIP_SEO
  }" \
  --max-time 360)

END=$(date +%s)
ELAPSED=$((END - START))

if [[ -z "$RESPONSE" ]]; then
  echo "ERROR: No response from n8n (timeout or connection refused)"
  echo "Check: bash scripts/smoke-test.sh"
  exit 1
fi

# Pretty print if jq available, otherwise raw
if command -v jq &>/dev/null; then
  echo "$RESPONSE" | jq .
else
  echo "$RESPONSE"
fi

# Extract ok field
OK=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('ok','?'))" 2>/dev/null)

echo ""
echo "Finished in ${ELAPSED}s"

if [[ "$OK" == "True" || "$OK" == "true" ]]; then
  echo "✓ Pipeline completed successfully"
  echo ""
  echo "Next steps:"
  echo "  • Check Supabase content_pipeline table for the new article"
  echo "  • Review article draft, then set status='published'"
  echo "  • Schedule LinkedIn post from social_posts column"
  echo "  • Search RAG: curl -X POST ${N8N}/ops/rag-search -H 'Content-Type: application/json' -d '{\"query\":\"$KEYWORD\",\"synthesize\":true}'"
else
  echo "✗ Pipeline reported failure — check the response above for which stage failed"
  exit 1
fi
