#!/usr/bin/env bash
# Simple shim to invoke the Node goblin-cli (works if node is installed and dependencies are installed)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "node not found in PATH. Please install Node.js to use goblin-cli."
  exit 1
fi

GOBLIN_CLI="$SCRIPT_DIR/tools/goblin-cli/index.js"
if [ ! -f "$GOBLIN_CLI" ]; then
  echo "goblin-cli not installed in $GOBLIN_CLI"
  exit 1
fi

node "$GOBLIN_CLI" "$@"
