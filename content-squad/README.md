# Faroway Content Squad 🚀

Skyscraper SEO content pipeline for faroway.ai. Researches competitor top-performing articles, generates 10x better content via Claude, and seeds directly to Supabase.

## Strategy

**Skyscraper Technique:**
1. Identify competitor URLs ranking for high-value travel keywords
2. Generate longer, more specific, more actionable content
3. Publish to Faroway blog with proper SEO metadata
4. Build topical authority across 6 clusters

**Target Clusters:**
| Cluster | Articles | Intent |
|---|---|---|
| `ai-travel` | 25 | Commercial — converts AI tool searchers |
| `destination-guides` | 40 | Informational — high volume, builds trust |
| `itinerary-templates` | 25 | Transactional — trip planners ready to book |
| `budget-travel` | 20 | Informational — large audience |
| `travel-hacks` | 20 | Informational — shareable, linkable |
| `seasonal-travel` | 20 | Informational — seasonal traffic |

## Quick Start

```bash
# Install Python deps (one-time)
pip install -r content-squad/requirements.txt

# Generate + seed 10 articles (highest priority first)
./content-squad/run.sh --limit 10

# Generate only ai-travel cluster
./content-squad/run.sh --cluster ai-travel

# Dry run (see what would be seeded, no DB writes)
./content-squad/run.sh --dry-run

# Generate all 150 articles (long-running)
./content-squad/run.sh
```

## Scripts

### `generate.py` — Content Generator
Uses Claude API (`claude-opus-4-5`) to write skyscraper-quality travel articles.

```bash
# Generate 5 articles
python3 content-squad/generate.py --limit 5

# Generate specific cluster
python3 content-squad/generate.py --cluster ai-travel

# Generate priority 1 only (highest priority)
python3 content-squad/generate.py --priority 1
```

Generated files saved to `content-squad/generated/{slug}.json`.

### `seed.py` — Supabase Seeder
Upserts generated articles into the `blog_posts` table.

```bash
# Seed all generated articles
python3 content-squad/seed.py

# Dry run
python3 content-squad/seed.py --dry-run

# Force re-seed already seeded
python3 content-squad/seed.py --force
```

Tracks seeded slugs in `content-squad/seeded.json`.

## Environment

Reads from `apps/web/.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (required for writes)
- `ANTHROPIC_API_KEY` — Claude API key (for generate.py)

## Files

```
content-squad/
├── README.md           # This file
├── competitors.md      # Competitor analysis
├── content-plan.json   # 150-article content plan
├── generate.py         # Claude-powered article generator
├── seed.py             # Supabase seeder
├── run.sh              # Master runner
├── requirements.txt    # Python deps
├── seeded.json         # Tracks seeded slugs (auto-created)
└── generated/          # Generated article JSON files
    └── {slug}.json
```
