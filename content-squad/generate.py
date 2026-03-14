#!/usr/bin/env python3
"""
Faroway Content Squad — Article Generator
Skyscrapers competitor content using Claude to generate SEO-optimized travel articles.

Usage:
    python3 content-squad/generate.py
    python3 content-squad/generate.py --limit 10
    python3 content-squad/generate.py --cluster ai-travel
    python3 content-squad/generate.py --priority 1
    python3 content-squad/generate.py --limit 5 --cluster destination-guides
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

SQUAD_DIR = Path(__file__).parent
WORKSPACE_DIR = SQUAD_DIR.parent
GENERATED_DIR = SQUAD_DIR / "generated"
CONTENT_PLAN_FILE = SQUAD_DIR / "content-plan.json"
ENV_FILE = WORKSPACE_DIR / "apps" / "web" / ".env.local"

GENERATED_DIR.mkdir(exist_ok=True)


def load_env():
    """Parse .env.local for ANTHROPIC_API_KEY."""
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def get_anthropic_client(env):
    api_key = env.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not found in apps/web/.env.local or environment")
        print("Add ANTHROPIC_API_KEY=sk-ant-... to apps/web/.env.local")
        sys.exit(1)
    try:
        import anthropic
    except ImportError:
        print("ERROR: anthropic package not installed. Run: pip install -r content-squad/requirements.txt")
        sys.exit(1)
    return anthropic.Anthropic(api_key=api_key)


# ---------------------------------------------------------------------------
# Content generation
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a world-class travel SEO writer with 10+ years of experience ranking travel content on Google's first page. 

You write for Faroway (faroway.ai) — an AI-powered travel planning app that creates personalized itineraries in seconds.

Your writing style:
- Hook readers in the first 2 sentences (no fluff, no "In today's world...")
- Use clear H2 and H3 headings that contain keywords naturally
- Write in second person ("you") — direct and conversational
- Include specific, actionable details: actual prices, real neighborhood names, specific transport options
- Tables and bullet lists for scannable information
- Include local insights that generic guides miss
- Natural keyword usage — optimize for intent, not density
- Each article ends with a clear CTA to use Faroway to plan their trip

You NEVER:
- Use generic filler phrases like "In conclusion" or "Overall, it's clear that"
- Write vague recommendations without specifics
- Use keyword stuffing or unnatural repetition
- Write less than the requested word count
- Forget to mention Faroway naturally (2-3 times max per article)
"""

def build_user_prompt(article: dict) -> str:
    return f"""Write a comprehensive, skyscraper-quality travel article for Faroway's blog.

**Article Details:**
- Title: {article['title']}
- Target keyword: {article['target_keyword']}
- Meta description goal: {article['description']}
- Category: {article['category']}
- Target word count: {article['word_count_target']} words minimum
- Cluster: {article['cluster']}
- Competitor to beat: {article.get('competitor_url', 'N/A')} (write something 10x better)

**Requirements:**
1. Start with a compelling hook (no "Are you looking for..." openers)
2. Include the target keyword naturally in the first 100 words
3. Use H2 and H3 headers throughout (at least 5 H2 sections)
4. Include at least one table with useful comparison/data
5. Write specific, actionable content with real details (prices, timing, logistics)
6. Mention Faroway naturally 2-3 times as a tool to help plan their trip (not spammy)
7. End with a conclusion + CTA to generate a personalized itinerary with Faroway
8. Target length: {article['word_count_target']} words minimum

**Format:** Return only the markdown article body (no frontmatter, no JSON wrapper).
Start directly with the article content. Use ## for H2 and ### for H3.
"""


def estimate_reading_time(content: str) -> int:
    words = len(content.split())
    return max(3, round(words / 200))


def generate_article(client, article: dict) -> dict:
    """Call Claude API and return a complete blog_posts-compatible dict."""
    prompt = build_user_prompt(article)

    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.content[0].text.strip()

    return {
        "slug": article["slug"],
        "title": article["title"],
        "description": article["description"],
        "content": content,
        "content_source": "database",
        "author_slug": "faroway-team",
        "category": article["category"],
        "tags": article.get("tags", []),
        "cluster": article.get("cluster"),
        "cover_image": None,
        "cover_image_alt": f"Travel photo for {article['title']}",
        "reading_time": estimate_reading_time(content),
        "featured": False,
        "status": "published",
        "published_at": datetime.now(timezone.utc).isoformat(),
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Faroway content generator")
    parser.add_argument("--limit", type=int, default=None, help="Max articles to generate")
    parser.add_argument("--cluster", type=str, default=None, help="Only generate articles for this cluster")
    parser.add_argument("--priority", type=int, default=None, help="Only generate articles with priority <= N")
    args = parser.parse_args()

    # Load env + client
    env = load_env()
    client = get_anthropic_client(env)

    # Load content plan
    if not CONTENT_PLAN_FILE.exists():
        print(f"ERROR: content-plan.json not found at {CONTENT_PLAN_FILE}")
        sys.exit(1)

    plan = json.loads(CONTENT_PLAN_FILE.read_text())

    # Filter already generated
    already_done = {f.stem for f in GENERATED_DIR.glob("*.json")}

    pending = [
        a for a in plan
        if a["slug"] not in already_done
        and (args.cluster is None or a.get("cluster") == args.cluster)
        and (args.priority is None or a.get("priority", 99) <= args.priority)
    ]

    if not pending:
        print("✅ All articles already generated (or none match filters).")
        return

    if args.limit:
        pending = pending[:args.limit]

    total = len(pending)
    print(f"📝 Generating {total} articles (skipping {len(already_done)} already done)")
    if args.cluster:
        print(f"   Cluster filter: {args.cluster}")
    if args.priority:
        print(f"   Priority filter: <= {args.priority}")
    print()

    succeeded = 0
    failed = 0

    for i, article in enumerate(pending, 1):
        slug = article["slug"]
        print(f"[{i}/{total}] Generating: {slug}")

        retry = 0
        while retry <= 1:
            try:
                result = generate_article(client, article)
                word_count = len(result["content"].split())
                out_path = GENERATED_DIR / f"{slug}.json"
                out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
                print(f"  ✅ {word_count} words → {out_path.name}")
                succeeded += 1
                break
            except Exception as e:
                retry += 1
                if retry <= 1:
                    print(f"  ⚠️  Error (retrying): {e}")
                    time.sleep(5)
                else:
                    print(f"  ❌ Failed after retry: {e}")
                    failed += 1

        if i < total:
            time.sleep(2)  # Rate limit buffer

    print()
    print(f"═══════════════════════════════════")
    print(f"  Generated: {succeeded}")
    print(f"  Failed:    {failed}")
    print(f"  Total:     {total}")
    print(f"═══════════════════════════════════")
    if succeeded > 0:
        print(f"\nNext step: python3 content-squad/seed.py")


if __name__ == "__main__":
    main()
