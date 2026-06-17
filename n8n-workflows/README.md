# n8n Workflows

All workflows run on the self-hosted n8n instance at `http://67.207.89.85:5678`.

## How to Import a Workflow

```bash
# From the project root on your Mac:
WORKFLOW_FILE=n8n-workflows/pillar-0-lead-gen/lead-ingest-enrich-score.json
WORKFLOW_ID=leadpipeline0001   # from the "id" field in the JSON

scp $WORKFLOW_FILE root@67.207.89.85:/tmp/workflow.json

ssh root@67.207.89.85 "
  docker cp /tmp/workflow.json n8n-n8n-1:/tmp/ &&
  docker exec n8n-n8n-1 n8n import:workflow --input=/tmp/workflow.json &&
  docker exec n8n-n8n-1 n8n update:workflow --id=${WORKFLOW_ID} --active=true &&
  docker compose -f /root/n8n/docker-compose.yml restart n8n
"
```

A restart is required after import for webhook URLs to register in n8n's internal router.

## Workflow IDs

| File | Workflow ID | Trigger |
|------|-------------|---------|
| `pillar-0-lead-gen/lead-ingest-enrich-score.json` | `leadpipeline0001` | Webhook `POST /webhook/lead-ingest` |
| `pillar-0-lead-gen/github-scraper.json` | `githubscraper001` | Webhook `POST /webhook/scrape/github` |
| `pillar-0-lead-gen/hackernews-scraper.json` | `hnscraper00001` | Schedule (every 6h) + Webhook `POST /webhook/scrape/hackernews` |
| `pillar-0-lead-gen/google-places-scraper.json` | `gplacesscraper1` | Webhook `POST /webhook/scrape/google-places` with optional body |

## Environment Variables Required on VPS

These must be set in `/root/n8n/docker-compose.yml` under `environment:`:

```
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
N8N_RUNNERS_ENABLED=true
GROQ_API_KEY
FIRECRAWL_API_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
GOOGLE_PLACES_API_KEY
GITHUB_TOKEN
```

## Architecture Note

All workflows follow the **single Code node pattern** — one trigger node feeds into a single `n8n-nodes-base.code` node that handles all HTTP calls via `this.helpers.httpRequest`. This is more reliable than chaining multiple HTTP Request nodes because:
- JSON body expressions in n8n HTTP Request nodes can silently fail
- `this.helpers.httpRequest` accepts native JS objects — no serialisation issues
- All logic is in one place, making debugging trivial (one node's output to inspect)
