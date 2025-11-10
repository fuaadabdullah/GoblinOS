# goblin-runtime — local dev & integration test notes

Small notes for running the compiled runtime and local integration tests.

Environment / secrets
- Do NOT commit real API keys. Keep keys in environment variables or a local file that is gitignored (for example: `.env.local`).
- The runtime reads provider keys from environment variables such as `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, etc.

Recommended (zsh) ways to run tests or the server locally without committing secrets:

1) Export the key in your shell (temporary for the session):

```bash
export DEEPSEEK_API_KEY="<your-deepseek-key>"
export ANTHROPIC_API_KEY="<your-anthropic-key>"
# then run tests or start server
cd packages/goblin-runtime
pnpm test
```

2) Or create a local `.env.local` file at the package root and keep it gitignored (do NOT commit):

```
DEEPSEEK_API_KEY=sk-....
ANTHROPIC_API_KEY=sk-....
```

Then in zsh you can load it and run the server/tests:

```bash
set -a && . ./.env.local && set +a
pnpm test
```

Start the compiled server (integration tests expect an HTTP API):

```bash
cd packages/goblin-runtime
pnpm build
# run from the project root so paths resolve as tests expect
NODE_ENV=test PORT=3001 node ./dist/server.js
```

Security notes
- I will not store or remember secrets you provide. If you want me to run a live smoke test, explicitly authorize a single run and provide which key to use and where to set it (environment or local file). I will not persist the key in the repository or assistant memory.
- For CI, store keys in repository secrets (GitHub Actions, GitLab CI, etc.), not in plain text files in the repo.

If you'd like, I can add a sample `.env.example` (already present) or add more instructions for CI secrets.
