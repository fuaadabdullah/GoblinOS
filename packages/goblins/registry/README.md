# @goblinos/registry

Canonical guild registry loader for GoblinOS. Provides typed access to `goblins.yaml`, including guild metadata, LiteBrain routing, toolbelt assignments, and KPI definitions.

## Usage

```ts
import { loadRegistrySync } from '@goblinos/registry'

const registry = loadRegistrySync()
const keepers = registry.guildMap.get('keepers')
```

### Highlights
- Zod-backed schema validation for guild, goblin, and tool definitions.
- Runtime lookups for guilds, members, and tools with helpful errors.
- Helper maps for composing dashboards, CLIs, and routing policies.
