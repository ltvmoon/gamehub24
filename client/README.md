# GameHub24 Client

The client-side application for GameHub24, built with React and TypeScript.

## 1. Socket Connection

The application uses `socket.io-client` to communicate with the server.

```mermaid
sequenceDiagram
    participant Client
    participant Server

    Client->>Server: Connect (with Auth/User ID)
    Server-->>Client: Connection Established
    Server-->>Client: Send Room Data (if any)
```

*   **Initialization**: The socket connection is established in `src/services/socket.ts`. It tries to connect to the server URL stored in `localStorage` (defaulting to the production server).
*   **Events**: Global events like room updates, chat messages, and player changes are handled in `src/pages/Room.tsx`. Game-specific events are handled within each game class (extending `BaseGame`).

## 2. Settings & Configuration

The **Settings Modal** (`src/components/SettingsModal.tsx`) allows users to configure their experience:

*   **Server URL**: Users can change the backend server URL. This is useful for local development (`http://localhost:3001`) or switching between environments.
*   **Language**: Toggles between English (US) and Vietnamese (VN).
*   **Identity**:
    *   **User ID & Username**: Generated randomly and stored in `localStorage` (`user-storage`).
    *   **Regenerate Identity**: Users can click "Generate New Identity" to reset their ID and username. This essentially creates a "new user" from the server's perspective.
*   **Connection Status**: Displays whether the client is currently connected to the Socket.IO server.

## 3. Game Synchronization Mechanism

The game features a **Host-Client** architecture to ensure consistency and security (to some extent).

```mermaid
sequenceDiagram
    participant P2 as Guest (Player 2)
    participant S as Server (Socket.IO)
    participant H as Host (Player 1)

    %% Section 1: Connection & Room Joining
    Note over P2, H: 1. Connection & Room Joining
    H->>S: Connect & Create Room
    S-->>H: Room Created (Owner)

    P2->>S: Connect
    P2->>S: Emit "room:join" {roomId}
    S->>H: "room:player_joined" (Update Player List)
    S-->>P2: Join Success (Room Info)
    S->>P2: "room:update" (Full State)

    %% Section 2: Game Start
    Note over P2, H: 2. Game Initialization
    H->>H: Select Game (e.g. TicTacToe)
    H->>S: Emit "room:update" {gameType}
    S->>P2: "room:update" {gameType}

    Note over H: Host loads Game Logic
    Note over P2: Guest loads Game UI

    H->>H: Game.init() -> Broadcast Initial State
    H->>S: Emit "game:state"
    H->>H: Auto-Save State (localStorage)
    S->>P2: "game:state" (Sync UI)

    %% Section 3: Gameplay Interaction
    Note over P2, H: 3. Gameplay (Guest Move)
    P2->>P2: User clicks cell
    P2->>S: Emit "game:action" {type: MOVE, index: 4}
    S->>H: Forward "game:action"

    Note over H: Host Validates Move
    H->>H: Update Local State
    H->>S: Emit "game:state" {board: [...], turn: O}
    H->>H: Auto-Save State

    S->>P2: Broadcast "game:state"
    P2->>P2: Update UI

    %% Section 4: Chat (Parallel)
    Note over P2, H: 4. Chat System
    P2->>S: Emit "chat:message"
    S->>H: Broadcast "chat:message"
    S->>P2: Ack/Echo Message

    %% Section 5: Disconnect/Rejoin
    Note over P2, H: 5. Recovery Flow
    H->>H: Host Refresh/Disconnect
    Note over H: ... Host Reconnects ...
    H->>S: Join Room Again
    H->>H: Detect Saved State in localStorage
    H->>H: Prompt "Resume Game?" -> Yes
    H->>H: Restore State
    H->>S: Emit "game:state" (Restored)
    S->>P2: "game:state" (Game Continues)
```

### Host Authority
*   The **Host** (Room Owner) is the source of truth for the game state.
*   Game logic (rules, win conditions, bot moves) runs primarily on the Host's client.
*   **Actions**: When a player (Host or Guest) makes a move, an action is sent via socket.
    *   If Host acts: It executes immediately and broadcasts the new state.
    *   If Guest acts: The action is sent to the Host via the Server. The Host validates it, executes it, and then broadcasts the updated state to all clients.

### State Persistence & Recovery (New)
To prevent data loss if the Host disconnects:
1.  **Auto-Save**: The Host automatically saves the game state to `localStorage` (`saved_game_[gameID]`) every time the state is broadcasted.
2.  **Recovery**: When the Host rejoins the room (or creates a new room with the same game type), the system detects the saved state.
3.  **Resume**: The Host is prompted to "Resume Game". If confirmed, the saved state is loaded, players are synchronized, and the game continues where it left off.

### Adding New Games
See [src/games/README.md](src/games/README.md) for a detailed guide on creating and registering new games.
