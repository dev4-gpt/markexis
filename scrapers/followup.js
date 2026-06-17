#!/usr/bin/env node
// Markexis follow-up sender — Email 2 (Day 5) and Email 3 (Day 12).
// Runs on Mac; reads from Supabase; sends via Gmail SMTP.
//
//   node followup.js --dry-run            preview who would get emailed
//   node followup.js --limit=10           send follow-ups to up to N leads
//   node followup.js                      send with default daily cap (30)
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import nodemailer from "nodemailer";
import { pickTrack, renderEmail } from "./lib/templates.js";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });
dotenv.config({ path: join(here, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
const FROM_NAME = process.env.GMAIL_FROM_NAME || "Markexis";
const DAILY_CAP = 30;

// Email 2 goes out 5 days after Email 1; Email 3 goes out 12 days after Email 1.
const EMAIL2_DELAY_DAYS = 5;
const EMAIL3_DELAY_DAYS = 12;

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
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

async function getLeadsReadyForStep(step) {
  // step 1 = Email 2 (need email_1 sent 5+ days ago, status=email_1_sent)
  // step 2 = Email 3 (need email_1 sent 12+ days ago, status=email_2_sent)
  const [prevStatus, prevMsgPrefix, delayDays, nextStatus] =
    step === 1
      ? ["email_1_sent", "email_1_", EMAIL2_DELAY_DAYS, "email_2_sent"]
      : ["email_2_sent", "email_1_", EMAIL3_DELAY_DAYS, "email_3_sent"];

  // Get lead_ids where the first email was sent N+ days ago
  const cutoff = daysAgo(delayDays);
  const logRows = await sb(
    `outreach_log?select=lead_id,sent_at,message_type` +
    `&message_type=like.${prevMsgPrefix}%&sent_at=lt.${cutoff}`
  );

  if (!logRows.length) return [];

  // Deduplicate lead_ids (a lead could have multiple log entries if something went wrong)
  const leadIds = [...new Set(logRows.map((r) => r.lead_id))];
  const idList = leadIds.map((id) => `"${id}"`).join(",");

  // Fetch leads that are in the expected prior state and have an email address
  const leads = await sb(
    `leads?select=id,name,email,company,icp_score,latam_signal,ai_signal,growth_signal,personalization_hook,company_size_signal` +
    `&id=in.(${idList})&outreach_status=eq.${prevStatus}&email=not.is.null`
  );

  return leads.map((lead) => ({ ...lead, _nextStatus: nextStatus }));
}

function makeTransport() {
  if (!GMAIL_USER || !GMAIL_PASS) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD not set in .env");
  return nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: GMAIL_USER, pass: GMAIL_PASS } });
}

async function sendFollowUps(leads, step, tx, isDryRun) {
  let sent = 0;
  for (const lead of leads) {
    const track = pickTrack(lead);
    const mail = renderEmail(lead, track, step);
    if (!mail) {
      console.warn(`  ⚠ No template for track=${track} step=${step} — skipping ${lead.email}`);
      continue;
    }

    const emailType = `email_${step + 1}_${track}`;
    console.log(`• ${lead.email}  [${lead.icp_score} / track ${track}]  "${mail.subject}"`);

    if (isDryRun) continue;

    try {
      await tx.sendMail({ from: `${FROM_NAME} <${GMAIL_USER}>`, to: lead.email, subject: mail.subject, text: mail.body });
      await sb("outreach_log", {
        method: "POST",
        body: JSON.stringify({
          lead_id: lead.id, platform: "email", message_type: emailType,
          sent_at: new Date().toISOString(), status: "sent",
        }),
      });
      await sb(`leads?id=eq.${lead.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ outreach_status: lead._nextStatus }),
      });
      sent++;
    } catch (e) {
      console.warn(`  ✗ failed: ${e.message}`);
    }
  }
  return sent;
}

async function main() {
  const a = args();
  const limit = a.limit ? parseInt(a.limit, 10) : DAILY_CAP;
  const isDryRun = !!a["dry-run"];

  if (isDryRun) console.log("[DRY RUN] No emails will be sent.\n");

  let totalSent = 0;

  for (const step of [1, 2]) {
    const emailNum = step + 1;
    const dayNum = step === 1 ? EMAIL2_DELAY_DAYS : EMAIL3_DELAY_DAYS;
    const leads = await getLeadsReadyForStep(step);

    const capped = leads.slice(0, Math.max(0, limit - totalSent));
    if (!capped.length) {
      console.log(`Email ${emailNum} (Day ${dayNum}): no leads ready yet.`);
      continue;
    }

    console.log(`\nEmail ${emailNum} (Day ${dayNum}+) — ${capped.length} lead(s):`);
    const tx = isDryRun ? null : makeTransport();
    const sent = await sendFollowUps(capped, step, tx, isDryRun);
    if (!isDryRun) console.log(`  → ${sent}/${capped.length} sent.`);
    totalSent += sent;

    if (totalSent >= limit) break;
  }

  if (!isDryRun) console.log(`\nDone — ${totalSent} follow-up(s) sent today.`);
}

main().catch((e) => { console.error("[fatal]", e.message); process.exit(1); });
