# goblin-cli (scaffold)

Small helper to list/validate and run GoblinOS "goblins" entries declared in `GoblinOS/goblins.yaml`.

Usage

1. From the repo root you can run the shim:

```bash
cd GoblinOS
bash goblin-cli.sh list
bash goblin-cli.sh run forge-lite-dev --dry
```

2. Or run the Node script directly (install dependencies first):

```bash
cd GoblinOS/tools/goblin-cli
pnpm install # or npm install
node index.js list
node index.js run <goblin-id> --dry
```

Features

- `list` -- prints available goblins (id, name, owner, summary)
- `run <id>` -- runs the command defined for the goblin
  - `--dry` to show what would run
  - `--unsafe` to override a goblin explicitly marked as `safe: false`

Validation

The repo contains a JSON Schema at `GoblinOS/goblins.schema.json`. Use `validate.js` to validate:

```bash
node validate.js  # uses GoblinOS/goblins.schema.json and GoblinOS/goblins.yaml by default
```

Notes

- This is a small scaffold to make it safer to run automation defined in `goblins.yaml`. It intentionally keeps logic simple and uses `--unsafe` as a manual override for destructive entries.
