# Phase 0: Infrastructure Setup

## VPS

- **Provider:** DigitalOcean NYC1
- **Droplet:** 1 vCPU / 2GB RAM / 50GB SSD — $6/month
- **IP:** 67.207.89.85
- **OS:** Ubuntu 24.04 LTS
- **SSH:** `ssh -i ~/.ssh/id_new_droplet root@67.207.89.85`

## Services (all Docker, all running)

| Service | Port | URL | Credentials file |
|---------|------|-----|-----------------|
| n8n | 5678 | http://67.207.89.85:5678 | — (owner set on first launch) |
| SerpBear | 3000 | http://67.207.89.85:3000 | `PHASE0_DEPLOYMENT.secrets.md` |
| Listmonk | 9000 | http://67.207.89.85:9000 | `PHASE0_DEPLOYMENT.secrets.md` |
| MoneyPrinterTurbo API | 8080 | http://67.207.89.85:8080/docs | — |
| MoneyPrinterTurbo UI | 8501 | http://67.207.89.85:8501 | — |

Each service runs as its own Docker Compose stack under `/root/<service>/docker-compose.yml`.

## n8n Docker Compose

Location: `/root/n8n/docker-compose.yml`

**Critical environment variables:**

```yaml
environment:
  - N8N_BLOCK_ENV_ACCESS_IN_NODE=false   # REQUIRED: allows $env.X in Code nodes
  - N8N_RUNNERS_ENABLED=true             # REQUIRED: Code node execution in n8n 2.x
  - GROQ_API_KEY=...
  - FIRECRAWL_API_KEY=...
  - SUPABASE_URL=...
  - SUPABASE_ANON_KEY=...
  - GOOGLE_PLACES_API_KEY=...
  - GITHUB_TOKEN=...

volumes:
  - n8n_data:/home/node/.n8n    # n8n 2.x path — NOT /home/node/.local/share/n8n
```

**n8n 2.x data path fix:** older guides show `/home/node/.local/share/n8n` but n8n 2.x writes to `/home/node/.n8n`. Using the wrong path causes workflows to be lost on `docker compose restart`. Verify with:
```bash
docker exec n8n-n8n-1 ls /home/node/.n8n/
# Should show: database.sqlite  crash.journal  config  binaryData
```

## Firewall

**Problem:** Docker bypasses UFW — `ufw deny 3000` doesn't block Docker-exposed ports because Docker writes to `iptables` directly, before UFW rules are evaluated.

**Solution:** `DOCKER-USER` chain — rules in this chain run before Docker's own rules.

Setup: a systemd service (`/etc/systemd/system/docker-port-firewall.service`) runs `/usr/local/sbin/docker-port-firewall.sh` at boot, which:
1. Reads an IP allowlist from `/etc/docker-port-allowlist.v4`
2. Inserts `DOCKER-USER` iptables rules to ALLOW those IPs on ports 3000, 8080, 8501, 9000
3. Inserts a DROP rule for all other IPs on those ports (except Docker internal networks `172.16.0.0/12`)

**To add a new IP to the allowlist:**
```bash
ssh root@67.207.89.85
echo "YOUR.IP.ADDRESS" >> /etc/docker-port-allowlist.v4
systemctl restart docker-port-firewall
```

Port 5678 (n8n) is publicly accessible intentionally — webhook endpoints need to be reachable by the local Mac scrapers and external triggers.

## Supabase

- **Project:** markexis-cmo (`rslhqtgazcavoimlzxnf`)
- **Region:** Default
- **Extensions enabled:** pgvector 0.8.0 (for Pillar 5 RAG)
- **Tables:** leads, outreach_log, content_pipeline, keywords, competitor_articles, knowledge_base
- Schema SQL: see `CLAUDE.md` → "Supabase Schema" section

## Deploying n8n Workflows

```bash
# From local Mac project root:
WORKFLOW=lead-ingest-enrich-score
scp n8n-workflows/pillar-0-lead-gen/${WORKFLOW}.json root@67.207.89.85:/tmp/

ssh root@67.207.89.85 "
  docker cp /tmp/${WORKFLOW}.json n8n-n8n-1:/tmp/ &&
  docker exec n8n-n8n-1 n8n import:workflow --input=/tmp/${WORKFLOW}.json &&
  docker exec n8n-n8n-1 n8n update:workflow --id=<workflow_id> --active=true &&
  docker compose -f /root/n8n/docker-compose.yml restart n8n
"
```

Workflow JSON files **must have a top-level `"id"` field** — without it, n8n import fails with `SQLITE_CONSTRAINT: NOT NULL constraint failed`.

**Note on `n8n execute --id`:** this command fails while the n8n instance is running because the CLI tries to start its own task broker on port 5679, conflicting with the running instance. Use Webhook or Schedule triggers to run workflows — don't use the CLI execute command.
