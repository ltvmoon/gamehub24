export const Suit = {
  SPADE: 0,
  CLUB: 1,
  DIAMOND: 2,
  HEART: 3,
} as const;
export type Suit = (typeof Suit)[keyof typeof Suit];

export const Rank = {
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
  ACE: 14,
} as const;
export type Rank = (typeof Rank)[keyof typeof Rank];

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const HandRanking = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9,
} as const;
export type HandRanking = (typeof HandRanking)[keyof typeof HandRanking];

export interface HandEvaluation {
  rank: HandRanking;
  cards: Card[]; // The 5 cards that make up the hand
  kickers: Card[]; // Remaining cards for tie-breaking
  name: string;
}

export interface PokerPlayer {
  id: string | null;
  username: string;
  hand: Card[]; // 2 cards (hole cards)
  chips: number;
  currentBet: number; // Bet in current round
  isBot: boolean;
  isGuest: boolean;
  isHost: boolean;
  hasFolded: boolean;
  isAllIn: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isActive: boolean; // Sitting out or playing
  hasActed: boolean; // Whether player has acted in current betting round
}

export type GamePhase =
  | "waiting"
  | "pre_flop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "ended";

export interface PokerState {
  players: PokerPlayer[];
  communityCards: Card[];
  pot: number;
  currentBet: number; // Current highest bet in the round
  dealerIndex: number;
  currentTurnIndex: number;
  smallBlindAmount: number;
  bigBlindAmount: number;
  gamePhase: GamePhase;
  winnerIds: string[]; // For showdown
  winningHand?: HandEvaluation;
  minRaise: number;
  lastAction?: {
    playerId: string;
    action: string;
    amount?: number;
  };
}

// Localization mappings
export const GAME_PHASES: Record<GamePhase, { en: string; vi: string }> = {
  waiting: { en: "Waiting", vi: "Đang chờ" },
  pre_flop: { en: "Pre-Flop", vi: "Pre-Flop" },
  flop: { en: "Flop", vi: "Flop" },
  turn: { en: "Turn", vi: "Turn" },
  river: { en: "River", vi: "River" },
  showdown: { en: "Showdown", vi: "Lật bài" },
  ended: { en: "Ended", vi: "Kết thúc" },
};

export const HAND_NAMES: Record<HandRanking, { en: string; vi: string }> = {
  [HandRanking.HIGH_CARD]: { en: "High Card", vi: "Mậu Thầu" },
  [HandRanking.PAIR]: { en: "Pair", vi: "Một Đôi" },
  [HandRanking.TWO_PAIR]: { en: "Two Pair", vi: "Thú (Hai Đôi)" },
  [HandRanking.THREE_OF_A_KIND]: { en: "Three of a Kind", vi: "Sám Cô" },
  [HandRanking.STRAIGHT]: { en: "Straight", vi: "Sảnh" },
  [HandRanking.FLUSH]: { en: "Flush", vi: "Thùng" },
  [HandRanking.FULL_HOUSE]: { en: "Full House", vi: "Cù Lũ" },
  [HandRanking.FOUR_OF_A_KIND]: { en: "Four of a Kind", vi: "Tứ Quý" },
  [HandRanking.STRAIGHT_FLUSH]: {
    en: "Straight Flush",
    vi: "Thùng Phá Sảnh",
  },
  [HandRanking.ROYAL_FLUSH]: { en: "Royal Flush", vi: "Thùng Phá Sảnh Lớn" },
};

// Actions
export interface FoldAction {
  type: "FOLD";
  playerId: string;
}

export interface CheckAction {
  type: "CHECK";
  playerId: string;
}

export interface CallAction {
  type: "CALL";
  playerId: string;
}

export interface RaiseAction {
  type: "RAISE";
  playerId: string;
  amount: number;
}

export interface AllInAction {
  type: "ALL_IN";
  playerId: string;
}

export interface StartGameAction {
  type: "START_GAME";
}

export interface AddBotAction {
  type: "ADD_BOT";
  slotIndex: number;
}

export interface ResetGameAction {
  type: "RESET_GAME";
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

export type PokerAction =
  | FoldAction
  | CheckAction
  | CallAction
  | RaiseAction
  | AllInAction
  | StartGameAction
  | AddBotAction
  | ResetGameAction
  | JoinSlotAction
  | RemovePlayerAction;

export const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.SPADE]: "♠",
  [Suit.CLUB]: "♣",
  [Suit.DIAMOND]: "♦",
  [Suit.HEART]: "♥",
};

export const RANK_DISPLAY: Record<Rank, string> = {
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
  [Rank.ACE]: "A",
};
