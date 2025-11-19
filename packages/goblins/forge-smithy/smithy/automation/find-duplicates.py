#!/usr/bin/env python3
"""
A tool to find and optionally remove duplicate files in a directory.

This script is optimized to first group files by size, and only then
compute hashes for files of the same size, making it efficient for large
repositories.
"""

import argparse
import hashlib
import os
from collections import defaultdict

# Directories to ignore during the scan. These often contain generated
# or third-party code that is not worth scanning.
IGNORE_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "coverage",
    ".turbo",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "venv",
    "artifacts",
    ".next",
    ".cache",
}


def get_file_hash(filepath, block_size=65536):
    """Calculate the SHA256 hash of a file."""
    sha256 = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for block in iter(lambda: f.read(block_size), b""):
                sha256.update(block)
        return sha256.hexdigest()
    except (IOError, OSError) as e:
        print(f"Warning: Could not read file {filepath}: {e}")
        return None


def find_duplicates(root_dir):
    """Find duplicate files and return a report."""
    files_by_size = defaultdict(list)
    # 1. Group files by size
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Modify dirnames in-place to prune traversal
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]

        for filename in filenames:
            path = os.path.join(dirpath, filename)
            if not os.path.islink(path):
                try:
                    size = os.path.getsize(path)
                    if size > 0:  # Ignore empty files
                        files_by_size[size].append(path)
                except FileNotFoundError:
                    continue  # File might have been deleted during walk

    # 2. For files of the same size, check hashes
    files_by_hash = defaultdict(list)
    for size, files in files_by_size.items():
        if len(files) > 1:
            for path in files:
                file_hash = get_file_hash(path)
                if file_hash:
                    files_by_hash[file_hash].append(path)

    # 3. Filter to find actual duplicates (groups with more than one file)
    duplicates = {hash_val: paths for hash_val, paths in files_by_hash.items() if len(paths) > 1}
    return duplicates


def interactive_delete(duplicates):
    """Interactively ask the user which duplicate files to delete."""
    total_reclaimed = 0
    for hash_val, paths in duplicates.items():
        print(f"\n[!] Duplicates for hash {hash_val[:12]}...")
        # Sort paths to have a consistent order
        paths.sort()

        # Keep the first file, offer to delete the rest
        file_to_keep = paths[0]
        files_to_delete = paths[1:]

        print(f"  - Keeping: {file_to_keep}")
        for file_to_delete in files_to_delete:
            try:
                file_size = os.path.getsize(file_to_delete)
                size_kb = file_size / 1024

                response = input(f"  - Delete {file_to_delete} ({size_kb:.2f} KB)? [y/N]: ").lower()
                if response == "y":
                    os.remove(file_to_delete)
                    total_reclaimed += file_size
                    print("    -> Deleted.")
                else:
                    print("    -> Skipped.")
            except (IOError, OSError) as e:
                print(f"    -> Error deleting file {file_to_delete}: {e}")

    print(f"\nTotal space reclaimed: {total_reclaimed / (1024 * 1024):.2f} MB")


def main():
    """Main function to run the duplicate finder."""
    parser = argparse.ArgumentParser(description="Find duplicate files in a specified directory.")
    parser.add_argument(
        "directory",
        nargs="?",
        default=".",
        help="The root directory to scan (default: current directory).",
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        help="Interactively delete duplicate files found.",
    )

    args = parser.parse_args()

    if not os.path.isdir(args.directory):
        print(f"Error: Directory not found at '{args.directory}'")
        return

    print(f"Scanning for duplicates in '{os.path.abspath(args.directory)}'...")
    duplicates = find_duplicates(args.directory)
    total_wasted_space = 0

    if not duplicates:
        print("No duplicate files found. ✨")
        return

    print("\n--- Duplicate File Report ---")
    for hash_val, paths in duplicates.items():
        file_size = os.path.getsize(paths[0])
        wasted_space = file_size * (len(paths) - 1)
        total_wasted_space += wasted_space

        print(f"\n[!] Found {len(paths)} duplicates (Hash: {hash_val[:12]}...):")
        for path in paths:
            print(f"  - {path} ({os.path.getsize(path) / 1024:.2f} KB)")

    if args.delete:
        interactive_delete(duplicates)
        return

    print("\n--- Summary ---")
    print(f"Total sets of duplicates: {len(duplicates)}")
    print(f"Total potential space savings: {total_wasted_space / (1024 * 1024):.2f} MB")
    print(
        "\nRecommendation: Review the files above and consolidate them to a single shared location."
    )


if __name__ == "__main__":
    main()
