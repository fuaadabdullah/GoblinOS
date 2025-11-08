---
title: Goblin LiteBrains
type: reference
project: GoblinOS
status: draft
owner: GoblinOS
---

# @goblinos/brains

Pre-wired LiteBrain implementations for Goblin guild members. Each LiteBrain adapts model routing per `goblins.yaml`, using the universal provider (`@goblinos/providers`).

## Brains

- Forge: `ForgeLiteBrain` — `ollama` → `deepseek-r1` (embeddings: `nomic-embed-text`)
- Crafters: `CraftersLiteBrain('vanta-lumin'|'volt-furnace')`
  - Vanta: `ollama` → `deepseek-r1`
  - Volt: `ollama-coder` → `deepseek-r1`
- Huntress: `HuntressLiteBrain('magnolia-nightbloom'|'mags-charietto')`
  - Magnolia: `ollama-coder` → `gpt-4-turbo`
  - Mags: `ollama-coder` → `gemini-pro`
- Keepers: `KeepersLiteBrain` — `ollama` → `deepseek-r1` (embeddings: `nomic-embed-text`)
- Mages: `MagesLiteBrain('hex-oracle'|'grim-rune'|'launcey-gauge')`
  - Hex / Launcey: `ollama` → `deepseek-r1`
  - Grim: `ollama-coder` → `deepseek-r1`

## Usage

```ts
import { ForgeLiteBrain, createLiteBrain } from '@goblinos/brains'

const forge = new ForgeLiteBrain()
const result = await forge.process({ task: 'Scaffold FastAPI service' })

const magnolia = createLiteBrain('magnolia-nightbloom')
const res = await magnolia.process({ task: 'Analyze flaky test logs' })
```

## Env

```
LITELLM_BASE_URL=http://litellm:4000
LITELLM_API_KEY=dummy
```
