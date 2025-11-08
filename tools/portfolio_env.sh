#!/usr/bin/env bash
set -euo pipefail

# This helper runs portfolio tasks with sane env checks.
# Usage:
#   NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
#   PORTFOLIO_DIR=/absolute/path/to/portfolio \
#   bash tools/portfolio_env.sh [dev|build]

MODE=${1:-dev}

if [[ -z "${PORTFOLIO_DIR:-}" ]]; then
  echo "ERROR: PORTFOLIO_DIR is not set" >&2
  exit 1
fi

if [[ ! -d "$PORTFOLIO_DIR" ]]; then
  echo "ERROR: PORTFOLIO_DIR does not exist: $PORTFOLIO_DIR" >&2
  exit 1
fi

export NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}

echo "Portfolio dir: $PORTFOLIO_DIR"
echo "Site URL: $NEXT_PUBLIC_SITE_URL"
echo "Mode: $MODE"

cd "$PORTFOLIO_DIR"

if [[ "$MODE" == "build" ]]; then
  pnpm build
else
  pnpm dev
fi

