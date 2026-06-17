#!/usr/bin/env node
// Markexis cold-email sender — runs on the Mac (the VPS can't send SMTP).
// Reads scored leads from Supabase, sends via Gmail SMTP, logs to outreach_log.
//
//   node outreach.js --dry-run            preview who would get emailed (no send)
//   node outreach.js --test=you@x.com     send one sample (Track C) to an address
//   node outreach.js --limit=10           actually send Email 1 to up to N qualified leads
//   node outreach.js                      send with default daily cap (50)
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import nodemailer from "nodemailer";
import { pickTrack, renderEmail } from "./lib/templates.js";

// Load the project-root .env (has SUPABASE_*, GMAIL_*), with scrapers/.env as fallback.
const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });
dotenv.config({ path: join(here, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
const FROM_NAME = process.env.GMAIL_FROM_NAME || "Markexis";
const DAILY_CAP = 50;

function args() {
  const a = {};
  for (const x of process.argv.slice(2)) {
    const m = x.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) a[m[1]] = m[2] === undefined ? true : m[2];
  }
  return a;
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function makeTransport() {
  if (!GMAIL_USER || !GMAIL_PASS) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD not set in .env");
  return nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: GMAIL_USER, pass: GMAIL_PASS } });
}

async function main() {
  const a = args();

  // --test: send one sample email to a given address, no DB writes
  if (a.test) {
    const sample = { name: "Alex Rivera", company: "Acme", personalization_hook: "I saw Acme is scaling its GTM", growth_signal: true };
    const mail = renderEmail(sample, "growth", 0);
    const tx = makeTransport();
    await tx.sendMail({ from: `${FROM_NAME} <${GMAIL_USER}>`, to: a.test, subject: mail.subject, text: mail.body });
    console.log(`✓ sample (Track C) sent to ${a.test} — subject: "${mail.subject}"`);
    return;
  }

  const limit = a.limit ? parseInt(a.limit, 10) : DAILY_CAP;
  // Qualified, not yet contacted, and we have an email to send to.
  const leads = await sb(
    `leads?select=id,name,email,company,icp_score,latam_signal,ai_signal,growth_signal,personalization_hook,company_size_signal` +
    `&icp_score=in.(PERFECT,GOOD)&outreach_status=eq.pending&email=not.is.null&order=numeric_score.desc&limit=${limit}`
  );

  if (!leads.length) {
    console.log("No qualified, un-contacted leads with an email address. Nothing to send.");
    console.log("(GitHub leads often lack a public email — those route to LinkedIn DM instead.)");
    return;
  }

  console.log(`${a["dry-run"] ? "[DRY RUN] " : ""}${leads.length} lead(s) to email (cap ${limit}):\n`);
  const tx = a["dry-run"] ? null : makeTransport();
  let sent = 0;

  for (const lead of leads) {
    const track = pickTrack(lead);
    const mail = renderEmail(lead, track, 0);
    console.log(`• ${lead.email}  [${lead.icp_score} / track ${track}]  "${mail.subject}"`);

    if (a["dry-run"]) continue;

    try {
      await tx.sendMail({ from: `${FROM_NAME} <${GMAIL_USER}>`, to: lead.email, subject: mail.subject, text: mail.body });
      await sb("outreach_log", { method: "POST", body: JSON.stringify({
        lead_id: lead.id, platform: "email", message_type: `email_1_${track}`, sent_at: new Date().toISOString(), status: "sent",
      }) });
      await sb(`leads?id=eq.${lead.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ outreach_status: "email_1_sent" }) });
      sent++;
    } catch (e) {
      console.warn(`  ✗ failed: ${e.message}`);
    }
  }
  if (!a["dry-run"]) console.log(`\nDone — ${sent}/${leads.length} sent and logged.`);
}

main().catch((e) => { console.error("[fatal]", e.message); process.exit(1); });
