import { BaseGame, type GameAction, type GameResult } from "../BaseGame";
import type { Socket } from "socket.io-client";
import { type ChessState, type ChessAction } from "./types";
import { Chess } from "chess.js";

export default class ChessGame extends BaseGame {
  private state: ChessState;
  private onStateChange?: (state: ChessState) => void;
  private chess: Chess;

  constructor(
    roomId: string,
    socket: Socket,
    isHost: boolean,
    userId: string,
    players: { id: string; username: string }[]
  ) {
    super(roomId, socket, isHost, userId);

    this.chess = new Chess();

    this.state = {
      fen: this.chess.fen(),
      turn: "w",
      winner: null,
      isDraw: false,
      check: false,
      players: {
        white: players[0]?.id || null,
        black: players[1]?.id || null,
      },
      gameOver: false,
      history: [],
      lastMove: null,
      capturedPieces: {
        white: [],
        black: [],
      },
      pendingUndoRequest: null,
      pendingNewGameRequest: null,
    };

    this.init();
  }

  init(): void {
    if (this.isHost) {
      this.broadcastState();
      this.checkBotTurn();
    }
  }

  onUpdate(callback: (state: ChessState) => void): void {
    this.onStateChange = callback;
  }

  getState(): ChessState {
    return { ...this.state };
  }

  setState(state: ChessState): void {
    this.state = state;
    this.onStateChange?.(this.state);
  }

  handleAction(data: { action: GameAction }): void {
    const action = data.action as ChessAction;
    console.log("[Chess] handleAction:", action, "isHost:", this.isHost);

    if (this.isHost) {
      switch (action.type) {
        case "MAKE_MOVE":
          this.makeMove(action);
          break;
        case "UNDO_REQUEST":
          // this.handleUndoRequest(action.playerId);
          break;
        case "UNDO_RESPONSE":
          // this.handleUndoResponse(action.accepted);
          break;
        case "RESET_GAME": // Legacy or direct reset
          this.reset();
          break;
        case "NEW_GAME_REQUEST":
          this.handleNewGameRequest(action.playerId);
          break;
        case "NEW_GAME_RESPONSE":
          this.handleNewGameResponse(action.accepted);
          break;
      }
    }
  }

  makeMove(action: GameAction): void {
    const { from, to, promotion, playerId } = action as {
      from: string;
      to: string;
      promotion?: string;
      playerId: string;
    };

    console.log("[Chess] makeMove called", {
      from,
      to,
      playerId,
      turn: this.state.turn,
    });
    console.log("[Chess] Players:", this.state.players);

    if (this.state.gameOver) {
      console.log("[Chess] Game over, ignoring move");
      return;
    }

    // Validate turn
    let playerColor: "w" | "b" | null = null;
    if (this.state.players.white === playerId) playerColor = "w";
    else if (this.state.players.black === playerId) playerColor = "b";

    console.log("[Chess] Player color resolved:", playerColor);

    if (playerColor === null || this.state.turn !== playerColor) {
      console.log(
        "[Chess] Invalid turn or player. Turn:",
        this.state.turn,
        "Color:",
        playerColor
      );
      return;
    }

    try {
      // Create temp chess instance to validate/execute
      const tempChess = new Chess(this.state.fen);
      const move = tempChess.move({ from, to, promotion });

      if (move) {
        // Apply move
        this.chess.load(tempChess.fen());
        this.updateStateFromChess(move);
        this.broadcastState();
        this.checkBotTurn();
      } else {
        console.log("[Chess] Move validation failed (move returned null)");
      }
    } catch (e) {
      console.error("Invalid move:", e);
    }
  }

  private updateStateFromChess(move: any) {
    this.state.fen = this.chess.fen();
    this.state.turn = this.chess.turn();
    this.state.gameOver = this.chess.isGameOver();
    this.state.check = this.chess.inCheck();
    this.state.isDraw = this.chess.isDraw();
    this.state.lastMove = { from: move.from, to: move.to };
    this.state.history.push(this.state.fen);

    if (this.state.gameOver) {
      if (this.chess.isCheckmate()) {
        this.state.winner = this.chess.turn() === "w" ? "black" : "white";
      } else {
        this.state.winner = null; // Draw
      }
      this.broadcastGameEnd({ winner: this.state.winner || undefined });
    } else {
      // Check capture for display
      if (move.captured) {
        // If white moved and captured, add to white's captured list (showing black pieces)
        if (move.color === "w") {
          this.state.capturedPieces.white.push(move.captured);
        } else {
          this.state.capturedPieces.black.push(move.captured);
        }
      }
    }
    this.setState({ ...this.state });
  }

  checkGameEnd(): GameResult | null {
    return this.state.gameOver
      ? { winner: this.state.winner || undefined }
      : null;
  }

  reset(): void {
    this.chess.reset();
    this.state = {
      fen: this.chess.fen(),
      turn: "w",
      winner: null,
      isDraw: false,
      check: false,
      players: this.state.players,
      gameOver: false,
      history: [],
      lastMove: null,
      capturedPieces: {
        white: [],
        black: [],
      },
      pendingUndoRequest: null,
      pendingNewGameRequest: null,
    };
    this.broadcastState();
    this.setState({ ...this.state });
    this.checkBotTurn();
  }

  // --- Actions ---

  // --- Actions ---

  requestMove(from: string, to: string, promotion?: string): void {
    const action: ChessAction = {
      type: "MAKE_MOVE",
      from,
      to,
      promotion,
      playerId: this.userId,
    };
    this.isHost ? this.makeMove(action) : this.sendAction(action);
  }

  requestReset(): void {
    // If bot game -> Reset immediately
    const isBotGame =
      this.state.players.black === "BOT" || this.state.players.white === "BOT";
    if (isBotGame) {
      if (this.isHost) this.reset();
      return;
    }

    // PvP -> Request New Game
    const action: ChessAction = {
      type: "NEW_GAME_REQUEST",
      playerId: this.userId,
    };
    this.isHost
      ? this.handleNewGameRequest(this.userId)
      : this.sendAction(action);
  }

  requestUndo(): void {
    // TODO: Implement Undo
  }

  // --- Handlers ---

  private handleNewGameRequest(playerId: string): void {
    this.state.pendingNewGameRequest = playerId;
    this.broadcastState();
    this.setState({ ...this.state });
  }

  private handleNewGameResponse(accepted: boolean): void {
    if (accepted) {
      this.reset();
    } else {
      this.state.pendingNewGameRequest = null;
      this.broadcastState();
      this.setState({ ...this.state });
    }
  }

  public getPlayerColor(): "w" | "b" | null {
    if (this.state.players.white === this.userId) return "w";
    if (this.state.players.black === this.userId) return "b";
    return null;
  }

  updatePlayers(players: { id: string; username: string }[]): void {
    // Prioritize preserving existing assignment if possible, or just overwrite?
    // Simple overwrite based on room list order (Host=0, Guest=1)
    const whiteId = players[0]?.id || null;
    let blackId = players[1]?.id || null;

    // Preserve Bot if it was assigned and slot is empty
    if (this.state.players.black === "BOT" && !blackId) {
      blackId = "BOT";
    }

    this.state.players = {
      white: whiteId,
      black: blackId,
    };

    this.broadcastState();
    this.setState({ ...this.state });
  }

  // --- Bot Logic (Stockfish) ---
  private stockfishWorker: Worker | null = null;
  private isBotThinking: boolean = false;

  addBot(): void {
    if (!this.isHost) return;
    // Assign bot to empty slot, prioritize Black
    if (!this.state.players.black) {
      this.state.players.black = "BOT";
    } else if (!this.state.players.white) {
      this.state.players.white = "BOT";
    }

    // Initialize Stockfish
    if (!this.stockfishWorker) {
      this.stockfishWorker = new Worker("./stockfish.js");
      this.stockfishWorker.onmessage = (event) => {
        this.handleStockfishMessage(event.data);
      };
      // Initialize UCI
      this.stockfishWorker.postMessage("uci");
      this.stockfishWorker.postMessage("isready");
    }

    this.broadcastState();
    this.setState({ ...this.state });
    this.checkBotTurn();
  }

  private checkBotTurn(): void {
    if (!this.isHost) return;
    if (this.state.gameOver) return;

    const currentPlayerId =
      this.state.turn === "w"
        ? this.state.players.white
        : this.state.players.black;

    // Check if current player is BOT
    if (currentPlayerId === "BOT" && !this.isBotThinking) {
      this.makeBotMove();
    }
  }

  private makeBotMove(): void {
    if (this.state.gameOver || !this.stockfishWorker) return;

    this.isBotThinking = true;

    // 1. Position
    this.stockfishWorker.postMessage(`position fen ${this.state.fen}`);

    // 2. Go (simple depth or time limit)
    // Skill Level can be adjusted via "setoption name Skill Level value X"
    // For now, let's just give it a reasonable time limit (e.g. 1 sec) or depth
    this.stockfishWorker.postMessage("go movetime 1000");
  }

  private handleStockfishMessage(message: string) {
    // console.log("Stockfish:", message);

    if (message.startsWith("bestmove")) {
      // Format: "bestmove e2e4 ponder ..."
      const parts = message.split(" ");
      const bestMove = parts[1];

      if (bestMove && bestMove !== "(none)") {
        const from = bestMove.substring(0, 2);
        const to = bestMove.substring(2, 4);
        // Promotion? e.g. "a7a8q"
        const promotion =
          bestMove.length > 4 ? bestMove.substring(4, 5) : undefined;

        this.makeMove({
          type: "MAKE_MOVE",
          from,
          to,
          promotion,
          playerId: "BOT",
        } as any);
      }
      this.isBotThinking = false;
    }
  }

  // Cleanup worker when game destroyed (optional if we had a destroy method)
  public destroy() {
    super.destroy();
    if (this.stockfishWorker) {
      this.stockfishWorker.terminate();
      this.stockfishWorker = null;
    }
  }
}
