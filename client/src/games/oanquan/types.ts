import type { Player } from "../../stores/roomStore";

export interface OAnQuanState {
  // 12 squares:
  // 0: Mandarin (Left)
  // 1-5: Player 1's side (Top) - normally O An Quan is played with 2 sides.
  // Let's map physically:
  // 0: Mandarin Left
  // 1-5: Player 1 (Top row, left to right, or right to left? Standard: Player sits at bottom. Let's say Player 1 is bottom.)
  // Let's standardize:
  // Indices:
  //      1   2   3   4   5
  //  0                       6
  //     11  10   9   8   7
  //
  // Squares 1-5: Player 1 (Bottom side? Or P2?)
  // Let's assign:
  // Player 1 (Host): Owns squares 1-5 (Bottom row usually).
  // Player 2 (Guest): Owns squares 7-11 (Top row).
  // 0 and 6 are Mandarin squares (Quan).
  //
  // Direction:
  // CW: 1 -> 2 -> ... -> 5 -> 6 -> 7 ... -> 11 -> 0 -> 1
  // CCW: 1 -> 0 -> 11 ... -> 7 -> 6 -> 5 ... -> 1
  board: number[]; // Number of stones in each square.
  playerScores: { [userId: string]: number };
  currentTurn: string; // userId
  winner: string | null;
  gamePhase: "waiting" | "playing" | "ended";
  players: Player[];
  lastMove?: {
    player: string;
    squareId: number;
    direction: "cw" | "ccw";
  };
}

export type OAnQuanAction =
  | { type: "MOVE"; squareId: number; direction: "left" | "right" }
  | { type: "RESET" }
  | { type: "START_GAME" }
  | { type: "ADD_BOT"; botIndex?: number }
  | { type: "REMOVE_BOT"; botIndex?: number };
