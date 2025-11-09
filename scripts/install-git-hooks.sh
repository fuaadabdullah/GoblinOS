#!/usr/bin/env bash
set -euo pipefail
# Install GoblinOS git hooks into .git/hooks
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="$ROOT_DIR/.githooks"
GIT_HOOKS_DIR="$ROOT_DIR/../.git/hooks"

if [ ! -d "$GIT_HOOKS_DIR" ]; then
  echo "No .git directory found at $GIT_HOOKS_DIR. Run this from the repo workspace root." >&2
  exit 1
fi

echo "Installing git hooks from $HOOKS_DIR to $GIT_HOOKS_DIR"
for hook in "$HOOKS_DIR"/*; do
  name=$(basename "$hook")
  target="$GIT_HOOKS_DIR/$name"
  echo "Installing $name -> $target"
  cp "$hook" "$target"
  chmod +x "$target"
done

echo "Hooks installed. You can now commit and the pre-commit will run."
