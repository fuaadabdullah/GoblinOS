# GoblinOS — Quick Onboarding

This page covers the minimal steps to get productive with GoblinOS automation and run basic goblins.

Requirements

- Node.js (16+) installed and available on PATH
- pnpm or npm (pnpm preferred for this workspace)
- Optional: `detect-secrets` or `git-secrets` for pre-commit checks
- Optional: `shellcheck` for shell linting

Initial setup

```bash
# from repo root
cd GoblinMonorepo/GoblinOS || cd GoblinOS
pnpm install
```

Install git hooks (optional but recommended):

```bash
cd GoblinOS
bash scripts/install-git-hooks.sh
```

Using the goblin-cli scaffold

1. List available goblins declared in `GoblinOS/goblins.yaml`:

```bash
cd GoblinOS
bash goblin-cli.sh list
```

2. Dry-run a goblin (safe):

```bash
bash goblin-cli.sh run <goblin-id> --dry
```

3. Execute a goblin (if a goblin is marked `safe: false` you'll need to pass `--unsafe`):

```bash
bash goblin-cli.sh run <goblin-id>
# or
bash goblin-cli.sh run <destructive-id> --unsafe
```

Validating `goblins.yaml`

You can validate `GoblinOS/goblins.yaml` against the included schema:

```bash
cd GoblinOS/tools/goblin-cli
node validate.js
```

Notes & safety

- The `goblin-cli` scaffold is intentionally conservative: destructive goblins should be marked with `safe: false` in `goblins.yaml` and require an explicit `--unsafe` override to run.
- Pre-commit hooks will attempt to run `detect-secrets` or `git-secrets` and will warn/block commits if issues are found.
