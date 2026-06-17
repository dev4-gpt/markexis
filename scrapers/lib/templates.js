// Cold email sequences for Markexis. Tracks A (LatAm), B (AI), C (Growth).
// Placeholders: {first_name} {company} {industry} {personalization_hook} {signature}
// Each track has 3 emails (Day 1 / 5 / 12). Step index: 0,1,2.

export const SIGNATURE = `Best,
The Markexis Team
markexis.com`;

const TRACKS = {
  latam: [
    { subject: "{company}'s LatAm play — a few things worth knowing",
      body: `Hi {first_name},

{personalization_hook} — which is exactly why I'm reaching out.

Latin America is the fastest-growing B2B SaaS market right now, but 70% of US companies that enter do it wrong: they treat it like a US market with a Spanish translation.

At Markexis we've helped brands enter Mexico, Brazil, and Colombia without burning their expansion budget on the wrong channels, messaging, or local partners.

Worth a 20-minute call to walk through what's working in your specific vertical?

{signature}` },
    { subject: "The LatAm mistake most {industry} companies make",
      body: `Hi {first_name},

Quick follow-up. The most common mistake we see from {industry} companies entering LatAm: assuming the ICP is the same as in the US.

In Mexico City the decision-maker is often not the CMO. In Brazil procurement cycles are 40% longer. In Colombia referral beats inbound, always.

We build the GTM playbook around these realities before spending a dollar on paid.

If LatAm is on the roadmap, it might be worth talking before you lock in the strategy.

{signature}` },
    { subject: "Last note on {company} + LatAm",
      body: `Hi {first_name},

I'll keep this short.

If LatAm expansion is something {company} is actively planning, we can run a free LatAm Opportunity Audit: your top 2 entry markets, the 3 biggest risks, and a 90-day go-to-market plan.

No pitch. If it's useful, great. If not, you've lost 20 minutes.

If the timing isn't right, no worries — I'll leave it here.

{signature}` },
  ],
  ai: [
    { subject: "How {company} could cut CAC 30–40% with AI in the funnel",
      body: `Hi {first_name},

{personalization_hook}.

Most marketing teams use AI for content but leave the highest-leverage use case untouched: AI-driven lead scoring, pipeline qualification, and campaign optimization that actually closes the gap between marketing and sales.

We've implemented this for B2B SaaS companies and seen CAC drop 30–40% in 90 days — not from more spend, but smarter routing.

Happy to show you what we'd build for {company}'s stack in a 20-minute walkthrough.

{signature}` },
    { subject: "Quick AI audit for {company}'s marketing stack",
      body: `Hi {first_name},

Following up. AI implementation only works if it's built around your specific funnel, not a generic template.

That's why we start every engagement with a free AI Marketing Audit: map your current stack, identify the 3 highest-ROI AI integrations, and give you a build-vs-buy recommendation.

Takes 30 minutes. You walk away with a concrete roadmap whether you work with us or not.

{signature}` },
    { subject: "One last thing on AI + {company}",
      body: `Hi {first_name},

Last one, I promise.

If you're evaluating AI for your marketing/sales pipeline this year, the biggest risk isn't the tech — it's integrating it in a way your team actually uses and that maps to revenue.

We've made the mistakes on other people's dime so you don't have to.

If the timing ever works, you know where to find us.

{signature}` },
  ],
  growth: [
    { subject: "{company}'s pipeline — one question",
      body: `Hi {first_name},

{personalization_hook}.

One question: is your current marketing-to-sales handoff costing you deals you shouldn't be losing?

It's the most common revenue leak we find at B2B companies your size — qualified leads going cold because the transition from marketing intent to sales follow-up takes too long or loses context.

We fix that. Usually in 60–90 days.

Worth 20 minutes to see if it applies to {company}?

{signature}` },
    { subject: "What's actually blocking {company}'s revenue growth",
      body: `Hi {first_name},

Following up. The three revenue blockers we see most at your stage: (1) ICP drift — targeting too broad, CAC creeping up; (2) funnel leakage — MQL→SQL below 20%; (3) channel over-reliance — 80% of pipeline from 1–2 sources.

Any of those resonate for {company}?

That's exactly what our free 30-minute Revenue Growth diagnostic uncovers.

{signature}` },
    { subject: "Closing the loop on {company}",
      body: `Hi {first_name},

Last email from me.

If growth strategy isn't a priority right now, totally understood. But if you ever hit the point where you're not sure why pipeline has stalled or which channel to double down on — that's exactly what we solve.

Free consultation is always open: markexis.com

{signature}` },
  ],
};

/** Pick the track from the lead's signals. Priority: latam > ai > growth. */
export function pickTrack(lead) {
  if (lead.latam_signal) return "latam";
  if (lead.ai_signal) return "ai";
  return "growth";
}

/** Render email at step (0=Day1, 1=Day5, 2=Day12) for a lead. */
export function renderEmail(lead, track, step) {
  const tpl = TRACKS[track]?.[step];
  if (!tpl) return null;
  const first = (lead.name || "there").trim().split(/\s+/)[0];
  const vars = {
    first_name: first,
    company: lead.company || "your company",
    industry: lead.company_size_signal && lead.company_size_signal !== "unknown" ? "B2B" : "B2B",
    personalization_hook: lead.personalization_hook || `I came across ${lead.company || "your company"}`,
    signature: SIGNATURE,
  };
  const fill = (s) => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
  return { subject: fill(tpl.subject), body: fill(tpl.body), track, step };
}

export const TRACK_NAMES = Object.keys(TRACKS);
