import { BaseGame, type GameAction } from "../BaseGame";
import { blendCardsWithOpacity, colorSimilarity, shuffle } from "./helper";
import type {
  IroKarutaState,
  IroKarutaAction,
  RGB,
  ColorCard,
  PlayerData,
} from "./types";

// ============================================================
// CMYK+W palette — 5 ink colors, like translucent cards
// ============================================================

const CMYK_COLORS: { color: RGB; label: string }[] = [
  { color: [0, 255, 255], label: "C" }, // Cyan — absorbs Red
  { color: [255, 0, 255], label: "M" }, // Magenta — absorbs Green
  { color: [255, 255, 0], label: "Y" }, // Yellow — absorbs Blue
  { color: [0, 0, 0], label: "K" }, // Black — absorbs all (shade)
  { color: [255, 255, 255], label: "W" }, // White — lightens (tint)
];

// Each color has 3 fixed density levels (like the real Iro Karuta)
const OPACITIES = [0.3, 0.5, 0.7] as const;

/** Build the full deck: 5 colors × 3 opacities = 15 cards */
function buildDeck(): ColorCard[] {
  const cards: ColorCard[] = [];
  let id = 0;
  for (const c of CMYK_COLORS) {
    for (const opacity of OPACITIES) {
      cards.push({ id: id++, color: c.color, opacity, label: c.label });
    }
  }
  return cards;
}

// ============================================================
// IroKaruta Game
// ============================================================

export default class IroKaruta extends BaseGame<IroKarutaState> {
  private roundTimer: ReturnType<typeof setTimeout> | null = null;

  protected init(): void {
    this.setGameName("irokaruta");
  }

  getInitState(): IroKarutaState {
    return {
      phase: "waiting",
      round: 0,
      maxRounds: 5,
      targetColor: [0, 0, 0],
      availableCards: [],
      playerData: {},
      roundStartTime: 0,
      answerCardIds: [],
    };
  }

  isGameOver(state: IroKarutaState): boolean {
    return state.phase === "summary" && state.round >= state.maxRounds;
  }

  // ──────────────────────────────────────────────
  // Socket action handler (host-only logic)
  // ──────────────────────────────────────────────

  onSocketGameAction({ action }: { action: GameAction }): void {
    if (!this.isHost) return;
    const a = action as IroKarutaAction;

    switch (a.type) {
      case "START_GAME":
        this.startGame();
        break;

      case "DROP_CARD":
        this.handleDropCard(a.playerId, a.cardId);
        break;

      case "REMOVE_CARD":
        this.handleRemoveCard(a.playerId, a.cardId);
        break;

      case "NEXT_ROUND":
        this.startRound();
        break;

      case "RESET_GAME":
        this.resetGame();
        break;
    }
  }

  // ──────────────────────────────────────────────
  // Game logic
  // ──────────────────────────────────────────────

  private startGame(): void {
    // Init player data
    const pd: Record<string, PlayerData> = {};
    for (const p of this.players) {
      pd[p.id] = {
        cardsInZone: [],
        finishedAt: null,
        score: 0,
      };
    }
    this.state.playerData = pd;
    this.state.round = 0;
    this.startRound();
  }

  private startRound(): void {
    this.state.round++;
    if (this.state.round > this.state.maxRounds) {
      this.state.phase = "summary";
      return;
    }

    // Build the full 15-card deck (5 colors × 3 opacities)
    const deck = buildDeck();

    // Pick 2–3 answer cards (must include at least 1 ink card, not pure white)
    const answerCount = Math.random() < 0.5 ? 2 : 3;
    const shuffledDeck = shuffle(deck);

    // Ensure at least one non-white card in the answer
    const inkCards = shuffledDeck.filter(
      (c) => !(c.color[0] === 255 && c.color[1] === 255 && c.color[2] === 255),
    );
    const firstInk = inkCards[0];
    const remaining = shuffledDeck.filter((c) => c.id !== firstInk.id);
    const answerCards = [firstInk, ...remaining.slice(0, answerCount - 1)];

    // Target is the CMYK+W blend of the answer cards
    const targetColor = blendCardsWithOpacity(answerCards);

    // All 15 cards are available (re-shuffle for display)
    const availableCards = shuffle(deck);

    // Find answer card IDs in the available array (match by color + opacity)
    const answerCardIds = availableCards
      .filter((card) =>
        answerCards.some(
          (a) =>
            a.color[0] === card.color[0] &&
            a.color[1] === card.color[1] &&
            a.color[2] === card.color[2] &&
            a.opacity === card.opacity,
        ),
      )
      .map((c) => c.id);

    // Reset each player's zone for the new round
    for (const pid of Object.keys(this.state.playerData)) {
      this.state.playerData[pid].cardsInZone = [];
      this.state.playerData[pid].finishedAt = null;
    }

    // Also add any new players who joined mid-game
    for (const p of this.players) {
      if (!this.state.playerData[p.id]) {
        this.state.playerData[p.id] = {
          cardsInZone: [],
          finishedAt: null,
          score: 0,
        };
      }
    }

    this.state.targetColor = targetColor;
    this.state.availableCards = availableCards;
    this.state.answerCardIds = answerCardIds;
    this.state.roundStartTime = Date.now();
    this.state.phase = "playing";
  }
  private handleDropCard(playerId: string, cardId: number): void {
    if (this.state.phase !== "playing") return;
    const pd = this.state.playerData[playerId];
    if (!pd || pd.finishedAt !== null) return;
    // Don't add duplicate
    if (pd.cardsInZone.includes(cardId)) return;

    pd.cardsInZone.push(cardId);
    this.evaluatePlayer(playerId);
  }

  private handleRemoveCard(playerId: string, cardId: number): void {
    if (this.state.phase !== "playing") return;
    const pd = this.state.playerData[playerId];
    if (!pd || pd.finishedAt !== null) return;

    const idx = pd.cardsInZone.indexOf(cardId);
    if (idx !== -1) {
      pd.cardsInZone.splice(idx, 1);
    }
    this.evaluatePlayer(playerId);
  }

  private evaluatePlayer(playerId: string): void {
    const pd = this.state.playerData[playerId];
    if (!pd) return;

    if (pd.cardsInZone.length === 0) return;

    // Compute blended color from cards in zone (with per-card opacity)
    const cards = pd.cardsInZone
      .map((id) => this.state.availableCards.find((c) => c.id === id))
      .filter(Boolean) as ColorCard[];

    const blended = blendCardsWithOpacity(cards);
    const sim = colorSimilarity(blended, this.state.targetColor);

    if (sim >= 100) {
      pd.finishedAt = Date.now();
      const elapsed = pd.finishedAt - this.state.roundStartTime;
      const roundScore = Math.max(100, Math.round(1000 - elapsed / 100));
      pd.score += roundScore;

      this.checkRoundEnd();
    }
  }

  private checkRoundEnd(): void {
    const allFinished = Object.values(this.state.playerData).every(
      (pd) => pd.finishedAt !== null,
    );
    if (allFinished) {
      // Short delay then show summary
      if (this.roundTimer) clearTimeout(this.roundTimer);
      this.roundTimer = setTimeout(() => {
        if (this.state.round >= this.state.maxRounds) {
          this.state.phase = "summary";
        } else {
          this.state.phase = "summary";
        }
      }, 1500);
    }
  }

  private resetGame(): void {
    const init = this.getInitState();
    Object.assign(this.state, init);
  }

  destroy(): void {
    if (this.roundTimer) clearTimeout(this.roundTimer);
    super.destroy();
  }
}
