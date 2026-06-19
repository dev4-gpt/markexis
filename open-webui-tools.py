"""
Markexis AI CMO Tools for Open WebUI
Upload this file at: Open WebUI → Settings → Tools → (+) New Tool

These tools let the AI call n8n workflows directly from chat.
Examples:
  "Write an article about LatAm market entry"
  "Show me a summary of our leads"
  "Scrape GitHub for new founders"
  "What do we know about LatAm expansion?"
  "Run keyword research for AI marketing"
"""

import os
import requests
from collections import Counter


N8N = "http://localhost:5678/webhook"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "")


class Tools:
    def __init__(self):
        pass

    def run_content_pipeline(self, keyword: str, pillar: str = "gtm") -> str:
        """
        Generate a full article + LinkedIn post + Twitter thread + featured image for a keyword.
        Stores everything to the content_pipeline table for review.
        :param keyword: The topic or keyword to write about, e.g. 'latam market entry strategy'
        :param pillar: Content pillar — 'latam', 'ai', or 'gtm'
        :return: Article title, word count, and confirmation it was stored
        """
        try:
            res = requests.post(
                f"{N8N}/ops/run-pipeline",
                json={"keyword": keyword, "pillar": pillar, "skip_seo": True},
                timeout=120,
            )
            d = res.json()
            if not d.get("ok"):
                return f"Pipeline failed: {d.get('stages', d)}"
            art = d.get("stages", {}).get("content_production", {}).get("summary", {}).get("article", {})
            chunks = d.get("stages", {}).get("rag_ingestion", {}).get("chunks_stored", "?")
            return (
                f"✅ Done in {d.get('total_elapsed_seconds')}s\n"
                f"Article: \"{art.get('title', '?')}\" ({art.get('words', '?')} words)\n"
                f"Social posts: LinkedIn + Twitter thread generated\n"
                f"Image: generated via Cloudflare Flux\n"
                f"RAG: {chunks} chunks stored to knowledge base\n"
                f"Status: 'review' — open Supabase → content_pipeline to publish"
            )
        except Exception as e:
            return f"Error calling pipeline: {e}"

    def search_knowledge_base(self, query: str) -> str:
        """
        Search Markexis's internal knowledge base using semantic RAG search.
        Use this for questions about Markexis services, brand voice, past content, or strategy.
        :param query: Natural language question, e.g. 'what markets does Markexis help companies enter?'
        :return: Synthesized answer drawn from the knowledge base
        """
        try:
            res = requests.post(
                f"{N8N}/ops/rag-search",
                json={"query": query, "synthesize": True, "limit": 5, "threshold": 0.6},
                timeout=30,
            )
            d = res.json()
            answer = d.get("answer") or d.get("results") or str(d)
            sources = d.get("sources", [])
            out = answer
            if sources:
                out += f"\n\nSources: {', '.join(s.get('source', '?') for s in sources[:3])}"
            return out
        except Exception as e:
            return f"Error searching knowledge base: {e}"

    def get_leads_summary(self) -> str:
        """
        Get a live summary of leads in the Supabase database — counts by platform and ICP score.
        Also shows top PERFECT/GOOD leads ready for outreach.
        :return: Lead counts breakdown and top leads
        """
        if not SUPABASE_URL:
            return "SUPABASE_URL not set in environment"
        try:
            res = requests.get(
                f"{SUPABASE_URL}/rest/v1/leads"
                "?select=name,company,title,source_platform,icp_score,outreach_status"
                "&order=created_at.desc&limit=200",
                headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
                timeout=10,
            )
            leads = res.json()
            if not isinstance(leads, list):
                return f"Error: {leads}"

            total = len(leads)
            by_score = Counter(l["icp_score"] for l in leads)
            by_platform = Counter(l["source_platform"] for l in leads)
            top = [l for l in leads if l["icp_score"] in ("PERFECT", "GOOD")][:5]

            lines = [
                f"**Total leads: {total}**",
                "",
                "**By score:**",
            ]
            for score in ("PERFECT", "GOOD", "NO_MATCH"):
                if by_score.get(score):
                    lines.append(f"  {score}: {by_score[score]}")
            lines += ["", "**By platform:**"]
            for platform, count in by_score.most_common():
                pass
            for platform, count in sorted(by_platform.items(), key=lambda x: -x[1]):
                lines.append(f"  {platform}: {count}")
            if top:
                lines += ["", "**Top leads (PERFECT/GOOD, pending outreach):**"]
                for l in top:
                    lines.append(f"  • {l['name']} — {l.get('title','?')} @ {l.get('company','?')} [{l['source_platform']}]")
            return "\n".join(lines)
        except Exception as e:
            return f"Error fetching leads: {e}"

    def trigger_scraper(self, platform: str) -> str:
        """
        Trigger a lead scraper to find new leads and ingest them into Supabase.
        :param platform: Which platform to scrape — 'github', 'hackernews', or 'google-places'
        :return: How many leads were scraped
        """
        valid = ["github", "hackernews", "google-places"]
        if platform not in valid:
            return f"Invalid platform '{platform}'. Choose from: {', '.join(valid)}"
        try:
            res = requests.post(f"{N8N}/scrape/{platform}", timeout=120)
            d = res.json()
            count = d.get("scraped") or d.get("posted") or "?"
            return f"✅ Scraped {count} leads from {platform} — all ingested and scored in Supabase."
        except Exception as e:
            return f"Error triggering {platform} scraper: {e}"

    def run_keyword_research(self, seeds: str) -> str:
        """
        Expand seed keywords into a full SEO keyword cluster and store to Supabase.
        :param seeds: Comma-separated seed keywords, e.g. 'latam market entry, b2b gtm strategy'
        :return: Number of keywords generated and a sample
        """
        seed_list = [s.strip() for s in seeds.split(",") if s.strip()]
        if not seed_list:
            return "Please provide at least one seed keyword"
        try:
            res = requests.post(
                f"{N8N}/seo/keyword-research",
                json={"seeds": seed_list},
                timeout=60,
            )
            d = res.json()
            if d.get("ok"):
                sample = ", ".join(d.get("sample", []))
                return (
                    f"✅ Generated {d.get('generated')} keywords from {d.get('seeds_used')} seeds\n"
                    f"{d.get('stored')} stored to Supabase keywords table\n"
                    f"Sample: {sample}"
                )
            return f"Error: {d.get('error', d)}"
        except Exception as e:
            return f"Error running keyword research: {e}"

    def run_competitor_crawl(self) -> str:
        """
        Trigger the competitor sitemap crawler to find new articles from all 8 monitored domains.
        New articles are automatically extracted and threat-scored.
        :return: Summary of new competitor URLs found per domain
        """
        try:
            res = requests.post(f"{N8N}/competitor/run-crawler", timeout=120)
            d = res.json()
            lines = [f"✅ Checked {d.get('competitors_checked', '?')} competitors — {d.get('total_new_urls', 0)} new URLs found"]
            for detail in d.get("details", []):
                if detail.get("new", 0) > 0:
                    lines.append(f"  {detail['domain']}: {detail['new']} new articles")
            return "\n".join(lines)
        except Exception as e:
            return f"Error running competitor crawl: {e}"

    def get_content_pipeline(self) -> str:
        """
        Show what's in the content pipeline — articles awaiting review or recently published.
        :return: List of articles with status, word count, and creation date
        """
        if not SUPABASE_URL:
            return "SUPABASE_URL not set"
        try:
            res = requests.get(
                f"{SUPABASE_URL}/rest/v1/content_pipeline"
                "?select=keyword,topic,status,pillar,word_count_target,created_at"
                "&order=created_at.desc&limit=20",
                headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
                timeout=10,
            )
            rows = res.json()
            if not rows:
                return "Content pipeline is empty. Run the pipeline to generate articles."
            lines = [f"**Content Pipeline ({len(rows)} articles):**", ""]
            for r in rows:
                lines.append(
                    f"• [{r.get('status','?').upper()}] \"{r.get('topic') or r.get('keyword','?')}\" "
                    f"({r.get('pillar','?')}) — {r.get('created_at','')[:10]}"
                )
            return "\n".join(lines)
        except Exception as e:
            return f"Error: {e}"
