# Game Development Guide

This directory contains the game logic and UI for all games in GameHub24. Follow this guide to add a new game to the platform.

## 1. Directory Structure

Create a new folder for your game in `client/src/games/`:

```
client/src/games/
  ├── mygame/
  │   ├── MyGame.ts        # Game logic (extends BaseGame)
  │   ├── MyGameUI.tsx     # Game UI (React component)
  │   └── types.ts         # Types and interfaces
```

## 2. Define Types (`types.ts`)

Define your game state and actions.

```typescript
export interface MyGameState {
  board: string[];
  currentTurn: string;
  players: { [key: string]: string | null }; // key is symbol (X/O), value is userId
  winner: string | null;
  // ... other state
}

export interface MyGameAction {
  type: "MOVE" | "RESET";
  [key: string]: any;
}
```

## 3. Implement Game Logic (`MyGame.ts`)

Extend `BaseGame` and implement the abstract methods.

```typescript
import { BaseGame, GameAction, GameResult } from "../BaseGame";
import { MyGameState, MyGameAction } from "./types";
import { Socket } from "socket.io-client";

export default class MyGame extends BaseGame {
  private state: MyGameState;

  constructor(
    roomId: string,
    socket: Socket,
    isHost: boolean,
    userId: string,
    players: { id: string; username: string }[]
  ) {
    super(roomId, socket, isHost, userId);

    // 1. Initialize State
    this.state = {
      // ... initial state
    };

    // 2. Broadcast initial state if Host
    if (this.isHost) {
      this.broadcastState();
    }
  }

  // Required: Return current state
  getState(): MyGameState {
    return { ...this.state };
  }

  // Required: Update local state (called when receiving state from Host)
  setState(state: MyGameState): void {
    this.state = state;
    // Trigger UI update if you implement an observer pattern
    this.onStateChange?.(this.state);
  }

  // Required: Handle actions from key socket events
  handleAction(data: { action: GameAction }): void {
    const action = data.action as MyGameAction;
    if (this.isHost) {
      // Host validates and processes action
      if (action.type === "MOVE") this.processMove(action);
    }
  }

  // Required: Logic to make a move (update state, check win, broadcast)
  makeMove(action: MyGameAction): void {
    // ... validation logic
    // ... update this.state
    // ... this.broadcastState();
  }

  // Required: Check for win/draw
  checkGameEnd(): GameResult | null {
    // Return { winner: 'id' } or { isDraw: true } or null
    return null;
  }

  // ... implement reset, updatePlayers, etc.
}
```

### Important Notes on Persistence
*   **Auto-Save**: The `BaseGame` class automatically saves the state to `localStorage` (Host only) whenever `broadcastState()` is called.
*   **Game Name**: You must set the game name in `GameContainer.tsx` (already handled automatically for registered games) for the persistence key to be generated correctly (`saved_game_[gameID]`).
*   **Auto-Recovery**: When the Host loads the game, `GameContainer` will check for a saved state and prompt to resume.

## 4. Build Game UI (`MyGameUI.tsx`)

Create a React component that accepts `GameUIProps`.

```tsx
import React, { useEffect, useState } from "react";
import { GameUIProps } from "../types";
import MyGame from "./MyGame";
import { MyGameState } from "./types";

const MyGameUI: React.FC<GameUIProps> = ({ game, currentUserId }) => {
  const myGame = game as MyGame;
  const [state, setState] = useState<MyGameState>(myGame.getState());

  useEffect(() => {
    // Subscribe to state changes
    // (You might need to add a subscription method to your MyGame class)
    const handleUpdate = (newState: MyGameState) => setState(newState);
    myGame.onUpdate(handleUpdate); // specific method you should implement

    return () => {
      // cleanup
    };
  }, [myGame]);

  const handleClick = () => {
    // Send action
    myGame.sendAction({ type: "MOVE", ... });
  };

  return (
    <div>
      {/* Render game board based on state */}
    </div>
  );
};

export default MyGameUI;
```

## 5. Register the Game (`client/src/games/registry.ts`)

Add your game to the registry so it appears in the Lobby.

```typescript
import { MyGameIcon } from "lucide-react"; // Choose an icon

games.set("mygame", {
  id: "mygame",
  name: { en: "My Game", vi: "Trò Chơi Của Tôi" },
  description: {
    en: "Description in English",
    vi: "Mô tả bằng Tiếng Việt",
  },
  icon: MyGameIcon,
  categories: ["board", "strategy"], // Choose relevant categories
  minPlayers: 2,
  maxPlayers: 4,
  isAvailable: true,

  // Lazy load the Class
  createGame: async (roomId, socket, isHost, userId, players) => {
    const { default: MyGame } = await import("./mygame/MyGame");
    return new MyGame(roomId, socket, isHost, userId, players);
  },

  // Lazy load the UI
  loadUI: () => import("./mygame/MyGameUI").then((m) => m.default),
});
```
