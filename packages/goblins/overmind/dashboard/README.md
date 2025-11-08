# GoblinOS Hub

React-based monitoring dashboard for the GoblinOS Overmind orchestrator with Tauri desktop application support. This repository provides the GoblinOS Hub UI; application-specific projects (for example the ForgeTM trading web app) are separate browser-based apps and are not embedded in the desktop bundle.

## Features

- **Live Chat Interface**: Interact with Overmind in real-time
- **Guild Monitoring**: View active crews, guild KPIs, LiteBrain routing health
- **Memory Explorer**: Browse facts, entities, and episodes
- **Routing Visualizer**: See routing decisions and cost savings
- **Metrics Dashboard**: Charts for latency, cost, provider distribution
- **Conversation History**: Browse and search past conversations
- **Forge Guild Modules**: `/forge` namespace with performance budgets, provider health, and build graph telemetry for Dregg Embercode
- **Crafters Guild Modules**: `/crafters` namespace with CLS/LCP scorecards, UI token audits, schema diffing, and queue health
- **Huntress Guild Modules**: `/huntress` namespace with flaky radar, regression triage board, and signal scouting console
- **Keepers Guild Modules**: `/keepers` namespace with secret rotation logs, SBOM drift reports, and attestation status
- **Mages Guild Modules**: `/mages` namespace with release forecasts, anomaly hunts, and PR gate conformance
- **Trading Platform**: The ForgeTM trading console is a separate Vite + FastAPI web application (see `ForgeTM/`). It is intentionally not packaged into the desktop GoblinOS Hub. If you want to run ForgeTM locally, use the `ForgeTM/` project's dev flow (Vite for the frontend and the FastAPI backend on port 8000).
- **Desktop Application**: Native desktop app built with Tauri for seamless operation

## Guild Coverage

Overmind is the canonical dashboard for all goblin guilds that live in GoblinOS. Each guild exposes its UI modules through Overmind so developers and copilot agents have a single control surface. Routing policies, LiteBrain assignments, and KPIs mirror `goblins.yaml`; the dashboard consumes that file at startup to stay canonical.

### Operating Manuals
- 🛠️ Forge: [Operating Manual](../../../../../Obsidian/📋%20Projects/GoblinOS/Operating_Manuals/Forge_Operating_Manual.md)
- 🎨 Crafters: [Operating Manual](../../../../../Obsidian/📋%20Projects/GoblinOS/Operating_Manuals/Crafters_Operating_Manual.md)
- 🏹 Huntress: [Operating Manual](../../../../../Obsidian/📋%20Projects/GoblinOS/Operating_Manuals/Huntress_Operating_Manual.md)
- 🔐 Keepers: [Operating Manual](../../../../../Obsidian/📋%20Projects/GoblinOS/Operating_Manuals/Keepers_Operating_Manual.md)
- 🔮 Mages: [Operating Manual](../../../../../Obsidian/📋%20Projects/GoblinOS/Operating_Manuals/Mages_Operating_Manual.md)

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast builds
- **TanStack Query** for server state
- **Zustand** for client state
- **TailwindCSS** for styling
- **Recharts** for data visualization
- **shadcn/ui** for components

## Quick Start

### Installation

```bash
cd dashboard
pnpm install
```

### Development

```bash
pnpm dev  # Start at http://localhost:5173
```

- Visit `/auth/login`, sign in, then explore the guild namespaces:

- `/overmind` — router audit stream + global telemetry
- `/forge`, `/crafters`, `/huntress`, `/keepers`, `/mages` — guild modules
-- Note: `/trading` is not included in the desktop bundle. Use the separate `ForgeTM/` project for the trading UI.
For emergency access while the backend is offline, you can use the built-in override credentials `fuaadabdullah / Atilla2025?#!` (configurable via `VITE_DEV_LOGIN_*`).

### Build

```bash
pnpm build  # Output to dist/
pnpm preview  # Preview production build
```

### Desktop Application

The dashboard is packaged as a native desktop application using Tauri.

#### Desktop Development

```bash
npx @tauri-apps/cli dev  # Start desktop app in development mode
```

#### Desktop Build

```bash
npx @tauri-apps/cli build  # Build desktop app for current platform
```

The desktop app automatically launches the Overmind API backend on startup.

## Configuration

Create `.env.local`:

```bash
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001
VITE_GOBLINS_CONFIG=../../../../goblins.yaml
```

## Project Structure

```
dashboard/
├── public/
├── src/
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatInterface.tsx
│   │   │   └── MessageList.tsx
│   │   ├── crews/
│   │   │   ├── CrewList.tsx
│   │   │   ├── CrewDetail.tsx
│   │   │   └── AgentCard.tsx
│   │   ├── memory/
│   │   │   ├── MemoryExplorer.tsx
│   │   │   ├── EntityGraph.tsx
│   │   │   └── EpisodeTimeline.tsx
│   │   ├── metrics/
│   │   │   ├── RoutingChart.tsx
│   │   │   ├── CostChart.tsx
│   │   │   └── LatencyChart.tsx
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       └── Header.tsx
│   ├── hooks/
│   │   ├── useChat.ts
│   │   ├── useCrews.ts
│   │   └── useMemory.ts
│   ├── lib/
│   │   ├── api.ts          # API client
│   │   └── websocket.ts    # WebSocket client
│   ├── stores/
│   │   └── app.ts          # Global state
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Features Detail

### Chat Interface
- Send messages to Overmind
- View routing decisions in real-time
- See token usage and cost per message
- Export conversation history

### Crew Monitor
- List all active and completed crews
- View task breakdown and dependencies
- Monitor agent performance
- Real-time status updates via WebSocket

### Memory Explorer
- Search facts and memories
- Visualize entity relationships
- Browse episodic timeline
- Memory statistics dashboard

### Metrics Dashboard
- Provider usage pie chart
- Cost savings over time
- Latency distribution histogram
- Request volume line chart

## API Integration

The dashboard connects to:
- **REST API**: `http://localhost:8001/api/v1`
- **WebSocket**: `ws://localhost:8001/api/v1/crews/{id}/stream`

## Development

### Add shadcn/ui component

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add chart
```

### Code Standards

- Use TypeScript strict mode
- Follow React best practices (hooks, composition)
- Prefer TanStack Query for server state
- Use Zustand for UI state only
- Tailwind for all styling

## Deployment

### Static Build

```bash
pnpm build
# Deploy dist/ to any static host (Vercel, Netlify, S3, etc.)
```

### Docker

```bash
docker build -t overmind-dashboard .
docker run -p 3000:80 overmind-dashboard
```

## License

MIT
