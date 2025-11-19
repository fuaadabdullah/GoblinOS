---
description: "README"
---

# GoblinOS Desktop - Tauri Application# Tauri + React + Typescript



**Status**: 🚧 Phase 1 Complete - Basic Rust Backend + React FrontendThis template should help get you started developing with Tauri, React and Typescript in Vite.



## What's Been Done## Recommended IDE Setup



### ✅ Phase 1: Foundation Complete- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)


**Rust Backend:**
- ✅ Memory store with SQLite persistence (`memory.rs`)
- ✅ Ollama AI provider integration (`providers.rs`)
- ✅ Tauri IPC commands (`commands.rs`)
- ✅ Runtime initialization (`main.rs`)

**React Frontend:**
- ✅ Tauri client wrapper (`tauri-client.ts`)
- ✅ Goblin selector + task executor UI (`App.tsx`)
- ✅ Dark theme styling (`App.css`)

## Quick Start

```bash
# Prerequisites
brew install ollama
ollama pull qwen2.5:3b
ollama serve  # Keep running

# Run desktop app
cd GoblinOS/desktop
pnpm install
pnpm tauri dev
```

## Next Steps

### Week 1: Core Features
1. Load goblins from `goblins.yaml` (replace hardcoded list)
2. Add OpenAI, Gemini, Anthropic providers
3. Implement provider selection logic

### Week 2: Advanced Features
4. Add streaming support (real-time AI responses)
5. Port cost tracker from TypeScript to Rust
6. Add token usage tracking

### Week 3: Orchestration
7. Port orchestration parser (THEN, AND, IF_SUCCESS syntax)
8. Multi-goblin workflow execution
9. Testing & polish

## Build for Production

```bash
pnpm tauri build
# Output: src-tauri/target/release/bundle/dmg/GoblinOS_1.0.0_universal.dmg
```

---

**Phase 1 Milestone**: ✅ Basic desktop app running with Ollama integration
**Next Milestone**: Load real goblin configs + add cloud providers
