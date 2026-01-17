import { BaseGame, type GameAction, type GameResult } from "../BaseGame";
import type { Socket } from "socket.io-client";

export interface Point {
  x: number;
  y: number;
}

export interface DrawStroke {
  id: string;
  playerId: string;
  points: Point[];
  color: string;
  width: number;
  duration: number; // How long it took to draw (ms)
}

export interface CanvasState {
  strokes: DrawStroke[];
}

export interface CanvasAction extends GameAction {
  type: "DRAW" | "CLEAR" | "UNDO" | "REQUEST_SYNC";
  payload?: any;
}

export default class CanvasGame extends BaseGame<CanvasState> {
  private state: CanvasState;
  private players: string[] = [];

  constructor(
    roomId: string,
    socket: Socket,
    isHost: boolean,
    userId: string,
    _players: { id: string; username: string }[],
  ) {
    super(roomId, socket, isHost, userId);

    this.state = {
      strokes: [],
    };

    this.init();
  }

  init(): void {
    if (this.isHost) {
      this.broadcastState();
    }
  }

  getState(): CanvasState {
    return { ...this.state };
  }

  setState(state: CanvasState): void {
    this.state = state;
    this.onStateChange?.(this.state);
  }

  handleAction(data: { action: GameAction }): void {
    const action = data.action as CanvasAction;

    if (action.type === "DRAW") {
      const stroke = action.payload as DrawStroke;
      if (this.players.includes(stroke.playerId)) {
        this.handleDraw(stroke);
      }
    } else if (action.type === "CLEAR") {
      // Only allow players to clear? Or maybe just host?
      // For now, let's allow any active player to clear
      // BUT we can't easily check playerId for CLEAR action as payload might be empty or different
      // Actually BaseGame usually passes the sender's ID in action context if we structured it that way,
      // but here data.action is just the payload.
      // Let's assume CLEAR is global? Or check logic.
      // The handleAction receives data: { action: GameAction }. GameAction has playerId.
      if (this.players.includes(action.playerId)) {
        this.handleClear();
      }
    } else if (action.type === "UNDO") {
      if (this.players.includes(action.payload)) {
        this.handleUndo(action.payload);
      }
    } else if (action.type === "REQUEST_SYNC") {
      if (this.isHost) {
        this.broadcastState();
      }
    }
  }

  makeMove(action: CanvasAction): void {
    if (this.isHost) {
      if (action.type === "DRAW") this.handleDraw(action.payload);
      if (action.type === "CLEAR") this.handleClear();
      if (action.type === "UNDO") this.handleUndo(action.payload);
    } else {
      // Client-side prediction: apply locally immediately for instant feedback
      if (action.type === "DRAW") {
        this.state.strokes = [...this.state.strokes, action.payload];
        this.setState({ ...this.state });
      } else if (action.type === "CLEAR") {
        this.state.strokes = [];
        this.setState({ ...this.state });
      } else if (action.type === "UNDO") {
        // Find and remove last stroke by this player
        const playerId = action.payload;
        let lastIndex = -1;
        for (let i = this.state.strokes.length - 1; i >= 0; i--) {
          if (this.state.strokes[i].playerId === playerId) {
            lastIndex = i;
            break;
          }
        }
        if (lastIndex !== -1) {
          this.state.strokes = this.state.strokes.filter(
            (_, i) => i !== lastIndex,
          );
          this.setState({ ...this.state });
        }
      }
      // Then send to host for authoritative state
      this.sendAction(action);
    }
  }

  private handleDraw(stroke: DrawStroke) {
    if (!this.isHost) return;

    // Immutable update to ensure React Effect fires
    this.state.strokes = [...this.state.strokes, stroke];

    this.broadcastState();
    this.setState({ ...this.state });
  }

  private handleClear() {
    if (!this.isHost) return;

    this.state.strokes = [];

    this.broadcastState();
    this.setState({ ...this.state });
  }

  private handleUndo(playerId: string) {
    if (!this.isHost) return;

    // Find last stroke by this player (reverse loop for compatibility)
    let lastIndex = -1;
    for (let i = this.state.strokes.length - 1; i >= 0; i--) {
      if (this.state.strokes[i].playerId === playerId) {
        lastIndex = i;
        break;
      }
    }
    if (lastIndex === -1) return;

    this.state.strokes = this.state.strokes.filter((_, i) => i !== lastIndex);

    this.broadcastState();
    this.setState({ ...this.state });
  }

  // Public methods
  public draw(stroke: DrawStroke) {
    const action: CanvasAction = {
      type: "DRAW",
      payload: stroke,
    };
    this.makeMove(action);
  }

  public clear() {
    const action: CanvasAction = {
      type: "CLEAR",
    };
    this.makeMove(action);
  }

  public undo() {
    const action: CanvasAction = {
      type: "UNDO",
      payload: this.userId, // Remove last stroke by current user
    };
    this.makeMove(action);
  }

  public requestSync() {
    const action: CanvasAction = {
      type: "REQUEST_SYNC",
    };
    if (this.isHost) {
      this.broadcastState();
    } else {
      this.sendAction(action);
    }
  }

  checkGameEnd(): GameResult | null {
    return null;
  }

  reset(): void {
    this.handleClear();
  }

  updatePlayers(players: { id: string; username: string }[]): void {
    this.players = players.map((p) => p.id);
  }
}
