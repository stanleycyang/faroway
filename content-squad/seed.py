#!/usr/bin/env python3
"""
Faroway Content Squad — Supabase Seeder
Upserts generated articles from content-squad/generated/ into the blog_posts table.

Usage:
    python3 content-squad/seed.py
    python3 content-squad/seed.py --dry-run
    python3 content-squad/seed.py --force       (re-seed already seeded slugs)
    python3 content-squad/seed.py --slug some-slug-name
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

SQUAD_DIR = Path(__file__).parent
WORKSPACE_DIR = SQUAD_DIR.parent
GENERATED_DIR = SQUAD_DIR / "generated"
SEEDED_FILE = SQUAD_DIR / "seeded.json"
ENV_FILE = WORKSPACE_DIR / "apps" / "web" / ".env.local"


def load_env():
    """Parse .env.local for Supabase credentials."""
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    # Also allow env overrides
    for key in ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]:
        if os.environ.get(key):
            env[key] = os.environ[key]
    return env


def get_supabase_client(env):
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url:
        print("ERROR: NEXT_PUBLIC_SUPABASE_URL not found in apps/web/.env.local")
        sys.exit(1)
    if not key:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY not found in apps/web/.env.local")
        sys.exit(1)

    try:
        from supabase import create_client
    except ImportError:
        print("ERROR: supabase package not installed. Run: pip install -r content-squad/requirements.txt")
        sys.exit(1)

    return create_client(url, key)


def load_seeded() -> dict:
    if SEEDED_FILE.exists():
        return json.loads(SEEDED_FILE.read_text())
    return {}


def save_seeded(seeded: dict):
    SEEDED_FILE.write_text(json.dumps(seeded, indent=2, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Seeding logic
# ---------------------------------------------------------------------------

# Columns that exist in blog_posts table
VALID_COLUMNS = {
    "slug", "title", "description", "content", "content_source",
    "author_slug", "category", "tags", "cover_image", "cover_image_alt",
    "reading_time", "featured", "status", "published_at", "last_updated",
    "cluster", "view_count"
}


def prepare_row(data: dict) -> dict:
    """Filter to only valid columns and ensure required fields."""
    row = {k: v for k, v in data.items() if k in VALID_COLUMNS}

    # Ensure required fields
    row.setdefault("content_source", "database")
    row.setdefault("author_slug", "faroway-team")
    row.setdefault("status", "published")
    row.setdefault("featured", False)
    row.setdefault("view_count", 0)

    # Handle published_at — must be a valid ISO string
    if not row.get("published_at"):
        row["published_at"] = datetime.now(timezone.utc).isoformat()

    # tags must be a list
    if "tags" in row and not isinstance(row["tags"], list):
        row["tags"] = []

    return row


def seed_article(supabase, row: dict, dry_run: bool) -> bool:
    """Upsert a single article. Returns True on success."""
    slug = row["slug"]

    if dry_run:
        print(f"  [DRY RUN] Would upsert: {slug}")
        return True

    try:
        result = supabase.table("blog_posts").upsert(
            row,
            on_conflict="slug"
        ).execute()

        if hasattr(result, "error") and result.error:
            print(f"  ❌ DB error for {slug}: {result.error}")
            return False

        return True

    except Exception as e:
        print(f"  ❌ Exception seeding {slug}: {e}")
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Faroway Supabase seeder")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    parser.add_argument("--force", action="store_true", help="Re-seed already seeded slugs")
    parser.add_argument("--slug", type=str, default=None, help="Seed only this specific slug")
    args = parser.parse_args()

    # Load env + client
    env = load_env()
    supabase = get_supabase_client(env)

    # Load seeded state
    seeded = load_seeded()

    # Find generated files
    if args.slug:
        files = [GENERATED_DIR / f"{args.slug}.json"]
        files = [f for f in files if f.exists()]
        if not files:
            print(f"ERROR: No generated file found for slug: {args.slug}")
            sys.exit(1)
    else:
        files = sorted(GENERATED_DIR.glob("*.json"))

    if not files:
        print("No generated articles found in content-squad/generated/")
        print("Run: python3 content-squad/generate.py --limit 10")
        return

    print(f"📦 Found {len(files)} generated article(s)")
    if args.dry_run:
        print("   Mode: DRY RUN (no DB writes)")
    if args.force:
        print("   Mode: FORCE (re-seeding already seeded)")
    print()

    seeded_count = 0
    skipped_count = 0
    error_count = 0

    for f in files:
        slug = f.stem

        # Skip already seeded (unless --force)
        if not args.force and slug in seeded:
            skipped_count += 1
            continue

        try:
            data = json.loads(f.read_text())
        except Exception as e:
            print(f"  ❌ Failed to read {f.name}: {e}")
            error_count += 1
            continue

        row = prepare_row(data)
        print(f"→ {slug}")

        success = seed_article(supabase, row, args.dry_run)

        if success:
            seeded_count += 1
            if not args.dry_run:
                seeded[slug] = datetime.now(timezone.utc).isoformat()
        else:
            error_count += 1

    # Persist seeded state
    if not args.dry_run and seeded_count > 0:
        save_seeded(seeded)

    print()
    print(f"═══════════════════════════════════")
    print(f"  Seeded:  {seeded_count}")
    print(f"  Skipped: {skipped_count} (already seeded)")
    print(f"  Errors:  {error_count}")
    print(f"═══════════════════════════════════")

    if seeded_count > 0 and not args.dry_run:
        print(f"\n✅ {seeded_count} articles live at https://www.faroway.ai/blog")
    elif seeded_count > 0 and args.dry_run:
        print(f"\n✅ Dry run complete. Run without --dry-run to seed for real.")


if __name__ == "__main__":
    main()
