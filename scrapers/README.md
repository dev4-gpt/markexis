# Scrapers — Local Mac

Node.js scrapers for platforms that require a residential IP (LinkedIn, Instagram, Twitter, G2, Wellfound). These run on your local Mac, not the VPS.

Auth-gated platforms will immediately flag and ban VPS/datacenter IPs. A logged-in residential connection is required.

## Setup

```bash
cd scrapers
cp ../.env.example .env    # fill in your values
npm install                # installs crawlee, playwright-extra, nodemailer
```

## Available Commands

```bash
# Test the schema wiring (safe, no network calls)
node index.js --selftest

# Outreach
node outreach.js --dry-run          # preview who gets Email 1 (no send)
node outreach.js --test=you@x.com   # send a sample Track C email to yourself
node outreach.js --limit=5          # send Email 1 to up to 5 qualified leads
node outreach.js                    # live send (cap: 50/day)

# Follow-up emails (Day 5 / Day 12)
node followup.js --dry-run          # preview who gets Email 2 or 3
node followup.js --limit=10         # send follow-ups to up to 10 leads
node followup.js                    # live send (cap: 30/day)
```

## Environment Variables

Required in root `.env` (one level up from `scrapers/`):

```
SUPABASE_URL
SUPABASE_ANON_KEY
GMAIL_USER
GMAIL_APP_PASSWORD       # Google Account → Security → App passwords (2FA required)
GMAIL_FROM_NAME
N8N_WEBHOOK_URL          # http://YOUR_VPS:5678/webhook/lead-ingest
```

## Anti-Detection Rules (non-negotiable for LinkedIn/Instagram)

1. One account per IP — never use the same session from a different IP
2. Save and reuse cookies — never log in fresh on each run
3. Random 3–12s delay between actions (use `lib/delays.js`)
4. Max 80–100 profile views per day per account
5. Business hours only: 9am–6pm local time
6. Warm up accounts 1–2 weeks before scraping
7. Never like/comment/connect in the same session as scraping
8. Always use `playwright-extra` + `puppeteer-extra-plugin-stealth`

## Email Tracks

All leads are classified by Groq into signals and routed to a track:

| Track | Trigger | 3-email sequence |
|-------|---------|-----------------|
| A — LatAm | `latam_signal = true` | LatAm expansion opportunity pitch |
| B — AI Marketing | `ai_signal = true` | AI marketing implementation pitch |
| C — Revenue Growth | default (PERFECT leads) | GTM / pipeline / CAC pitch |

Priority: LatAm > AI > Growth. A lead with both `latam_signal` and `ai_signal` goes to Track A.

## Why Email Sends From Mac (Not VPS)

DigitalOcean blocks all outbound SMTP ports (25, 465, 587) at the network level on their NYC1 Droplets. The Mac's residential connection has no such restriction. If you need always-on sending without running the Mac, use an HTTP-based email API (Brevo, Resend) callable from the VPS via port 443.
