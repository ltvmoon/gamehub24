import type { Player } from "../../stores/roomStore";

export type PlayerColor = "red" | "blue";

export interface DotsAndBoxesPlayer extends Player {
  color: PlayerColor;
  score: number;
}

export interface DotsAndBoxesState {
  gridSize: number; // Number of dots (e.g., 6 for 5x5 boxes)
  horizontalLines: boolean[][]; // [row][col]
  verticalLines: boolean[][]; // [row][col]
  boxes: (string | null)[][]; // [row][col], stores playerId of owner
  players: [DotsAndBoxesPlayer | null, DotsAndBoxesPlayer | null];
  currentPlayerIndex: number;
  winner: string | null;
  isGameEnded: boolean;
  gamePhase: "waiting" | "playing" | "ended";
  lastLine: {
    type: "horizontal" | "vertical";
    row: number;
    col: number;
  } | null;
  undoRequest: { requesterId: string } | null;
}

export type DotsAndBoxesAction =
  | {
      type: "PLACE_LINE";
      lineType: "horizontal" | "vertical";
      row: number;
      col: number;
      playerId: string;
    }
  | { type: "START_GAME" }
  | { type: "RESET" }
  | { type: "ADD_BOT"; slotIndex: number }
  | { type: "REMOVE_BOT"; slotIndex: number }
  | { type: "REQUEST_UNDO"; playerId: string }
  | { type: "APPROVE_UNDO" }
  | { type: "REJECT_UNDO" };
