// Posts normalized leads to the n8n lead-ingest webhook.
import { validateAndNormalize } from "./schema.js";

const WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL || "http://67.207.89.85:5678/webhook/lead-ingest";

/**
 * Normalize + POST a single lead to n8n.
 * Returns { ok, status, lead }. Never throws on HTTP errors — logs and reports
 * so a long scrape run isn't killed by one bad lead.
 */
export async function postToN8n(rawLead, { retries = 2 } = {}) {
  let lead;
  try {
    lead = validateAndNormalize(rawLead);
  } catch (err) {
    console.warn(`[poster] skipped invalid lead: ${err.message}`);
    return { ok: false, status: 0, error: err.message, lead: rawLead };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
      if (res.ok) {
        console.log(`[poster] ✓ ${lead.source_platform} | ${lead.company || lead.source_url}`);
        return { ok: true, status: res.status, lead };
      }
      console.warn(`[poster] HTTP ${res.status} (attempt ${attempt + 1}/${retries + 1})`);
    } catch (err) {
      console.warn(`[poster] network error (attempt ${attempt + 1}/${retries + 1}): ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  return { ok: false, status: -1, error: "max retries exceeded", lead };
}

/** Post an array of leads sequentially. Returns a {sent, failed} summary. */
export async function postBatch(leads = []) {
  let sent = 0, failed = 0;
  for (const l of leads) {
    const r = await postToN8n(l);
    r.ok ? sent++ : failed++;
  }
  console.log(`[poster] batch done — sent: ${sent}, failed: ${failed}`);
  return { sent, failed };
}
