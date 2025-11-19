#!/usr/bin/env python3
"""
Test script for huntress-guild goblin structure validation
"""

import sys
import json
from pathlib import Path


def test_structure():
    """Test that the goblin structure is correct"""
    print("🧪 Testing Huntress Guild Goblin Structure...")

    goblin_dir = Path(__file__).parent

    # Check directory structure
    required_files = [
        "src/__init__.py",
        "src/goblin.py",
        "src/logic.py",
        "src/schema.py",
        "src/types.py",
        "config/default.json",
        "config/schema.json",
        "pyproject.toml",
        "README.md",
    ]

    missing_files = []
    for file_path in required_files:
        if not (goblin_dir / file_path).exists():
            missing_files.append(file_path)

    if missing_files:
        print(f"❌ Missing files: {missing_files}")
        return False

    print("✅ All required files present")

    # Check Python syntax
    python_files = [
        "src/__init__.py",
        "src/goblin.py",
        "src/logic.py",
        "src/schema.py",
        "src/types.py",
    ]
    for py_file in python_files:
        try:
            with open(goblin_dir / py_file, "r") as f:
                compile(f.read(), str(goblin_dir / py_file), "exec")
            print(f"✅ {py_file} syntax OK")
        except SyntaxError as e:
            print(f"❌ {py_file} syntax error: {e}")
            return False

    # Check JSON files
    json_files = ["config/default.json", "config/schema.json"]
    for json_file in json_files:
        try:
            with open(goblin_dir / json_file, "r") as f:
                json.load(f)
            print(f"✅ {json_file} JSON OK")
        except json.JSONDecodeError as e:
            print(f"❌ {json_file} JSON error: {e}")
            return False

    # Check pyproject.toml (basic check)
    try:
        with open(goblin_dir / "pyproject.toml", "r") as f:
            content = f.read()
            if "[project]" in content and 'name = "huntress-guild"' in content:
                print("✅ pyproject.toml OK")
            else:
                print("❌ pyproject.toml missing required content")
                return False
    except Exception as e:
        print(f"❌ pyproject.toml error: {e}")
        return False

    print("🎉 Goblin structure validation passed!")
    print(
        "Note: Full functionality testing requires goblinos-shared package to be installed."
    )
    return True


if __name__ == "__main__":
    success = test_structure()
    sys.exit(0 if success else 1)
