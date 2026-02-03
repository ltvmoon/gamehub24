import type { GameAction } from "../BaseGame";
import type { Difficulty } from "./words";

export interface Point {
  x: number;
  y: number;
}

export interface DrawStroke {
  id: string;
  playerId: string;
  points: number[]; // Flat array: [x1, y1, x2, y2, ...]
  color: string;
  width: number;
  duration: number; // How long it took to draw (ms)
}

// Numeric Constants for Optimization
export const GAME_MODE = {
  FREE: 0,
  GARTIC: 1,
} as const;

export const GARTIC_STATUS = {
  CHOOSING_WORD: 0,
  DRAWING: 1,
  ROUND_END: 2,
} as const;

export const MESSAGE_TYPE = {
  CHAT: 0,
  GUESS: 1,
  SYSTEM: 2,
} as const;

export const MESSAGE_SUBTYPE = {
  INFO: 0,
  SUCCESS: 1,
  WARNING: 2,
  ERROR: 3,
} as const;

export const WORD_LANGUAGE = {
  EN: 0,
  VI: 1,
} as const;

export interface GarticRound {
  drawerId: string;
  word: string; // The secret word
  status: (typeof GARTIC_STATUS)[keyof typeof GARTIC_STATUS];
  roundEndTime: number;
  maskedWord: string; // e.g., "_ _ _ _"

  // Enhancement state
  isPaused: boolean;
  pausedRemainingTime?: number; // Time left when paused
  playerHints: Record<string, number[]>; // playerId -> list of revealed indices
}

export interface GameMessage {
  id: string;
  senderId: string;
  content: string | { vi: string; en: string };
  type: (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];
  subType?: (typeof MESSAGE_SUBTYPE)[keyof typeof MESSAGE_SUBTYPE];
  isCorrect?: boolean;
  similarity?: number;
  timestamp: number;
}

export interface CanvasState {
  mode: (typeof GAME_MODE)[keyof typeof GAME_MODE];
  strokes: DrawStroke[];

  // Gartic State
  gartic?: GarticRound;
  wordOptions?: string[]; // Options currently offered to drawer
  scores: Record<string, number>; // playerId -> score
  guesses: string[]; // IDs of players who guessed correctly this round
  messages: GameMessage[]; // Chat/Guess log
  wordLanguage?: (typeof WORD_LANGUAGE)[keyof typeof WORD_LANGUAGE];
  wordDifficulty?: Difficulty;
}

export interface CanvasAction extends GameAction {
  type:
    | "DRAW"
    | "CLEAR"
    | "UNDO"
    | "START_GARTIC"
    | "CHOOSE_WORD"
    | "SUBMIT_GUESS"
    | "NEXT_ROUND"
    | "SEND_MESSAGE"
    | "REROLL_OPTIONS"
    | "PAUSE_GAME"
    | "BUY_HINT"
    | "SELECT_DIFFICULTY";
  payload?: any;
}
