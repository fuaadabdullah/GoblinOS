# KPI Tracking — Local DB

GoblinOS records lightweight KPI events and tool invocations into a local SQLite database for the Overmind dashboard/hub to consume.

- Database: `GoblinOS/forgetm.db` (configurable via `KPI_DB_PATH`)
- Service: Overmind Bridge (`packages/goblins/overmind/bridge`) exposes HTTP endpoints

## Endpoints

- POST `/kpi/event`
  - Body: `{ guild?, goblin?, kpi, value?, source?, context? }`
  - Example:
    ```bash
    curl -X POST http://localhost:3030/kpi/event \
      -H 'content-type: application/json' \
      -d '{"guild":"Mages","goblin":"launcey-gauge","kpi":"lint_runs","value":1,"source":"ci"}'
    ```

- POST `/kpi/tool-invocation`
  - Body: `{ guild?, goblin, tool, command?, success?, duration_ms?, reason? }`

- GET `/kpi/summary?hours=24`
  - Returns aggregate counts/averages for KPIs and tool invocations since `now - hours`.

## Tables

- `kpi_events(id, ts, guild, goblin, kpi, value, source, context)`
- `tool_invocations(id, ts, guild, goblin, tool, command, success, duration_ms, reason)`

## Runners & CLI Integration

- `examples/intent-runner.js` and `examples/toolbelt-runner.js` POST a `tool-invocation` after successful execution.
- `bin/goblin` (`goblin ask`) records `goblin_ask_requests` on success.

## Configure

- `KPI_DB_PATH` — custom DB file path (defaults to `GoblinOS/forgetm.db`)
- `GOBLIN_BRIDGE_URL` — override bridge host (defaults to `http://localhost:3030`)

## Notes

- The bridge initializes tables automatically (WAL mode enabled).
- The dashboard can poll `/kpi/summary` to render charts.

