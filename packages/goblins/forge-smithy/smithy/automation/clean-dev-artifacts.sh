#!/bin/bash
#
# A script to safely clean development artifacts from the monorepo to free up disk space.
# This script removes common cache, dependency, and build output directories.
#

set -e

# --- Configuration ---
# Add any other directories you want to clean up to this list.
DIRS_TO_DELETE=(
    "node_modules"
    "dist"
    "coverage"
    ".turbo"
    "__pycache__"
    ".pytest_cache"
    ".venv"
    "venv"
    "artifacts"
    ".next"
    ".cache"
    "build"
    "target" # For Rust projects
)

# The root directory to start scanning from. Defaults to the script's parent directory.
SCAN_ROOT_DIR="$(dirname "$(dirname "$(dirname "$(dirname "$0")")")")"

echo "🧹 Starting cleanup in: ${SCAN_ROOT_DIR}"
echo "---"

TOTAL_DELETED_SIZE=0

for dir_name in "${DIRS_TO_DELETE[@]}"; do
    echo "[*] Searching for '${dir_name}' directories..."
    # Find all directories with the given name and calculate their total size
    find "${SCAN_ROOT_DIR}" -name "${dir_name}" -type d -prune | while read -r dir_path; do
        if [ -d "$dir_path" ]; then
            size_bytes=$(du -sb "$dir_path" | awk '{print $1}')
            size_mb=$(echo "$size_bytes" | awk '{printf "%.2f", $1/1024/1024}')
            echo "  - Deleting ${dir_path} (${size_mb} MB)"
            rm -rf "${dir_path}"
            TOTAL_DELETED_SIZE=$((TOTAL_DELETED_SIZE + size_bytes))
        fi
    done
done

TOTAL_DELETED_GB=$(echo "$TOTAL_DELETED_SIZE" | awk '{printf "%.2f", $1/1024/1024/1024}')

echo "---"
echo "✅ Cleanup complete!"
echo "Freed approximately ${TOTAL_DELETED_GB} GB of space."
echo "Run 'pnpm install' or your package manager's install command to restore dependencies."
