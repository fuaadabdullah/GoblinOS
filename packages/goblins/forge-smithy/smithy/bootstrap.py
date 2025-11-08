import subprocess
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

def run(dev: bool = True) -> None:
    """Bootstrap Python environment with uv, install dependencies, and setup development tools.

    Args:
        dev: Whether to install development dependencies
    """
    try:
        print("🔧 Smithy bootstrap starting...")

        # 1) Create Python virtual environment via uv
        print("📦 Creating virtual environment...")
        subprocess.run(["uv", "venv", ".venv"], check=True, cwd=ROOT)

        # 2) Install dependencies via uv
        print("📦 Installing dependencies...")
        if dev:
            subprocess.run(["uv", "sync", "--dev"], check=True, cwd=ROOT)
        else:
            subprocess.run(["uv", "sync"], check=True, cwd=ROOT)

        # 3) Install pre-commit hooks
        print("🔗 Installing pre-commit hooks...")
        subprocess.run(["pre-commit", "install"], check=True, cwd=ROOT)

        # 4) Create .devcontainer if it doesn't exist
        devc_path = ROOT / ".devcontainer" / "devcontainer.json"
        if not devc_path.exists():
            print("🐳 Creating .devcontainer...")
            devc_path.parent.mkdir(parents=True, exist_ok=True)
            devcontainer_config = {
                "name": "GoblinOS Forge Smithy",
                "image": "mcr.microsoft.com/devcontainers/python:3.11",
                "features": {
                    "ghcr.io/devcontainers/features/python:1": {},
                    "ghcr.io/devcontainers/features/node:1": {}
                },
                "customizations": {
                    "vscode": {
                        "extensions": [
                            "ms-python.python",
                            "ms-python.black-formatter",
                            "ms-python.mypy-type-checker",
                            "ms-python.pylint",
                            "ms-toolsai.jupyter"
                        ]
                    }
                },
                "postCreateCommand": "uv sync --dev"
            }
            devc_path.write_text(json.dumps(devcontainer_config, indent=2))

        # 5) Create .env if it doesn't exist
        env_path = ROOT / ".env"
        example_env = ROOT / ".env.example"
        if example_env.exists() and not env_path.exists():
            print("📝 Creating .env from template...")
            env_path.write_text(example_env.read_text())

        print("✅ Smithy bootstrap complete! Run 'source .venv/bin/activate' to activate the environment.")

    except subprocess.CalledProcessError as e:
        print(f"❌ Bootstrap failed: {e}")
        print("💡 Make sure uv, python3, and git are installed.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error during bootstrap: {e}")
        sys.exit(1)
