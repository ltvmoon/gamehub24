import type { Player } from "../../stores/roomStore";

export interface ChessState {
  fen: string;
  turn: "w" | "b";
  winner: "white" | "black" | null;
  isDraw: boolean;
  check: boolean;
  players: {
    white: Player | null;
    black: Player | null;
  };
  gameOver: boolean;
  history: string[]; // List of FENs or moves? keeping simple FEN for now but for undo we might need moves
  lastMove: { from: string; to: string } | null;
  capturedPieces: {
    white: string[]; // Pieces captured by white (i.e. black pieces)
    black: string[]; // Pieces captured by black
  };
  pendingUndoRequest: string | null;
  pendingNewGameRequest: string | null;
  isBotLoading: boolean;
}

export type ChessAction =
  | {
      type: "MAKE_MOVE";
      from: string;
      to: string;
      promotion?: string;
      playerId: string;
    }
  | { type: "NEW_GAME_REQUEST"; playerId: string }
  | { type: "NEW_GAME_RESPONSE"; accepted: boolean }
  | { type: "RESET_GAME" };
