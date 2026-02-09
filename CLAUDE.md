# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GameHub is a real-time multiplayer browser-based gaming platform with 15+ games. It's a full-stack TypeScript monorepo with separate client (React/Vite) and server (Express/Socket.IO) applications.

## Commands

### Client (run from `/client`)
```bash
bun run dev      # Start dev server at http://localhost:5173
bun run build    # Build to ../built/ (clears, type-checks, then builds)
bun run lint     # ESLint
```

### Server (run from `/server`)
```bash
bun run dev      # Dev with Bun watch mode
bun run dev:bun  # Alternative: bun --watch
bun run build    # Compile TypeScript to dist/
bun run start    # Run production build
```

### Quick Start
```bash
# Terminal 1
cd server && bun run dev

# Terminal 2
cd client && bun run dev
```

## Architecture

### Host-Authoritative Model
- Game logic runs on the **client-side host**, not the server
- Server acts as a **relay** for state synchronization via Socket.IO
- Uses patch compaction for efficient real-time state updates

### Game Structure
Each game in `client/src/games/` follows this pattern:
- `{Game}.ts` - Core logic extending `BaseGame` class
- `{Game}UI.tsx` - React UI component
- `types.ts` - Game-specific types
- Must be registered in `games/registry.ts`

### State Management
Zustand stores in `client/src/stores/`:
- `gameStore` - Active game state
- `roomStore` - Room/lobby management
- `socketStore` - WebSocket connection
- `userStore`, `chatStore`, `settingsStore`, `alertStore`, `languageStore`

### Key Files
- `client/src/games/BaseGame.ts` - Base class all games extend
- `client/src/games/stateProxy.ts` - Efficient state update proxy
- `server/src/server.ts` - Main server (handles all socket events)
- `server/src/RoomManager.ts` - Room management logic

## Tech Stack

**Client**: React 19, Vite 7, TypeScript, Tailwind CSS 4, Zustand, Socket.IO Client
**Server**: Express 5, Socket.IO, TypeScript (Node.js/Bun)
**Design**: Glassmorphism theme with `--glass-*` CSS variables

## Build Notes

- Client builds output to root `../built/` directory (not within client folder)
- Production uses Terser for minification
- Code splitting configured for react-vendor, socket, zustand, chess libraries
- Glass effects can be disabled via `body.no-glass` class for performance
