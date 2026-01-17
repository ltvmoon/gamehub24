export type WerewolfRole =
  | "VILLAGER"
  | "WOLF"
  | "SEER"
  | "BODYGUARD"
  | "LAWYER"
  | "DETECTIVE"
  | "DECEIVER";

export type WerewolfPhase =
  | "WAITING"
  | "NIGHT"
  | "DAY_SUSPICION"
  | "DAY_DEFENSE"
  | "DAY_VOTE"
  | "FINISHED";

export interface WerewolfPlayer {
  id: string;
  role: WerewolfRole | null;
  isAlive: boolean;
  votes: number;
}

export interface WerewolfMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  phase: WerewolfPhase;
  isSystem?: boolean;
}

export interface WerewolfState {
  players: Record<string, WerewolfPlayer>;
  phase: WerewolfPhase;
  dayCount: number;
  timeRemaining: number;
  history: string[]; // Keep for log compatibility

  // Chat & Interaction
  messages: WerewolfMessage[];
  suspicion: Record<string, number>; // playerId -> suspicion count
  reactions: Record<string, Record<string, string>>; // msgId -> userId -> emoji

  // Voting/Action tracking
  votes: Record<string, string>; // voterId -> targetId
  wolfVotes: Record<string, string>; // wolfId -> targetId

  // Night Capabilities
  seerCheck: {
    seerId: string;
    targetId: string | null;
    result: WerewolfRole | null;
  } | null;
  bodyguardProtect: { bodyguardId: string; targetId: string } | null;

  // Day Capabilities
  lawyerSave: { lawyerId: string; targetId: string } | null; // Once per game
  detectiveCheck: {
    detectiveId: string;
    targetId: string;
    result: boolean;
  } | null;

  winner: "VILLAGERS" | "WOLVES" | null;
}

export type WerewolfAction =
  | { type: "START_GAME" }
  | { type: "ADD_BOT" }
  | { type: "REMOVE_BOT"; botId: string }
  | { type: "RESET_GAME" }
  // Night Actions
  | { type: "WOLF_KILL"; targetId: string }
  | { type: "SEER_CHECK"; targetId: string }
  | { type: "BODYGUARD_PROTECT"; targetId: string }
  // Day Actions
  | { type: "SPEECH"; text: string } // Chat message
  | { type: "SUSPECT"; targetId: string } // Ping suspicion
  | { type: "REACT"; msgId?: string; emoji?: string; targetId?: string } // React to msg or player (defense phase)
  | { type: "VOTE"; targetId: string | null }
  // Special Roles
  | { type: "LAWYER_SAVE"; targetId: string }
  | { type: "DETECTIVE_CHECK"; targetId: string }
  | { type: "DECEIVER_FAKE"; text: string };
