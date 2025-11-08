# 🌉 Overmind Node.js Bridge Service

Simple Express.js service that wraps the TypeScript Overmind for the Python FastAPI backend.

## Why This Bridge?

The Overmind core is written in TypeScript (for type safety and npm ecosystem access). The FastAPI backend provides production-grade features (auth, rate limiting, metrics) but needs to communicate with the TypeScript service. This bridge provides that HTTP interface.

## Quick Start

```bash
cd bridge
pnpm install
pnpm dev  # Development with hot reload
pnpm start  # Production
```

## Endpoints

- `POST /chat` - Send message to Overmind
- `GET /chat/history` - Get conversation history
- `DELETE /chat/history` - Clear conversation
- `POST /crews` - Create and run crew
- `GET /crews/:id` - Get crew status
- `GET /health` - Health check
- `GET /providers` - List available providers

## Configuration

Set in `.env`:

```bash
PORT=3030
NODE_ENV=development
```

## Architecture

```
Client → FastAPI (Port 8001) → Node Bridge (Port 3030) → Overmind (TypeScript)
         [Auth, Rate Limit]        [HTTP Wrapper]          [Core Logic]
```

This separation allows:
- Python expertise for backend services
- TypeScript for AI orchestration logic
- Easy horizontal scaling of either component
