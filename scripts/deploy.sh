#!/usr/bin/env bash
# deploy.sh — deploy all n8n workflows to the VPS in one shot
# Usage: bash scripts/deploy.sh
# Run from project root.

set -e

VPS="root@67.207.89.85"
SSH_KEY="$HOME/.ssh/id_new_droplet"
N8N_COMPOSE="/root/n8n"

# Format: "relative/path/to/file.json:workflow-id"
WORKFLOWS=(
  # Pillar 0 — Lead Generation
  "n8n-workflows/pillar-0-lead-gen/lead-ingest-enrich-score.json:leadpipeline0001"
  "n8n-workflows/pillar-0-lead-gen/github-scraper.json:githubscraper001"
  "n8n-workflows/pillar-0-lead-gen/hackernews-scraper.json:hnscraper00001"
  "n8n-workflows/pillar-0-lead-gen/google-places-scraper.json:gplacesscraper1"
  # Pillar 1 — SEO Intelligence
  "n8n-workflows/pillar-1-seo/rank-tracker.json:ranktrackerv001"
  "n8n-workflows/pillar-1-seo/keyword-research.json:keywordresearch1"
  "n8n-workflows/pillar-1-seo/trend-monitor.json:trendmonitor001"
  "n8n-workflows/pillar-1-seo/site-audit.json:siteauditv0001"
  # Pillar 2 — Content Production
  "n8n-workflows/pillar-2-content/article-writer.json:articlewriterv1"
  "n8n-workflows/pillar-2-content/social-posts.json:socialpostsv001"
  "n8n-workflows/pillar-2-content/image-generator.json:imagegenv00001"
  "n8n-workflows/pillar-2-content/content-director.json:contentdirector1"
  # Pillar 3 — Competitor Intelligence
  "n8n-workflows/pillar-3-competitor/sitemap-crawler.json:sitemapcrwlr001"
  "n8n-workflows/pillar-3-competitor/content-extractor.json:contentextract1"
  "n8n-workflows/pillar-3-competitor/threat-assessor.json:threatassess01"
  # Pillar 5 — Knowledge & Operations
  "n8n-workflows/pillar-5-ops/doc-ingester.json:docingesterv01"
  "n8n-workflows/pillar-5-ops/rag-searcher.json:ragsearcherv01"
  "n8n-workflows/pillar-5-ops/pipeline-orchestrator.json:pipelineorch01"
)

echo "=== Markexis n8n Workflow Deployer ==="
echo "VPS    : $VPS"
echo "Count  : ${#WORKFLOWS[@]} workflows"
echo ""

# Step 1: SCP all files to /tmp on VPS host
echo "--- Step 1: Uploading workflow files to VPS ---"
for entry in "${WORKFLOWS[@]}"; do
  filepath="${entry%%:*}"
  if [[ ! -f "$filepath" ]]; then
    echo "  WARN: $filepath not found — skipping"
    continue
  fi
  fname=$(basename "$filepath")
  scp -i "$SSH_KEY" -q "$filepath" "${VPS}:/tmp/${fname}"
  echo "  ↑ $fname"
done

# Step 2: Copy into container, import, activate
echo ""
echo "--- Step 2: Importing + activating in n8n container ---"
for entry in "${WORKFLOWS[@]}"; do
  filepath="${entry%%:*}"
  wfid="${entry##*:}"
  if [[ ! -f "$filepath" ]]; then continue; fi
  fname=$(basename "$filepath")

  result=$(ssh -i "$SSH_KEY" "$VPS" "
    docker cp /tmp/${fname} n8n-n8n-1:/tmp/${fname} 2>&1 &&
    docker exec n8n-n8n-1 n8n import:workflow --input=/tmp/${fname} 2>&1 | tail -1 &&
    docker exec n8n-n8n-1 n8n update:workflow --id=${wfid} --active=true 2>&1 | tail -1
  " 2>&1)

  if echo "$result" | grep -qi "error\|fail"; then
    echo "  ✗ $wfid  — $result"
  else
    echo "  ✓ $wfid  ($fname)"
  fi
done

# Step 3: Restart n8n to register all webhooks at once
echo ""
echo "--- Step 3: Restarting n8n (registers all webhooks) ---"
ssh -i "$SSH_KEY" "$VPS" "cd ${N8N_COMPOSE} && docker compose restart n8n"
echo "  Waiting 25s for n8n to start..."
sleep 25

# Step 4: Smoke test
echo ""
echo "--- Step 4: Smoke test ---"
bash "$(dirname "$0")/smoke-test.sh"

echo ""
echo "=== Deploy complete ==="
