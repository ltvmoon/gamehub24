// UNO Constants
export const ABS_MAX_PLAYERS = 10;
export const MIN_PLAYERS = 2;

// UNO Card Colors
export const CardColor = {
  RED: 0,
  BLUE: 1,
  GREEN: 2,
  YELLOW: 3,
  WILD: 4, // For Wild cards before color is chosen
} as const;
export type CardColor = (typeof CardColor)[keyof typeof CardColor];

// UNO Card Types
export const CardType = {
  NUMBER: "number",
  SKIP: "skip",
  REVERSE: "reverse",
  DRAW_TWO: "draw_two",
  WILD: "wild",
  WILD_DRAW_FOUR: "wild_draw_four",
} as const;
export type CardType = (typeof CardType)[keyof typeof CardType];

/**
 * Uno Card Encoding: color * 100 + typeCode
 * Colors: 0:RED, 1:BLUE, 2:GREEN, 3:YELLOW, 4:WILD
 * TypeCodes: 0-9 (Numbered), 10:SKIP, 11:REVERSE, 12:DRAW_TWO, 13:WILD, 14:WILD_DRAW_FOUR
 * Example: Red 7 = 0 * 100 + 7 = 7
 * Example: Yellow Skip = 3 * 100 + 10 = 310
 * Example: Wild Draw Four = 4 * 100 + 14 = 414
 */
export type UnoCard = number;

export const CardTypeCode = {
  NUMBER: 0, // 0-9
  SKIP: 10,
  REVERSE: 11,
  DRAW_TWO: 12,
  WILD: 13,
  WILD_DRAW_FOUR: 14,
} as const;

export function encodeUnoCard(
  color: CardColor,
  type: CardType,
  value: number = 0,
): UnoCard {
  let typeCode = 0;
  switch (type) {
    case CardType.NUMBER:
      typeCode = value;
      break;
    case CardType.SKIP:
      typeCode = CardTypeCode.SKIP;
      break;
    case CardType.REVERSE:
      typeCode = CardTypeCode.REVERSE;
      break;
    case CardType.DRAW_TWO:
      typeCode = CardTypeCode.DRAW_TWO;
      break;
    case CardType.WILD:
      typeCode = CardTypeCode.WILD;
      break;
    case CardType.WILD_DRAW_FOUR:
      typeCode = CardTypeCode.WILD_DRAW_FOUR;
      break;
  }
  return color * 100 + typeCode;
}

export function decodeUnoCard(card: UnoCard): {
  color: CardColor;
  type: CardType;
  value: number;
} {
  const color = Math.floor(card / 100) as CardColor;
  const typeCode = card % 100;

  let type: CardType = CardType.NUMBER;
  let value = 0;

  if (typeCode <= 9) {
    type = CardType.NUMBER;
    value = typeCode;
  } else if (typeCode === CardTypeCode.SKIP) {
    type = CardType.SKIP;
  } else if (typeCode === CardTypeCode.REVERSE) {
    type = CardType.REVERSE;
  } else if (typeCode === CardTypeCode.DRAW_TWO) {
    type = CardType.DRAW_TWO;
  } else if (typeCode === CardTypeCode.WILD) {
    type = CardType.WILD;
  } else if (typeCode === CardTypeCode.WILD_DRAW_FOUR) {
    type = CardType.WILD_DRAW_FOUR;
  }

  return { color, type, value };
}

// Player slot in the game
export interface PlayerSlot {
  id: string | null;
  slotId: string; // Unique stable ID for the slot
  username: string;
  hand: UnoCard[];
  isBot: boolean;
  isHost: boolean;
  calledUno: boolean; // Has called UNO when down to 1 card
}

export type GamePhase = "waiting" | "playing" | "ended";
export type TurnDirection = 1 | -1; // 1 = clockwise, -1 = counter-clockwise

export interface NewGameRequest {
  fromId: string;
  fromName: string;
}

// Main game state
export interface UnoState {
  players: PlayerSlot[]; // Supports 2 to MAX_PLAYERS slots
  discardPile: UnoCard[]; // Top card is the current card
  drawPile: UnoCard[]; // Remaining deck
  currentTurnIndex: number; // whose turn
  turnDirection: TurnDirection;
  currentColor: CardColor; // Current active color (for wild cards)
  pendingDraw: number; // Accumulated draw penalty (Draw Two stacking)
  winner: string | null;
  gamePhase: GamePhase;
  newGameRequest: NewGameRequest | null;
  mustDraw: boolean; // Current player must draw if no playable card
  hasDrawn: boolean; // Current player has drawn this turn
}

// Actions
export interface PlayCardAction {
  type: "PLAY_CARD";
  playerId: string;
  card: UnoCard;
  chosenColor?: CardColor; // For Wild cards
}

export interface DrawCardAction {
  type: "DRAW_CARD";
  playerId: string;
}

export interface CallUnoAction {
  type: "CALL_UNO";
  playerId: string;
}

export interface CatchUnoAction {
  type: "CATCH_UNO";
  playerId: string; // Player calling out someone who didn't say UNO
  targetId: string; // Player who forgot to call UNO
}

export interface AddBotAction {
  type: "ADD_BOT";
  slotIndex: number;
}

export interface JoinSlotAction {
  type: "JOIN_SLOT";
  slotIndex: number;
  playerId: string;
  playerName: string;
}

export interface RemovePlayerAction {
  type: "REMOVE_PLAYER";
  slotIndex: number;
}

export interface AddSlotAction {
  type: "ADD_SLOT";
}

export interface RemoveSlotAction {
  type: "REMOVE_SLOT";
  slotIndex: number;
}

export interface StartGameAction {
  type: "START_GAME";
}

export interface NewGameAction {
  type: "NEW_GAME";
}

export interface RequestNewGameAction {
  type: "REQUEST_NEW_GAME";
  playerId: string;
  playerName: string;
}

export interface AcceptNewGameAction {
  type: "ACCEPT_NEW_GAME";
}

export interface DeclineNewGameAction {
  type: "DECLINE_NEW_GAME";
}

export type UnoAction =
  | PlayCardAction
  | DrawCardAction
  | CallUnoAction
  | CatchUnoAction
  | AddBotAction
  | JoinSlotAction
  | RemovePlayerAction
  | StartGameAction
  | NewGameAction
  | RequestNewGameAction
  | AcceptNewGameAction
  | DeclineNewGameAction
  | AddSlotAction
  | RemoveSlotAction;

// Display helpers
export const COLOR_NAMES: Record<CardColor, string> = {
  [CardColor.RED]: "Red",
  [CardColor.BLUE]: "Blue",
  [CardColor.GREEN]: "Green",
  [CardColor.YELLOW]: "Yellow",
  [CardColor.WILD]: "Wild",
};

export const COLOR_HEX: Record<CardColor, string> = {
  [CardColor.RED]: "#EF4444",
  [CardColor.BLUE]: "#3B82F6",
  [CardColor.GREEN]: "#22C55E",
  [CardColor.YELLOW]: "#EAB308",
  [CardColor.WILD]: "#1F2937",
};

export const COLOR_BG_CLASSES: Record<CardColor, string> = {
  [CardColor.RED]: "bg-red-500",
  [CardColor.BLUE]: "bg-blue-500",
  [CardColor.GREEN]: "bg-green-500",
  [CardColor.YELLOW]: "bg-yellow-500",
  [CardColor.WILD]: "bg-linear-to-br from-red-500 via-blue-500 to-green-500",
};

export const TYPE_DISPLAY: Record<CardType, string> = {
  [CardType.NUMBER]: "",
  [CardType.SKIP]: "⊘",
  [CardType.REVERSE]: "⟲",
  [CardType.DRAW_TWO]: "+2",
  [CardType.WILD]: "W",
  [CardType.WILD_DRAW_FOUR]: "+4",
};
