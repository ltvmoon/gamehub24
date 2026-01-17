import { BaseGame, type GameAction, type GameResult } from "../BaseGame";
import type { OAnQuanState, OAnQuanAction } from "./types";
import { Socket } from "socket.io-client";

export default class OAnQuan extends BaseGame {
  private state: OAnQuanState;

  public onStateChange?: (state: OAnQuanState) => void;

  constructor(
    roomId: string,
    socket: Socket,
    isHost: boolean,
    userId: string,
    players: { id: string; username: string }[],
  ) {
    super(roomId, socket, isHost, userId);

    const initialBoard = Array(12).fill(5);
    initialBoard[0] = 10; // Mandarin Left
    initialBoard[6] = 10; // Mandarin Right

    // Initialize state
    this.state = {
      board: initialBoard,
      playerScores: {},
      currentTurn: "", // Will be set on start
      winner: null,
      gamePhase: "waiting",
      players: players.map((p) => ({ ...p, isBot: false })),
    };

    if (players.length > 0) {
      players.forEach((p) => (this.state.playerScores[p.id] = 0));
    }

    if (this.isHost) {
      this.notifyAndBroadcast();
    }
  }

  init(): void {
    // required by basegame
  }

  updatePlayers(players: { id: string; username: string }[]): void {
    // Sync players if needed?
    // For now, minimal implementation
    console.log(players);
    this.state = {
      ...this.state,
      players: players.map((p) => ({ ...p, isBot: false })),
    };
    this.notifyAndBroadcast();
  }

  reset(): void {
    this.requestResetGame();
  }

  onUpdate(callback: (state: OAnQuanState) => void) {
    this.onStateChange = callback;
  }

  getMyPlayerIndex(): number {
    return this.state.players.findIndex((p) => p.id === this.userId);
  }

  getState(): OAnQuanState {
    return { ...this.state };
  }

  setState(state: OAnQuanState): void {
    this.state = { ...state };
    this.onStateChange?.(this.state);
  }

  // Create new state reference and broadcast
  private notifyAndBroadcast() {
    this.onStateChange?.({ ...this.state });
    this.broadcastState();
  }

  handleAction(data: { action: GameAction }): void {
    const action = data.action as OAnQuanAction;

    if (this.isHost) {
      switch (action.type) {
        case "START_GAME":
          this.startGame();
          break;
        case "RESET":
          this.resetGame();
          break;
        case "ADD_BOT":
          this.addBot();
          break;
        case "REMOVE_BOT":
          this.removeBot(action.botIndex);
          break;
        case "MOVE":
          this.processMove(action);
          break;
      }
    }
  }

  // --- Host Actions ---

  private startGame() {
    if (this.state.players.length < 2) return;

    // Reset board
    const initialBoard = Array(12).fill(5);
    initialBoard[0] = 10;
    initialBoard[6] = 10;

    // Reset scores
    const newScores = { ...this.state.playerScores };
    this.state.players.forEach((p) => {
      newScores[p.id] = 0;
    });

    this.state = {
      ...this.state,
      gamePhase: "playing",
      currentTurn: this.state.players[0].id,
      board: initialBoard,
      playerScores: newScores,
      winner: null,
      lastMove: undefined,
    };

    this.checkPopulationIfNeeded();
    this.notifyAndBroadcast();
    this.checkBotTurn();
  }

  private resetGame() {
    this.state = {
      ...this.state,
      gamePhase: "waiting",
      winner: null,
      lastMove: undefined,
    };
    this.notifyAndBroadcast();
  }

  private addBot() {
    if (this.state.players.length >= 2) return;
    const botId = `bot-${Date.now()}`;
    const newPlayer = {
      id: botId,
      username: "Bot Player",
      isBot: true,
    };

    this.state = {
      ...this.state,
      players: [...this.state.players, newPlayer],
      playerScores: { ...this.state.playerScores, [botId]: 0 },
    };
    this.notifyAndBroadcast();
  }

  private removeBot(index: number | undefined) {
    if (index === undefined) return;
    const player = this.state.players[index];
    if (player && player.isBot) {
      const newPlayers = [...this.state.players];
      newPlayers.splice(index, 1);

      const newScores = { ...this.state.playerScores };
      delete newScores[player.id];

      this.state = {
        ...this.state,
        players: newPlayers,
        playerScores: newScores,
      };
      this.notifyAndBroadcast();
    }
  }

  // --- Game Logic ---

  private processMove(action: OAnQuanAction) {
    if (this.state.gamePhase !== "playing" || this.state.winner) return;
    if (action.type !== "MOVE") return;
    if (!action.squareId || !action.direction) return;

    const playerIndex = this.state.players.findIndex(
      (p) => p.id === this.state.currentTurn,
    );
    if (playerIndex === -1) return;

    // Validate ownership
    const validRange = playerIndex === 0 ? [7, 11] : [1, 5];
    if (action.squareId < validRange[0] || action.squareId > validRange[1])
      return;
    if (this.state.board[action.squareId] === 0) return; // Cannot move from empty

    // Resolve direction:
    // Player 0 (Top): Left -> CW, Right -> CCW
    // Player 1 (Bottom): Left -> CCW, Right -> CW
    let resolvedDir: "cw" | "ccw";
    if (playerIndex === 0) {
      resolvedDir = action.direction === "left" ? "cw" : "ccw";
    } else {
      resolvedDir = action.direction === "left" ? "ccw" : "cw";
    }

    // Perform the move logic
    this.executeMoveLogic(playerIndex, action.squareId, resolvedDir);

    // Record last move (store as cw/ccw for consistent replay)
    this.state = {
      ...this.state,
      lastMove: {
        player: this.state.players[playerIndex].id,
        squareId: action.squareId,
        direction: resolvedDir,
      },
    };

    // Check end game
    const result = this.checkGameEnd();
    let winner: OAnQuanState["winner"] = this.state.winner;
    let gamePhase: OAnQuanState["gamePhase"] = this.state.gamePhase;
    let currentTurn = this.state.currentTurn;

    if (result) {
      winner = result.winner || null;
      gamePhase = "ended";
    } else {
      // Switch turn
      const nextPlayerIndex = 1 - playerIndex;
      if (this.state.players[nextPlayerIndex]) {
        currentTurn = this.state.players[nextPlayerIndex].id;
        // Optimization: update state locally before checkPopulation modifies it
        this.state.currentTurn = currentTurn;
        this.checkPopulationIfNeeded();
      }
    }

    this.state = {
      ...this.state,
      winner,
      gamePhase,
      currentTurn: this.state.currentTurn, // Updated by checkPopulation possibly
    };

    this.notifyAndBroadcast();

    if (!this.state.winner) {
      this.checkBotTurn();
    }
  }

  private executeMoveLogic(
    playerIndex: number,
    startSquare: number,
    direction: "cw" | "ccw",
  ) {
    const result = simulateOAnQuanMove(
      this.state.board,
      startSquare,
      direction,
    );

    // Create new array/object references
    this.state.board = result.finalBoard;
    const newScores = { ...this.state.playerScores };
    newScores[this.state.players[playerIndex].id] += result.score;
    this.state = {
      ...this.state,
      playerScores: newScores,
    };
  }

  private checkPopulationIfNeeded() {
    const pid = this.state.currentTurn;
    const playerIndex = this.state.players.findIndex((p) => p.id === pid);
    if (playerIndex === -1) return;

    const range = playerIndex === 0 ? [7, 11] : [1, 5];
    let hasStones = false;
    for (let i = range[0]; i <= range[1]; i++) {
      if (this.state.board[i] > 0) {
        hasStones = true;
        break;
      }
    }

    if (!hasStones) {
      // Borrow 5 stones from score
      const newScores = { ...this.state.playerScores };
      newScores[pid] -= 5;
      this.state = {
        ...this.state,
        playerScores: newScores,
      };

      const newBoard = [...this.state.board];
      for (let i = range[0]; i <= range[1]; i++) {
        newBoard[i] = 1;
      }
      this.state = {
        ...this.state,
        board: newBoard,
      };
    }
  }

  checkGameEnd(): GameResult | null {
    if (this.state.board[0] === 0 && this.state.board[6] === 0) {
      // Collect remaining stones
      let p1Extra = 0;
      for (let i = 7; i <= 11; i++) p1Extra += this.state.board[i];

      let p2Extra = 0;
      for (let i = 1; i <= 5; i++) p2Extra += this.state.board[i];

      const newScores = { ...this.state.playerScores };
      newScores[this.state.players[0].id] += p1Extra;
      if (this.state.players[1]) {
        newScores[this.state.players[1].id] += p2Extra;
      }
      this.state = {
        ...this.state,
        playerScores: newScores,
        board: Array(12).fill(0),
      };

      // Determine winner
      const p1Score = this.state.playerScores[this.state.players[0].id];
      const p2Score = this.state.players[1]
        ? this.state.playerScores[this.state.players[1].id]
        : -9999;

      if (p1Score === p2Score) return { isDraw: true };
      return {
        winner:
          p1Score > p2Score
            ? this.state.players[0].id
            : this.state.players[1].id,
      };
    }
    return null;
  }

  // --- Bot ---
  private checkBotTurn() {
    const currentPlayer = this.state.players.find(
      (p) => p.id === this.state.currentTurn,
    );
    if (currentPlayer && currentPlayer.isBot) {
      // Add small delay for realism
      setTimeout(() => {
        this.makeBotMove();
      }, 1000); // 1s thinking
    }
  }

  private makeBotMove() {
    const playerIndex = this.state.players.findIndex(
      (p) => p.id === this.state.currentTurn,
    );
    const range = playerIndex === 0 ? [7, 11] : [1, 5];

    const validMoves: { id: number; dir: "left" | "right" }[] = [];
    for (let i = range[0]; i <= range[1]; i++) {
      if (this.state.board[i] > 0) {
        validMoves.push({ id: i, dir: "left" });
        validMoves.push({ id: i, dir: "right" });
      }
    }

    if (validMoves.length > 0) {
      // Random move
      const move = validMoves[Math.floor(Math.random() * validMoves.length)];
      this.processMove({
        type: "MOVE",
        squareId: move.id,
        direction: move.dir,
      });
    }
  }

  makeMove(action: OAnQuanAction): void {
    if (this.isHost) {
      this.handleAction({ action });
    } else {
      this.sendAction(action);
    }
  }

  requestStartGame() {
    if (this.isHost) this.startGame();
    else this.sendAction({ type: "START_GAME" });
  }

  requestResetGame() {
    if (this.isHost) this.resetGame();
    else this.sendAction({ type: "RESET" });
  }

  requestAddBot(index: number) {
    if (this.isHost) this.addBot();
    else this.sendAction({ type: "ADD_BOT", botIndex: index });
  }

  requestRemoveBot(index: number) {
    if (this.isHost) this.removeBot(index);
    else this.sendAction({ type: "REMOVE_BOT", botIndex: index });
  }

  requestMove(squareId: number, direction: "left" | "right") {
    if (this.isHost) this.processMove({ type: "MOVE", squareId, direction });
    else this.sendAction({ type: "MOVE", squareId, direction });
  }
}

// Logic Helper for Simulation (Shared with UI)
export const simulateOAnQuanMove = (
  initialBoard: number[],
  startSquare: number,
  direction: "cw" | "ccw",
): { finalBoard: number[]; score: number; steps: any[] } => {
  const board = [...initialBoard];
  let score = 0;
  const steps = [];

  let hand = board[startSquare];
  board[startSquare] = 0;
  steps.push({ type: "pickup", squareId: startSquare, amount: hand });

  let currentSquare = startSquare;
  const indexDir = direction === "cw" ? 1 : -1;

  while (hand > 0) {
    currentSquare = (currentSquare + indexDir + 12) % 12;
    board[currentSquare]++;
    hand--;
    steps.push({ type: "sow", squareId: currentSquare });

    if (hand === 0) {
      const nextSquare = (currentSquare + indexDir + 12) % 12;

      if (nextSquare === 0 || nextSquare === 6) {
        // steps.push({ type: 'stop', squareId: nextSquare, reason: 'mandarin' });
        break;
      }

      if (board[nextSquare] > 0) {
        hand = board[nextSquare];
        board[nextSquare] = 0;
        currentSquare = nextSquare;
        steps.push({ type: "pickup", squareId: currentSquare, amount: hand });
      } else {
        // let captureSquare = (nextSquare + indexDir + 12) % 12;
        let capturing = true;
        let currentEmptySquare = nextSquare;

        while (capturing) {
          const targetSquare = (currentEmptySquare + indexDir + 12) % 12;
          if (board[targetSquare] > 0) {
            const capturedAmount = board[targetSquare];
            board[targetSquare] = 0;
            score += capturedAmount;
            steps.push({
              type: "capture",
              squareId: targetSquare,
              amount: capturedAmount,
            });

            const nextEmpty = (targetSquare + indexDir + 12) % 12;
            if (board[nextEmpty] === 0) {
              currentEmptySquare = nextEmpty;
            } else {
              capturing = false;
            }
          } else {
            capturing = false;
          }
          if (board[targetSquare] === 0 && !capturing) break; // Should break
        }
        break;
      }
    }
  }

  return { finalBoard: board, score, steps };
};
