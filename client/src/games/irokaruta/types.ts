// ============================================================
// Iro Karuta — Color Mixing Game Types
// ============================================================

// RGB color stored as a tuple [r, g, b] (0–255)
export type RGB = [number, number, number];

// A color card available to players
export interface ColorCard {
  id: number;
  color: RGB;
  opacity: number; // 0–1, transparency level for blending
  label: string; // e.g. "Red", "Cyan"
}

// Per-player game data
export interface PlayerData {
  cardsInZone: number[]; // card IDs currently in the mixing zone
  finishedAt: number | null; // timestamp when player hit 100%, null if not yet
  score: number;
}

export type GamePhase = "waiting" | "playing" | "summary";

export interface IroKarutaState {
  phase: GamePhase;
  round: number;
  maxRounds: number;
  targetColor: RGB;
  // The palette of color cards available this round
  availableCards: ColorCard[];
  // Per-player data keyed by playerId
  playerData: Record<string, PlayerData>;
  // Timestamp when current round started
  roundStartTime: number;
  // Cards that form the answer (for host reference)
  answerCardIds: number[];
}

// --- Actions ---

export interface StartGameAction {
  type: "START_GAME";
}

export interface DropCardAction {
  type: "DROP_CARD";
  playerId: string;
  cardId: number;
}

export interface RemoveCardAction {
  type: "REMOVE_CARD";
  playerId: string;
  cardId: number;
}

export interface NextRoundAction {
  type: "NEXT_ROUND";
}

export interface ResetGameAction {
  type: "RESET_GAME";
}

export type IroKarutaAction =
  | StartGameAction
  | DropCardAction
  | RemoveCardAction
  | NextRoundAction
  | ResetGameAction;
