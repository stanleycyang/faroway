#!/bin/bash
# Faroway Content Squad — Master Runner
# Generates articles with Claude then seeds them to Supabase.
#
# Usage:
#   ./content-squad/run.sh                        # Generate all pending + seed
#   ./content-squad/run.sh --limit 10             # Generate 10 articles + seed
#   ./content-squad/run.sh --cluster ai-travel    # Only ai-travel cluster
#   ./content-squad/run.sh --priority 1           # Only priority-1 articles
#   ./content-squad/run.sh --dry-run              # Preview seed (no DB writes)
#   ./content-squad/run.sh --generate-only        # Generate but don't seed
#   ./content-squad/run.sh --seed-only            # Seed what's already generated

set -euo pipefail

SQUAD_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_DIR="$(cd "$SQUAD_DIR/.." && pwd)"

# Parse flags
LIMIT_FLAG=""
CLUSTER_FLAG=""
PRIORITY_FLAG=""
DRY_RUN_FLAG=""
GENERATE_ONLY=false
SEED_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit)
      LIMIT_FLAG="--limit $2"
      shift 2
      ;;
    --cluster)
      CLUSTER_FLAG="--cluster $2"
      shift 2
      ;;
    --priority)
      PRIORITY_FLAG="--priority $2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN_FLAG="--dry-run"
      shift
      ;;
    --generate-only)
      GENERATE_ONLY=true
      shift
      ;;
    --seed-only)
      SEED_ONLY=true
      shift
      ;;
    *)
      echo "Unknown flag: $1"
      exit 1
      ;;
  esac
done

cd "$WORKSPACE_DIR"

echo "🚀 Faroway Content Squad"
echo "========================"
echo ""

# Generate
if [ "$SEED_ONLY" = false ]; then
  echo "📝 Step 1: Generating articles..."
  python3 content-squad/generate.py $LIMIT_FLAG $CLUSTER_FLAG $PRIORITY_FLAG
  echo ""
fi

# Seed
if [ "$GENERATE_ONLY" = false ]; then
  echo "📦 Step 2: Seeding to Supabase..."
  python3 content-squad/seed.py $DRY_RUN_FLAG
  echo ""
fi

echo "✅ Done!"

# Count totals
GENERATED=$(ls content-squad/generated/*.json 2>/dev/null | wc -l | tr -d ' ')
SEEDED=$(python3 -c "
import json, pathlib
f = pathlib.Path('content-squad/seeded.json')
print(len(json.loads(f.read_text())) if f.exists() else 0)
" 2>/dev/null || echo 0)

echo ""
echo "📊 Status:"
echo "   Generated: $GENERATED articles"
echo "   Seeded:    $SEEDED articles"
echo "   Blog:      https://www.faroway.ai/blog"
