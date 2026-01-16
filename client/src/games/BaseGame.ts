import { Socket } from "socket.io-client";

export interface GameAction {
  // type: string;
  [key: string]: any;
}

export interface GameResult {
  winner?: string;
  isDraw?: boolean;
  [key: string]: any;
}

export abstract class BaseGame {
  protected roomId: string;
  protected socket: Socket;
  protected isHost: boolean;
  protected userId: string;

  constructor(roomId: string, socket: Socket, isHost: boolean, userId: string) {
    this.roomId = roomId;
    this.socket = socket;
    this.isHost = isHost;
    this.userId = userId;

    // Bind socket listeners
    if (!this.isHost) {
      // Clients listen for state updates from host
      this.socket.on("game:state", this.handleStateSync.bind(this));
    }

    // All players listen for game actions
    this.socket.on("game:action", this.handleAction.bind(this));
  }

  public get isHostUser(): boolean {
    return this.isHost;
  }

  public get getRoomId(): string {
    return this.roomId;
  }

  // Abstract methods that must be implemented by each game
  abstract init(): void;
  abstract handleAction(data: { action: GameAction }): void;
  abstract makeMove(action: GameAction): void;
  abstract getState(): any;
  abstract setState(state: any): void;
  abstract checkGameEnd(): GameResult | null;
  abstract checkGameEnd(): GameResult | null;
  abstract reset(): void;
  abstract updatePlayers(players: { id: string; username: string }[]): void;

  // Game persistent state name (e.g. "tictactoe")
  protected gameName: string = "unknown";

  public setGameName(name: string): void {
    this.gameName = name;
  }

  // Host broadcasts state to all clients
  public broadcastState(): void {
    if (this.isHost) {
      const state = this.getState();
      this.socket.emit("game:state", {
        roomId: this.roomId,
        state,
      });

      // Auto-save state to localStorage
      this.saveStateToStorage();
    }
  }

  // Send action to all players (including self via server relay)
  protected sendAction(action: GameAction): void {
    this.socket.emit("game:action", {
      roomId: this.roomId,
      action,
    });
  }

  // Client receives state update from host
  protected handleStateSync(data: { state: any }): void {
    if (!this.isHost) {
      this.setState(data.state);
    }
  }

  // Broadcast game end
  protected broadcastGameEnd(result: GameResult): void {
    this.socket.emit("game:end", {
      roomId: this.roomId,
      result,
    });

    // Clear saved state on game end
    this.clearSavedState();
  }

  // Persist state to localStorage (Host only)
  protected saveStateToStorage(): void {
    if (this.isHost && this.gameName !== "unknown") {
      try {
        const key = `saved_game_${this.gameName}`;
        const payload = {
          state: this.getState(),
          timestamp: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(payload));
      } catch (e) {
        console.error("Failed to save game state:", e);
      }
    }
  }

  // Clear saved state (Host only)
  protected clearSavedState(): void {
    if (this.isHost && this.gameName !== "unknown") {
      try {
        localStorage.removeItem(`saved_game_${this.gameName}`);
      } catch (e) {
        console.error("Failed to clear game state:", e);
      }
    }
  }

  // Cleanup socket listeners
  destroy(): void {
    this.socket.off("game:state");
    this.socket.off("game:action");
  }
}
