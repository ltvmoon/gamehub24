// Card Suits - ordered (not very important in Phom scoring but used for display)
export const Suit = {
  SPADE: 0, // ♠
  CLUB: 1, // ♣
  DIAMOND: 2, // ♦
  HEART: 3, // ♥
} as const;
export type Suit = (typeof Suit)[keyof typeof Suit];

// Card Ranks - A is 1, 2 is 2, ..., J is 11, Q is 12, K is 13
export const Rank = {
  ACE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
  SEVEN: 7,
  EIGHT: 8,
  NINE: 9,
  TEN: 10,
  JACK: 11,
  QUEEN: 12,
  KING: 13,
} as const;
export type Rank = (typeof Rank)[keyof typeof Rank];

/**
 * Card Encoding: rank * 10 + suit
 */
export type Card = number;

export function encodeCard(rank: Rank, suit: Suit): Card {
  return rank * 10 + suit;
}

export function decodeCard(card: Card): { rank: Rank; suit: Suit } {
  const rank = Math.floor(card / 10) as Rank;
  const suit = (card % 10) as Suit;
  return { rank, suit };
}

export type PhomType = "kind" | "straight";

export interface PhomGroup {
  type: PhomType;
  cards: Card[];
}

export interface PlayerSlot {
  id: string | null;
  username: string;
  hand: Card[]; // Hidden to others
  eatenCards: Card[]; // Cards eaten from others, visible
  phoms: PhomGroup[]; // Melded Phoms, visible
  discardPile: Card[]; // Cards discarded by this player
  isBot: boolean;
  isHost: boolean;
  isDealer: boolean; // First player to discard (10 cards)
  rank: number | null; // Final rank (1st, 2nd...)
  score: number; // Final score
  isMom: boolean; // No phom at end of game
  showedPhom: boolean; // Has finished showing Phoms and sending cards
}

export type GamePhase = "waiting" | "playing" | "showing" | "ended";

export interface NewGameRequest {
  fromId: string;
  fromName: string;
}

export interface PhomState {
  players: PlayerSlot[];
  deck: Card[];
  drawPile: Card[];
  currentTurnIndex: number;
  lastDiscardedCard: Card | null;
  lastDiscardedBy: string | null;
  roundNumber: number; // 1-4
  turnPhase: "drawing" | "discarding";
  winner: string | null;
  gamePhase: GamePhase;
  newGameRequest: NewGameRequest | null;
  sentCards: {
    fromId: string;
    card: Card;
    toId: string;
    toPhomIndex: number;
  }[];
  discardHistory: { card: Card; playerId: string; playerName: string }[];
}

export interface DrawAction {
  type: "DRAW";
  playerId: string;
}

export interface EatAction {
  type: "EAT";
  playerId: string;
}

export interface DiscardAction {
  type: "DISCARD";
  playerId: string;
  card: Card;
}

export interface ShowPhomAction {
  type: "SHOW_PHOM";
  playerId: string;
  phoms: PhomGroup[];
}

export interface SendCardsAction {
  type: "SEND_CARDS";
  playerId: string;
  cards: { card: Card; targetPlayerId: string; phomIndex: number }[];
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

export type PhomAction =
  | DrawAction
  | EatAction
  | DiscardAction
  | ShowPhomAction
  | SendCardsAction
  | AddBotAction
  | JoinSlotAction
  | RemovePlayerAction
  | StartGameAction
  | NewGameAction
  | RequestNewGameAction
  | AcceptNewGameAction
  | DeclineNewGameAction;

export const RANK_DISPLAY: Record<Rank, string> = {
  [Rank.ACE]: "A",
  [Rank.TWO]: "2",
  [Rank.THREE]: "3",
  [Rank.FOUR]: "4",
  [Rank.FIVE]: "5",
  [Rank.SIX]: "6",
  [Rank.SEVEN]: "7",
  [Rank.EIGHT]: "8",
  [Rank.NINE]: "9",
  [Rank.TEN]: "10",
  [Rank.JACK]: "J",
  [Rank.QUEEN]: "Q",
  [Rank.KING]: "K",
};
