import { BaseGame, type GameAction, type GameResult } from "../BaseGame";
import {
  type PhomState,
  type PhomAction,
  type Card,
  type PlayerSlot,
  type PhomGroup,
  Suit,
  Rank,
  encodeCard,
  decodeCard,
} from "./types";
import type { Player } from "../../stores/roomStore";

export default class Phom extends BaseGame<PhomState> {
  protected isGameOver(state: PhomState): boolean {
    return state.gamePhase === "ended";
  }

  getInitState(): PhomState {
    const slots: PlayerSlot[] = Array(4)
      .fill(null)
      .map((_, i) => {
        const player = this.players[i];
        return {
          id: player?.id || null,
          username: player?.username || `Slot ${i + 1}`,
          hand: [],
          eatenCards: [],
          phoms: [],
          discardPile: [],
          isBot: false,
          isHost: player?.id === this.userId,
          isDealer: false,
          rank: null,
          score: 0,
          isMom: false,
          showedPhom: false,
        };
      });

    return {
      players: slots,
      deck: [],
      drawPile: [],
      currentTurnIndex: 0,
      lastDiscardedCard: null,
      lastDiscardedBy: null,
      roundNumber: 1,
      turnPhase: "drawing",
      winner: null,
      gamePhase: "waiting",
      newGameRequest: null,
      sentCards: [],
      discardHistory: [],
    };
  }

  onSocketGameAction(data: { action: GameAction }): void {
    const action = data.action as PhomAction;

    if (!this.isHost) return;

    switch (action.type) {
      case "DRAW":
        this.handleDraw(action.playerId);
        break;
      case "EAT":
        this.handleEat(action.playerId);
        break;
      case "DISCARD":
        this.handleDiscard(action.playerId, action.card);
        break;
      case "START_GAME":
        this.handleStartGame();
        break;
      case "ADD_BOT":
        this.handleAddBot(action.slotIndex);
        break;
      case "JOIN_SLOT":
        this.handleJoinSlot(
          action.slotIndex,
          action.playerId,
          action.playerName,
        );
        break;
      case "REMOVE_PLAYER":
        this.handleRemovePlayer(action.slotIndex);
        break;
      case "NEW_GAME":
        this.reset();
        break;
      case "REQUEST_NEW_GAME":
        this.handleNewGameRequest(action.playerId, action.playerName);
        break;
      case "ACCEPT_NEW_GAME":
        this.reset();
        break;
      case "DECLINE_NEW_GAME":
        this.state.newGameRequest = null;
        break;
    }

    this.checkBotTurn();
  }

  // ============== Card Logic ==============

  private createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of [Suit.SPADE, Suit.CLUB, Suit.DIAMOND, Suit.HEART]) {
      for (const rank of Object.values(Rank)) {
        deck.push(encodeCard(rank as Rank, suit as Suit));
      }
    }
    return deck;
  }

  private shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private dealCards(): void {
    const deck = this.shuffleDeck(this.createDeck());
    // In Phom, usually 9 cards, dealer gets 10
    const dealerIndex = this.state.currentTurnIndex;

    let cardIndex = 0;
    for (let i = 0; i < 4; i++) {
      const player = this.state.players[i];
      if (player.id !== null) {
        const count = i === dealerIndex ? 10 : 9;
        player.hand = deck.slice(cardIndex, cardIndex + count);
        player.isDealer = i === dealerIndex;
        cardIndex += count;
        this.sortHand(player.hand);
      }
    }
    this.state.drawPile = deck.slice(cardIndex);
    this.state.turnPhase = "discarding"; // Dealer starts by discarding
  }

  private sortHand(hand: Card[]): void {
    hand.sort((a, b) => {
      const da = decodeCard(a);
      const db = decodeCard(b);
      if (da.rank !== db.rank) return da.rank - db.rank;
      return da.suit - db.suit;
    });
  }

  // ============== Game Actions ==============

  private handleDraw(playerId: string): void {
    if (
      this.state.gamePhase !== "playing" ||
      this.state.turnPhase !== "drawing"
    )
      return;
    const playerIndex = this.state.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== this.state.currentTurnIndex) return;

    if (this.state.drawPile.length === 0) {
      this.autoResolveShowing();
      return;
    }

    const card = this.state.drawPile.shift()!;
    this.state.players[playerIndex].hand.push(card);
    this.sortHand(this.state.players[playerIndex].hand);

    // Check for "Ù" (win immediately if full phom)
    if (this.checkU(playerId)) return;

    this.state.turnPhase = "discarding";
    this.checkBotTurn();
  }

  private handleEat(playerId: string): void {
    if (
      this.state.gamePhase !== "playing" ||
      this.state.turnPhase !== "drawing"
    )
      return;
    const playerIndex = this.state.players.findIndex((p) => p.id === playerId);
    if (
      playerIndex !== this.state.currentTurnIndex ||
      !this.state.lastDiscardedCard
    )
      return;

    const player = this.state.players[playerIndex];
    const card = this.state.lastDiscardedCard;

    // Check if card can form a Phom
    if (!this.canFormPhom(player.hand, card)) return;

    player.hand.push(card);
    player.eatenCards.push(card);
    this.state.lastDiscardedCard = null;
    this.state.lastDiscardedBy = null;

    // Check for "Ù"
    if (this.checkU(playerId)) return;

    this.state.turnPhase = "discarding";

    this.checkBotTurn();
  }

  private handleDiscard(playerId: string, card: Card): void {
    if (
      this.state.gamePhase !== "playing" ||
      this.state.turnPhase !== "discarding"
    )
      return;
    const playerIndex = this.state.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== this.state.currentTurnIndex) return;

    const player = this.state.players[playerIndex];
    const cardIdx = player.hand.indexOf(card);
    if (cardIdx === -1) return;

    player.hand.splice(cardIdx, 1);
    player.discardPile.push(card);
    this.state.lastDiscardedCard = card;
    this.state.lastDiscardedBy = playerId;
    this.state.discardHistory.push({
      card,
      playerId,
      playerName: player.username,
    });

    // Check for "Ù" after discard (9 cards)
    if (this.checkU(playerId)) return;

    // Advance turn
    this.advanceTurn();
  }

  private advanceTurn(): void {
    const prevIndex = this.state.currentTurnIndex;
    let nextIndex = (prevIndex + 1) % 4;
    while (this.state.players[nextIndex].id === null) {
      nextIndex = (nextIndex + 1) % 4;
    }

    this.state.currentTurnIndex = nextIndex;
    this.state.turnPhase = "drawing";

    // Round logic: when turn returns to dealer
    if (this.state.players[nextIndex].isDealer) {
      if (this.state.roundNumber < 4) {
        this.state.roundNumber++;
      }
    }

    this.checkBotTurn();
  }

  private endGame(winnerId?: string): void {
    const activePlayers = this.state.players.filter((p) => p.id !== null);

    // If Ù winner, partition their hand into phoms
    if (winnerId) {
      const winner = activePlayers.find((p) => p.id === winnerId);
      if (winner) {
        const bestPhoms = this.findBestPartition(winner.hand);
        winner.phoms = bestPhoms;
        const phomCards = new Set(bestPhoms.flatMap((p) => p.cards));
        winner.hand = winner.hand.filter((c) => !phomCards.has(c));
        winner.showedPhom = true;
      }

      // Also resolve phoms for other players
      for (const player of activePlayers) {
        if (player.id === winnerId) continue;
        const bestPhoms = this.findBestPartition(player.hand);
        player.phoms = bestPhoms;
        const phomCards = new Set(bestPhoms.flatMap((p) => p.cards));
        player.hand = player.hand.filter((c) => !phomCards.has(c));
        player.isMom = bestPhoms.length === 0 && player.eatenCards.length === 0;
        player.showedPhom = true;
      }
    }

    // Calculate scores and ranks
    this.state.players.forEach((p) => {
      if (p.id) {
        if (p.id === winnerId) {
          p.score = 0;
          p.isMom = false;
        } else {
          p.score = this.calculateHandScore(p);
          // A player is Mom if they have NO phoms at the end
          p.isMom = p.phoms.length === 0 && p.eatenCards.length === 0;
        }
      }
    });

    // Sort by score (lowest wins)
    const ranked = this.state.players
      .filter((p) => p.id !== null)
      .sort((a, b) => {
        if (winnerId) {
          if (a.id === winnerId) return -1;
          if (b.id === winnerId) return 1;
        }
        if (a.isMom && !b.isMom) return 1;
        if (!a.isMom && b.isMom) return -1;
        return a.score - b.score;
      });

    ranked.forEach((p, i) => {
      p.rank = i + 1;
    });

    this.state.winner = winnerId || ranked[0].id;
    this.state.gamePhase = "ended";
  }

  private calculateHandScore(player: PlayerSlot): number {
    // Score only the cards remaining in hand (trash cards)
    return player.hand.reduce((sum, c) => sum + (decodeCard(c).rank + 1), 0);
  }

  // ============== Auto-Resolve Showing ==============

  /**
   * Find the best partition of cards into non-overlapping phoms.
   * Maximizes the number of cards in phoms (minimizes trash score).
   */
  private findBestPartition(cards: Card[]): PhomGroup[] {
    let bestPhoms: PhomGroup[] = [];
    let bestCoveredCount = 0;

    const search = (
      remaining: Card[],
      currentPhoms: PhomGroup[],
      coveredCount: number,
    ) => {
      if (coveredCount > bestCoveredCount) {
        bestCoveredCount = coveredCount;
        bestPhoms = currentPhoms.map((p) => ({
          ...p,
          cards: [...p.cards],
        }));
      }

      if (remaining.length < 3) return;

      const possiblePhoms = this.findPhoms(remaining);
      // Deduplicate phoms
      const seen = new Set<string>();
      const uniquePhoms = possiblePhoms.filter((p) => {
        const key = [...p.cards].sort().join(",");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      for (const phom of uniquePhoms) {
        const newRemaining = this.removeCards(remaining, phom.cards);
        search(
          newRemaining,
          [...currentPhoms, phom],
          coveredCount + phom.cards.length,
        );
      }
    };

    search([...cards].sort(), [], 0);
    return bestPhoms;
  }

  /**
   * Auto-resolve the showing phase:
   * 1. Find best phom partition for each player
   * 2. Auto-send compatible trash cards to others' phoms
   * 3. Record sent cards for UI animation
   * 4. Transition to "showing" then auto-end after delay
   */
  private autoResolveShowing(): void {
    const activePlayers = this.state.players.filter((p) => p.id !== null);

    // Step 1: Find best phoms for each player
    for (const player of activePlayers) {
      const bestPhoms = this.findBestPartition(player.hand);
      player.phoms = bestPhoms;
      // Remove phom cards from hand
      const phomCards = new Set(bestPhoms.flatMap((p) => p.cards));
      player.hand = player.hand.filter((c) => !phomCards.has(c));
      player.isMom = bestPhoms.length === 0 && player.eatenCards.length === 0;
      player.showedPhom = true;
    }

    // Step 2: Auto-send compatible trash cards
    const sentCards: {
      fromId: string;
      card: Card;
      toId: string;
      toPhomIndex: number;
    }[] = [];

    for (const player of activePlayers) {
      for (const card of [...player.hand]) {
        let sent = false;
        for (const target of activePlayers) {
          if (target.id === player.id || sent) continue;
          for (let pi = 0; pi < target.phoms.length; pi++) {
            const targetPhom = target.phoms[pi];
            const combined = [...targetPhom.cards, card];
            const newPhoms = this.findPhoms(combined);
            if (newPhoms.some((p) => p.cards.length === combined.length)) {
              // Send the card
              const idx = player.hand.indexOf(card);
              if (idx !== -1) player.hand.splice(idx, 1);
              targetPhom.cards.push(card);
              this.sortHand(targetPhom.cards);
              sentCards.push({
                fromId: player.id!,
                card,
                toId: target.id!,
                toPhomIndex: pi,
              });
              sent = true;
              break;
            }
          }
        }
      }
    }

    this.state.sentCards = sentCards;
    this.endGame();
  }

  // ============== Helper Logic ==============

  private canFormPhom(hand: Card[], card: Card): boolean {
    const combined = [...hand, card];
    const phoms = this.findPhoms(combined);
    return phoms.some((p) => p.cards.includes(card));
  }

  private findPhoms(cards: Card[]): PhomGroup[] {
    const phoms: PhomGroup[] = [];
    // 1. Find same rank (Kind)
    const byRank: Record<number, Card[]> = {};
    cards.forEach((c) => {
      const { rank } = decodeCard(c);
      if (!byRank[rank]) byRank[rank] = [];
      byRank[rank].push(c);
    });
    Object.values(byRank).forEach((group) => {
      if (group.length >= 3) phoms.push({ type: "kind", cards: group });
      if (group.length === 4) {
        // Also add subsets of 3 for Kind if needed for complex partitioning
        // But for most cases, the full 4 is enough.
        // Actually for partitioning, we might need all possible combinations.
      }
    });

    // 2. Find same suit (Straight)
    const bySuit: Record<number, Card[]> = {};
    cards.forEach((c) => {
      const { suit } = decodeCard(c);
      if (!bySuit[suit]) bySuit[suit] = [];
      bySuit[suit].push(c);
    });
    Object.values(bySuit).forEach((group) => {
      const sorted = [...group].sort(
        (a, b) => decodeCard(a).rank - decodeCard(b).rank,
      );

      // Recursive straight finder to handle gaps and overlaps
      for (let i = 0; i < sorted.length; i++) {
        let current: Card[] = [sorted[i]];
        for (let j = i + 1; j < sorted.length; j++) {
          if (
            decodeCard(sorted[j]).rank ===
            decodeCard(current[current.length - 1]).rank + 1
          ) {
            current.push(sorted[j]);
            if (current.length >= 3) {
              phoms.push({ type: "straight", cards: [...current] });
            }
          } else if (
            decodeCard(sorted[j]).rank >
            decodeCard(current[current.length - 1]).rank + 1
          ) {
            break;
          }
        }
      }
    });

    return phoms;
  }

  private checkU(playerId: string): boolean {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return false;

    // Check if hand can be fully partitioned into phoms
    if (this.canPartitionIntoPhoms(player.hand)) {
      this.endGame(playerId);
      return true;
    }
    return false;
  }

  private canPartitionIntoPhoms(cards: Card[]): boolean {
    if (cards.length === 0) return true;
    if (cards.length < 3) return false;

    const sortedCards = [...cards].sort((a, b) => a - b);
    const firstCard = sortedCards[0];
    const candidatePhoms = this.findAllPhomsContainingCard(
      sortedCards,
      firstCard,
    );

    for (const phom of candidatePhoms) {
      const remaining = this.removeCards(sortedCards, phom.cards);
      if (this.canPartitionIntoPhoms(remaining)) {
        return true;
      }
    }

    return false;
  }

  private findAllPhomsContainingCard(
    cards: Card[],
    targetCard: Card,
  ): PhomGroup[] {
    const phoms = this.findPhoms(cards);
    return phoms.filter((p) => p.cards.includes(targetCard));
  }

  private removeCards(allCards: Card[], toRemove: Card[]): Card[] {
    let result = [...allCards];
    for (const card of toRemove) {
      const idx = result.indexOf(card);
      if (idx !== -1) {
        result.splice(idx, 1);
      }
    }
    return result;
  }

  // ============== Slot Management ==============

  private handleStartGame(): void {
    if (this.state.gamePhase !== "waiting") return;
    const filledSlots = this.state.players.filter((p) => p.id !== null).length;
    if (filledSlots < 2) return;

    this.state.currentTurnIndex = Math.floor(Math.random() * 4);
    while (this.state.players[this.state.currentTurnIndex].id === null) {
      this.state.currentTurnIndex = (this.state.currentTurnIndex + 1) % 4;
    }

    this.dealCards();
    this.state.gamePhase = "playing";
    this.state.roundNumber = 1;
    this.checkBotTurn();
  }

  private handleAddBot(slotIndex: number): void {
    if (
      slotIndex < 0 ||
      slotIndex >= 4 ||
      this.state.players[slotIndex].id !== null
    )
      return;
    this.state.players[slotIndex] = {
      id: `BOT_${slotIndex}_${Date.now()}`,
      username: `Bot ${slotIndex + 1}`,
      hand: [],
      eatenCards: [],
      phoms: [],
      discardPile: [],
      isBot: true,
      isHost: false,
      isDealer: false,
      rank: null,
      score: 0,
      isMom: false,
      showedPhom: false,
    };
  }

  private handleJoinSlot(
    slotIndex: number,
    playerId: string,
    playerName: string,
  ): void {
    if (
      slotIndex < 0 ||
      slotIndex >= 4 ||
      this.state.players[slotIndex].id !== null
    )
      return;
    if (this.state.players.some((p) => p.id === playerId)) return;
    this.state.players[slotIndex] = {
      id: playerId,
      username: playerName,
      hand: [],
      eatenCards: [],
      phoms: [],
      discardPile: [],
      isBot: false,
      isHost: playerId === this.userId,
      isDealer: false,
      rank: null,
      score: 0,
      isMom: false,
      showedPhom: false,
    };
  }

  private handleRemovePlayer(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= 4 || this.state.gamePhase !== "waiting")
      return;
    this.state.players[slotIndex] = {
      id: null,
      username: `Slot ${slotIndex + 1}`,
      hand: [],
      eatenCards: [],
      phoms: [],
      discardPile: [],
      isBot: false,
      isHost: false,
      isDealer: false,
      rank: null,
      score: 0,
      isMom: false,
      showedPhom: false,
    };
  }

  // ============== Bot AI ==============

  private checkBotTurn(): void {
    if (!this.isHost) return;
    if (this.state.gamePhase !== "playing") return;

    const currentPlayer = this.state.players[this.state.currentTurnIndex];
    if (currentPlayer.isBot && currentPlayer.id) {
      setTimeout(() => this.makeBotMove(currentPlayer), 1000);
    }
  }

  private makeBotMove(bot: PlayerSlot): void {
    if (this.state.gamePhase !== "playing") return;

    if (this.state.turnPhase === "drawing") {
      if (
        this.state.lastDiscardedCard &&
        this.canFormPhom(bot.hand, this.state.lastDiscardedCard)
      ) {
        this.handleEat(bot.id!);
      } else {
        this.handleDraw(bot.id!);
      }
    } else if (this.state.turnPhase === "discarding") {
      const phoms = this.findPhoms(bot.hand);
      const cardsInPhoms = new Set(phoms.flatMap((p) => p.cards));
      const candidates = bot.hand.filter((c) => !cardsInPhoms.has(c));

      let cardToDiscard;
      if (candidates.length > 0) {
        candidates.sort((a, b) => decodeCard(b).rank - decodeCard(a).rank);
        cardToDiscard = candidates[0];
      } else {
        const sorted = [...bot.hand].sort(
          (a, b) => decodeCard(b).rank - decodeCard(a).rank,
        );
        cardToDiscard = sorted[0];
      }
      this.handleDiscard(bot.id!, cardToDiscard);
    }
  }

  private handleNewGameRequest(playerId: string, playerName: string): void {
    if (this.isHost) {
      this.reset();
    } else {
      this.state.newGameRequest = { fromId: playerId, fromName: playerName };
    }
  }

  reset(): void {
    const slots = this.state.players.map((p) => ({
      ...p,
      hand: [],
      eatenCards: [],
      phoms: [],
      discardPile: [],
      isDealer: false,
      rank: null,
      score: 0,
      isMom: false,
      showedPhom: false,
    }));
    this.state = {
      ...this.getInitState(),
      players: slots as any,
    };
    this.state.sentCards = [];
  }

  checkGameEnd(): GameResult | null {
    if (this.state.winner) return { winner: this.state.winner };
    return null;
  }

  updatePlayers(players: Player[]): void {
    for (let i = 0; i < 4; i++) {
      const slot = this.state.players[i];
      if (!slot.isBot) {
        const p = players.find((p) => p.id === slot.id);
        if (p) {
          slot.username = p.username;
        } else {
          slot.id = null;
          slot.username = `Slot ${i + 1}`;
          slot.hand = [];
          slot.eatenCards = [];
          slot.phoms = [];
          slot.discardPile = [];
        }
      }
    }
  }

  // Public methods for UI
  public requestDraw() {
    this.makeAction({ type: "DRAW", playerId: this.userId });
  }
  public requestEat() {
    this.makeAction({ type: "EAT", playerId: this.userId });
  }
  public requestDiscard(card: Card) {
    this.makeAction({ type: "DISCARD", playerId: this.userId, card });
  }
  public requestAddBot(idx: number) {
    this.makeAction({ type: "ADD_BOT", slotIndex: idx });
  }
  public requestJoinSlot(idx: number, name: string) {
    this.makeAction({
      type: "JOIN_SLOT",
      slotIndex: idx,
      playerId: this.userId,
      playerName: name,
    });
  }
  public requestRemovePlayer(idx: number) {
    this.makeAction({ type: "REMOVE_PLAYER", slotIndex: idx });
  }
  public requestStartGame() {
    this.makeAction({ type: "START_GAME" });
  }
  public requestNewGame() {
    this.makeAction({
      type: "REQUEST_NEW_GAME",
      playerId: this.userId,
      playerName: "",
    });
  }

  public acceptNewGame(): void {
    if (!this.isHost) return;
    this.onSocketGameAction({ action: { type: "ACCEPT_NEW_GAME" } });
  }

  public declineNewGame(): void {
    if (!this.isHost) return;
    this.onSocketGameAction({ action: { type: "DECLINE_NEW_GAME" } });
  }

  public getMyPlayerIndex(): number {
    return this.state.players.findIndex((p) => p.id === this.userId);
  }

  public getUserId(): string {
    return this.userId;
  }

  public canStartGame(): boolean {
    if (this.state.gamePhase !== "waiting") return false;
    const filledSlots = this.state.players.filter((p) => p.id !== null).length;
    return filledSlots >= 2;
  }

  public canFormPhomPublic(hand: Card[], card: Card): boolean {
    return this.canFormPhom(hand, card);
  }

  public getPhomsPublic(hand: Card[]): PhomGroup[] {
    return this.findBestPartition(hand);
  }

  /**
   * Suggests which cards to discard (not in any Phom)
   */
  public getDiscardSuggestionsPublic(hand: Card[]): Card[] {
    const phoms = this.findPhoms(hand);
    const cardsInPhoms = new Set(phoms.flatMap((p) => p.cards));
    const candidates = hand.filter((c) => !cardsInPhoms.has(c));
    // Sort by rank descending
    return candidates.sort((a, b) => decodeCard(b).rank - decodeCard(a).rank);
  }
}
