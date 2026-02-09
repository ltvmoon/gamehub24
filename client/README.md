# GameHub Client

Frontend built with React + TypeScript + Vite.

## Connection

Uses `socket.io-client` for real-time communication. Connection info and identity (User ID, Username) are stored in `localStorage`.

```mermaid
sequenceDiagram
    Client->>Server: Connect (UserId, Username)
    Server-->>Client: Connection Established
```

You can change the server URL or create a new identity in **Settings**.

---

## Game Synchronization

The platform uses a **Host-Guest** architecture where the Host acts as the game server and processes all logic.

```mermaid
sequenceDiagram
    participant Guest
    participant Server
    participant Host

    Note over Guest, Host: 1. Action Relay
    Guest->>Server: Emit "game:action"
    Server->>Host: Relay Action

    Note over Host: 2. Process & Sync
    Host->>Host: Validate & Update State
    Host->>Server: Emit "game:state:patch" (Optimized)
    Server->>Guest: Broadcast Patch

    Note over Guest: 3. Update UI
```

### Key Features

- **Optimization**: Automatic patch compaction - only the smallest necessary changes are sent to save bandwidth
- **Structural Sharing**: Uses Immer for fast and accurate React re-renders
- **Persistence**: Host automatically saves state to `localStorage`. If disconnected, the Host can resume the game immediately

---

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Lint code
bun run lint
```

See [src/games/README.md](src/games/README.md) for instructions on creating new games.
