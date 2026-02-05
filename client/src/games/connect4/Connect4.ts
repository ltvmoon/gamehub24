import { BaseGame, type GameAction } from "../BaseGame";
import {
  type Connect4State,
  type Connect4Action,
  type Connect4Player,
  type MoveHistory,
  Connect4PlayerFlag,
  Connect4GamePhase,
  ROWS,
  COLS,
  WIN_LENGTH,
} from "./types";
import { hasFlag } from "../../utils";

export default class Connect4 extends BaseGame<Connect4State> {
  protected isGameOver(state: Connect4State): boolean {
    return state.gamePhase === Connect4GamePhase.ENDED;
  }

  // Host-only move history to keep state synchronized and thin
  private localMoveHistory: MoveHistory[] = [];

  getInitState(): Connect4State {
    const p1 = this.players[0];
    const p2 = this.players[1];

    return {
      board: "0".repeat(ROWS * COLS),
      players: [
        {
          id: p1?.id || null,
          username: p1?.username || "Player 1",
          isHost: p1?.isHost || false,
          isBot: p1?.isBot || false,
          flags: p1?.isBot ? Connect4PlayerFlag.BOT : 0,
        },
        {
          id: p2?.id || null,
          username: p2?.username || "Player 2",
          isHost: p2?.isHost || false,
          isBot: p2?.isBot || false,
          flags: p2?.isBot ? Connect4PlayerFlag.BOT : 0,
        },
      ] as [Connect4Player, Connect4Player],
      currentPlayerIndex: 0,
      winner: null,
      gamePhase: Connect4GamePhase.WAITING,
      undoRequest: null,
      lastMove: null,
      winningCells: [],
    };
  }

  onSocketGameAction(data: { action: GameAction }): void {
    const action = data.action as Connect4Action;
    if (!this.isHost) return;

    switch (action.type) {
      case "MAKE_MOVE":
        this.handleMakeMove(action.playerId, action.col);
        break;
      case "START_GAME":
        this.handleStartGame();
        break;
      case "RESET":
        this.reset();
        break;
      case "ADD_BOT":
        this.handleAddBot();
        break;
      case "REMOVE_BOT":
        this.handleRemoveBot();
        break;
      case "REQUEST_UNDO":
        this.handleRequestUndo(action.playerId, action.playerName);
        break;
      case "ACCEPT_UNDO":
        this.handleAcceptUndo();
        break;
      case "DECLINE_UNDO":
        this.handleDeclineUndo();
        break;
    }
  }

  // ============== Game Logic ==============

  private handleStartGame(): void {
    if (this.state.gamePhase !== Connect4GamePhase.WAITING) return;
    if (!this.state.players[0].id || !this.state.players[1].id) return;

    this.state.gamePhase = Connect4GamePhase.PLAYING;
    this.state.currentPlayerIndex = 0;
    this.state.board = "0".repeat(ROWS * COLS);
    this.localMoveHistory = [];
    this.state.winner = null;
    this.state.lastMove = null;
    this.state.winningCells = [];

    this.checkBotTurn();
  }

  private handleMakeMove(playerId: string, col: number): void {
    if (this.state.gamePhase !== Connect4GamePhase.PLAYING) return;

    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return;

    // Find the lowest empty row in this column
    const row = this.getLowestEmptyRow(col);
    if (row === -1) return;

    // Save state for undo (Host-only)
    this.saveHistory();

    // Apply move
    const boardArr = this.state.board.split("");
    const pieceVal = this.state.currentPlayerIndex === 0 ? "1" : "2";
    boardArr[row * COLS + col] = pieceVal;
    this.state.board = boardArr.join("");
    this.state.lastMove = row * COLS + col;

    // Check for win
    const winningCells = this.checkWin(row, col, pieceVal);
    if (winningCells.length > 0) {
      this.state.winningCells = winningCells;
      this.state.winner = playerId;
      this.state.gamePhase = Connect4GamePhase.ENDED;
      this.clearSavedState();
    } else if (this.isBoardFull()) {
      this.state.winner = "draw";
      this.state.gamePhase = Connect4GamePhase.ENDED;
      this.clearSavedState();
    } else {
      // Switch turn
      this.state.currentPlayerIndex = 1 - this.state.currentPlayerIndex;
    }

    this.checkBotTurn();
  }

  private getLowestEmptyRow(col: number): number {
    for (let row = ROWS - 1; row >= 0; row--) {
      if (this.state.board[row * COLS + col] === "0") {
        return row;
      }
    }
    return -1;
  }

  private isBoardFull(): boolean {
    // Only check top row
    for (let col = 0; col < COLS; col++) {
      if (this.state.board[col] === "0") return false;
    }
    return true;
  }

  private checkWin(row: number, col: number, pieceVal: string): number[] {
    const directions = [
      [0, 1], // horizontal
      [1, 0], // vertical
      [1, 1], // diagonal \
      [1, -1], // diagonal /
    ];

    for (const [dr, dc] of directions) {
      const cells = this.getConnectedCells(row, col, dr, dc, pieceVal);
      if (cells.length >= WIN_LENGTH) {
        return cells;
      }
    }

    return [];
  }

  private getConnectedCells(
    row: number,
    col: number,
    dr: number,
    dc: number,
    pieceVal: string,
  ): number[] {
    const cells: number[] = [row * COLS + col];

    // Positive
    let r = row + dr;
    let c = col + dc;
    while (
      r >= 0 &&
      r < ROWS &&
      c >= 0 &&
      c < COLS &&
      this.state.board[r * COLS + c] === pieceVal
    ) {
      cells.push(r * COLS + c);
      r += dr;
      c += dc;
    }

    // Negative
    r = row - dr;
    c = col - dc;
    while (
      r >= 0 &&
      r < ROWS &&
      c >= 0 &&
      c < COLS &&
      this.state.board[r * COLS + c] === pieceVal
    ) {
      cells.push(r * COLS + c);
      r -= dr;
      c -= dc;
    }

    return cells;
  }

  // ============== Undo System ==============

  private saveHistory(): void {
    if (!this.isHost) return;

    this.localMoveHistory.push({
      b: this.state.board,
      currentPlayerIndex: this.state.currentPlayerIndex,
    });

    if (this.localMoveHistory.length > 50) {
      this.localMoveHistory.shift();
    }
  }

  private handleRequestUndo(playerId: string, playerName: string): void {
    if (this.state.gamePhase !== Connect4GamePhase.PLAYING) return;
    if (this.localMoveHistory.length === 0) return;
    if (this.state.undoRequest) return;

    const playerIndex = this.state.players.findIndex((p) => p.id === playerId);
    const opponentIndex = 1 - playerIndex;
    const opponent = this.state.players[opponentIndex];

    if (opponent && hasFlag(opponent.flags, Connect4PlayerFlag.BOT)) {
      this.applyUndo();
    } else {
      this.state.undoRequest = { fromId: playerId, fromName: playerName };
    }
  }

  private handleAcceptUndo(): void {
    if (!this.state.undoRequest) return;
    this.applyUndo();
  }

  private applyUndo(): void {
    const lastHistory = this.localMoveHistory.pop();
    if (!lastHistory) return;

    this.state.board = lastHistory.b;
    this.state.currentPlayerIndex = lastHistory.currentPlayerIndex;
    this.state.undoRequest = null;
    this.state.lastMove = null;
    this.state.winningCells = [];
  }

  private handleDeclineUndo(): void {
    this.state.undoRequest = null;
  }

  // ============== Bot AI ==============

  private handleAddBot(): void {
    if (this.state.gamePhase !== Connect4GamePhase.WAITING) return;
    if (this.state.players[1].id) return;

    this.state.players[1] = {
      id: `BOT_${Date.now()}`,
      username: "Bot",
      isHost: false,
      isBot: true,
      flags: Connect4PlayerFlag.BOT,
    } as Connect4Player;
  }

  private handleRemoveBot(): void {
    if (this.state.gamePhase !== Connect4GamePhase.WAITING) return;
    if (!hasFlag(this.state.players[1].flags, Connect4PlayerFlag.BOT)) return;

    this.state.players[1] = {
      id: null,
      username: "Player 2",
      isHost: false,
      isBot: false,
      flags: 0,
    } as Connect4Player;
  }

  private checkBotTurn(): void {
    if (!this.isHost) return;
    if (this.state.gamePhase !== Connect4GamePhase.PLAYING) return;

    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    if (
      hasFlag(currentPlayer.flags, Connect4PlayerFlag.BOT) &&
      currentPlayer.id
    ) {
      setTimeout(() => this.makeBotMove(currentPlayer.id!), 600);
    }
  }

  private makeBotMove(botId: string): void {
    if (this.state.gamePhase !== Connect4GamePhase.PLAYING) return;
    if (this.state.players[this.state.currentPlayerIndex].id !== botId) return;

    const bestCol = this.findBestMove();
    if (bestCol !== -1) {
      this.handleMakeMove(botId, bestCol);
    }
  }

  private findBestMove(): number {
    const isBotPlayer1 = this.state.currentPlayerIndex === 0;
    const botPiece = isBotPlayer1 ? "1" : "2";

    const startTime = Date.now();
    let bestScore = -Infinity;
    let bestCol = -1;

    // Get available columns
    const availableCols = [];
    // Center-out heuristic for move ordering
    const preferredCols = [3, 2, 4, 1, 5, 0, 6];
    for (const col of preferredCols) {
      if (this.getLowestEmptyRow(col) !== -1) {
        availableCols.push(col);
      }
    }

    if (availableCols.length === 0) return -1;
    if (availableCols.length === 1) return availableCols[0];

    // Search depth
    const depth = 6;

    for (const col of availableCols) {
      const row = this.getLowestEmptyRow(col);
      const nextBoard = this.simulateMove(this.state.board, row, col, botPiece);

      const score = this.minimax(
        nextBoard,
        depth - 1,
        -Infinity,
        Infinity,
        false,
        botPiece,
      );

      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }

    console.log(
      `[Connect4 Bot] Best move: ${bestCol}, score: ${bestScore}, time: ${Date.now() - startTime}ms`,
    );
    return bestCol;
  }

  private simulateMove(
    board: string,
    row: number,
    col: number,
    piece: string,
  ): string {
    const boardArr = board.split("");
    boardArr[row * COLS + col] = piece;
    return boardArr.join("");
  }

  private minimax(
    board: string,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    botPiece: string,
  ): number {
    const opponentPiece = botPiece === "1" ? "2" : "1";

    // Terminal states
    const winnerPiece = this.getWinnerPiece(board);
    if (winnerPiece === botPiece) return 1000000 + depth; // Favor faster wins
    if (winnerPiece === opponentPiece) return -1000000 - depth; // Favor longer losses
    if (this.isBoardFullStatic(board)) return 0;
    if (depth === 0) return this.evaluateBoard(board, botPiece);

    const availableCols = [3, 2, 4, 1, 5, 0, 6].filter(
      (col) => this.getLowestEmptyRowStatic(board, col) !== -1,
    );

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const col of availableCols) {
        const row = this.getLowestEmptyRowStatic(board, col);
        const nextBoard = this.simulateMove(board, row, col, botPiece);
        const eva = this.minimax(
          nextBoard,
          depth - 1,
          alpha,
          beta,
          false,
          botPiece,
        );
        maxEval = Math.max(maxEval, eva);
        alpha = Math.max(alpha, eva);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const col of availableCols) {
        const row = this.getLowestEmptyRowStatic(board, col);
        const nextBoard = this.simulateMove(board, row, col, opponentPiece);
        const eva = this.minimax(
          nextBoard,
          depth - 1,
          alpha,
          beta,
          true,
          botPiece,
        );
        minEval = Math.min(minEval, eva);
        beta = Math.min(beta, eva);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  private evaluateBoard(board: string, botPiece: string): number {
    let score = 0;
    const opponentPiece = botPiece === "1" ? "2" : "1";

    // Score center column
    const centerCol = Math.floor(COLS / 2);
    for (let r = 0; r < ROWS; r++) {
      if (board[r * COLS + centerCol] === botPiece) score += 3;
    }

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const window = [
          board[r * COLS + c],
          board[r * COLS + c + 1],
          board[r * COLS + c + 2],
          board[r * COLS + c + 3],
        ];
        score += this.evaluateWindow(window, botPiece, opponentPiece);
      }
    }

    // Vertical
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS - 4; r++) {
        const window = [
          board[r * COLS + c],
          board[(r + 1) * COLS + c],
          board[(r + 2) * COLS + c],
          board[(r + 3) * COLS + c],
        ];
        score += this.evaluateWindow(window, botPiece, opponentPiece);
      }
    }

    // Diagonal \
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        const window = [
          board[r * COLS + c],
          board[(r + 1) * COLS + (c + 1)],
          board[(r + 2) * COLS + (c + 2)],
          board[(r + 3) * COLS + (c + 3)],
        ];
        score += this.evaluateWindow(window, botPiece, opponentPiece);
      }
    }

    // Diagonal /
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 3; c < COLS; c++) {
        const window = [
          board[r * COLS + c],
          board[(r + 1) * COLS + (c - 1)],
          board[(r + 2) * COLS + (c - 2)],
          board[(r + 3) * COLS + (c - 3)],
        ];
        score += this.evaluateWindow(window, botPiece, opponentPiece);
      }
    }

    return score;
  }

  private evaluateWindow(
    window: string[],
    botPiece: string,
    opponentPiece: string,
  ): number {
    let score = 0;
    const botCount = window.filter((p) => p === botPiece).length;
    const oppCount = window.filter((p) => p === opponentPiece).length;
    const emptyCount = window.filter((p) => p === "0").length;

    if (botCount === 4) {
      score += 10000;
    } else if (botCount === 3 && emptyCount === 1) {
      score += 100;
    } else if (botCount === 2 && emptyCount === 2) {
      score += 10;
    }

    if (oppCount === 3 && emptyCount === 1) {
      score -= 80; // Slightly less than blocking our own win, but high priority
    } else if (oppCount === 2 && emptyCount === 2) {
      score -= 5;
    }

    return score;
  }

  private getWinnerPiece(board: string): string | null {
    const directions = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const piece = board[r * COLS + c];
        if (piece === "0") continue;

        for (const [dr, dc] of directions) {
          let count = 1;
          for (let i = 1; i < WIN_LENGTH; i++) {
            const nr = r + dr * i;
            const nc = c + dc * i;
            if (
              nr < 0 ||
              nr >= ROWS ||
              nc < 0 ||
              nc >= COLS ||
              board[nr * COLS + nc] !== piece
            ) {
              break;
            }
            count++;
          }
          if (count === WIN_LENGTH) return piece;
        }
      }
    }
    return null;
  }

  private getLowestEmptyRowStatic(board: string, col: number): number {
    for (let row = ROWS - 1; row >= 0; row--) {
      if (board[row * COLS + col] === "0") {
        return row;
      }
    }
    return -1;
  }

  private isBoardFullStatic(board: string): boolean {
    for (let col = 0; col < COLS; col++) {
      if (board[col] === "0") return false;
    }
    return true;
  }

  // ============== Public API ==============

  requestMove(col: number): void {
    const action: Connect4Action = {
      type: "MAKE_MOVE",
      playerId: this.userId,
      col,
    };
    this.makeAction(action);
  }

  requestStartGame(): void {
    const action: Connect4Action = { type: "START_GAME" };
    this.makeAction(action);
  }

  requestAddBot(): void {
    const action: Connect4Action = { type: "ADD_BOT" };
    this.makeAction(action);
  }

  requestRemoveBot(): void {
    const action: Connect4Action = { type: "REMOVE_BOT" };
    this.makeAction(action);
  }

  requestUndo(): void {
    const player = this.state.players.find((p) => p.id === this.userId);
    const action: Connect4Action = {
      type: "REQUEST_UNDO",
      playerId: this.userId,
      playerName: player?.username || "Player",
    };
    this.makeAction(action);
  }

  acceptUndo(): void {
    const action: Connect4Action = { type: "ACCEPT_UNDO" };
    this.makeAction(action);
  }

  declineUndo(): void {
    const action: Connect4Action = { type: "DECLINE_UNDO" };
    this.makeAction(action);
  }

  requestNewGame(): void {
    const action: Connect4Action = { type: "RESET" };
    this.makeAction(action);
  }

  reset(): void {
    this.state.board = "0".repeat(ROWS * COLS);
    this.state.currentPlayerIndex = 0;
    this.state.winner = null;
    this.state.gamePhase = Connect4GamePhase.WAITING;
    this.state.undoRequest = null;
    this.localMoveHistory = [];
    this.state.lastMove = null;
    this.state.winningCells = [];
  }

  updatePlayers(players: any[]): void {
    if (this.state.gamePhase !== Connect4GamePhase.WAITING) return;

    const p0 = players[0];
    const p1 = players[1];

    // Slot 0 (Host)
    this.state.players[0].id = p0?.id || null;
    this.state.players[0].username = p0?.username || "Player 1";
    this.state.players[0].isHost = p0?.isHost || false;
    this.state.players[0].isBot = p0?.isBot || false;

    // Slot 1 (Guest or Bot)
    if (p1) {
      this.state.players[1].id = p1.id;
      this.state.players[1].username = p1.username;
      this.state.players[1].isHost = p1.isHost || false;
      this.state.players[1].isBot = p1.isBot || false;
      this.state.players[1].flags &= ~Connect4PlayerFlag.BOT;
    } else {
      if (!hasFlag(this.state.players[1].flags, Connect4PlayerFlag.BOT)) {
        this.state.players[1].id = null;
        this.state.players[1].username = "Player 2";
        this.state.players[1].isHost = false;
        this.state.players[1].isBot = false;
      }
    }
  }

  getMyPlayerIndex(): number {
    return this.state.players.findIndex((p) => p.id === this.userId);
  }

  canStartGame(): boolean {
    return (
      this.state.players[0].id !== null && this.state.players[1].id !== null
    );
  }

  isColumnFull(col: number): boolean {
    const pos = col; // Top row check
    return this.state.board[pos] !== "0";
  }
}
