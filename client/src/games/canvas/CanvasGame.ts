import { BaseGame, type GameAction } from "../BaseGame";

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
  type: "DRAW" | "CLEAR" | "UNDO";
  payload?: any;
}

export default class CanvasGame extends BaseGame<CanvasState> {
  getInitState(): CanvasState {
    return {
      strokes: [],
    };
  }

  onSocketGameAction(data: { action: GameAction }): void {
    const action = data.action as CanvasAction;

    if (action.type === "DRAW") {
      this.handleDraw(action.payload);
    } else if (action.type === "CLEAR") {
      this.handleClear();
    } else if (action.type === "UNDO") {
      this.handleUndo(action.payload);
    }
  }

  makeAction(action: CanvasAction): void {
    if (this.isHost) {
      if (action.type === "DRAW") this.handleDraw(action.payload);
      if (action.type === "CLEAR") this.handleClear();
      if (action.type === "UNDO") this.handleUndo(action.payload);
    } else {
      // Client-side prediction: apply locally immediately for instant feedback
      if (action.type === "DRAW") {
        this.state.strokes = [...this.state.strokes, action.payload];
        this.syncState();
      } else if (action.type === "CLEAR") {
        this.state.strokes = [];
        this.syncState();
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
          this.syncState();
        }
      }
      // Then send to host for authoritative state
      // Only send if the user is a player (not spectator)
      if (this.players.find((p) => p.id === this.userId)) {
        this.sendSocketGameAction(action);
      }
    }
  }

  private handleDraw(stroke: DrawStroke) {
    if (!this.isHost) return;

    // Immutable update to ensure React Effect fires
    this.state.strokes = [...this.state.strokes, stroke];

    this.syncState();
  }

  private handleClear() {
    if (!this.isHost) return;

    this.state.strokes = [];

    this.syncState();
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

    this.syncState();
  }

  // Public methods
  public draw(stroke: DrawStroke) {
    const action: CanvasAction = {
      type: "DRAW",
      payload: stroke,
    };
    this.makeAction(action);
  }

  public clear() {
    const action: CanvasAction = {
      type: "CLEAR",
    };
    this.makeAction(action);
  }

  public undo() {
    const action: CanvasAction = {
      type: "UNDO",
      payload: this.userId, // Remove last stroke by current user
    };
    this.makeAction(action);
  }
}
