import { BaseGame, type GameAction, type GameResult } from "../BaseGame";
import type { Socket } from "socket.io-client";
import {
  type MonopolyState,
  type MonopolyAction,
  type MonopolyPlayer,
  type OwnedProperty,
  type Card,
  BOARD_SPACES,
  CHANCE_CARDS,
  CHEST_CARDS,
  START_MONEY,
  SALARY,
  JAIL_FINE,
  MAX_JAIL_TURNS,
  PLAYER_COLORS,
} from "./types";

export default class Monopoly extends BaseGame {
  private state: MonopolyState;
  private onStateChange?: (state: MonopolyState) => void;
  private chanceCards: Card[];
  private chestCards: Card[];
  private getOutOfJailCards: Map<string, number>; // playerId -> count

  constructor(
    roomId: string,
    socket: Socket,
    isHost: boolean,
    userId: string,
    players: { id: string; username: string }[]
  ) {
    super(roomId, socket, isHost, userId);

    // Shuffle cards
    this.chanceCards = [...CHANCE_CARDS].sort(() => Math.random() - 0.5);
    this.chestCards = [...CHEST_CARDS].sort(() => Math.random() - 0.5);
    this.getOutOfJailCards = new Map();

    // Initialize 4 player slots
    const initialPlayers: MonopolyPlayer[] = [];
    for (let i = 0; i < 4; i++) {
      const player = players[i];
      initialPlayers.push({
        id: player?.id || null,
        username: player?.username || `Player ${i + 1}`,
        color: PLAYER_COLORS[i],
        position: 0,
        money: START_MONEY,
        inJail: false,
        jailTurns: 0,
        isBankrupt: false,
        isBot: false,
      });
    }

    this.state = {
      players: initialPlayers,
      currentPlayerIndex: 0,
      properties: [],
      diceValues: null,
      doublesCount: 0,
      hasRolled: false,
      canRollAgain: false,
      gamePhase: "waiting",
      winner: null,
      pendingAction: null,
      lastAction: null,
    };
  }

  init(): void {
    if (this.isHost) {
      this.broadcastState();
    }
  }

  onUpdate(callback: (state: MonopolyState) => void): void {
    this.onStateChange = callback;
  }

  getState(): MonopolyState {
    return this.state;
  }

  setState(state: MonopolyState): void {
    this.state = state;
    this.onStateChange?.(this.state);
  }

  // Notify UI and broadcast - creates new state reference for React
  private notifyAndBroadcast(): void {
    // Create new state object to trigger React re-render
    this.state = {
      ...this.state,
      players: this.state.players.map((p) => ({ ...p })),
      properties: this.state.properties.map((p) => ({ ...p })),
    };
    this.onStateChange?.(this.state);
    this.broadcastState();
  }

  handleAction(data: { action: GameAction }): void {
    const action = data.action as MonopolyAction;

    switch (action.type) {
      case "START_GAME":
        this.handleStartGame();
        break;
      case "ROLL_DICE":
        this.handleRollDice(action.playerId);
        break;
      case "BUY_PROPERTY":
        this.handleBuyProperty(action.playerId, action.spaceId);
        break;
      case "DECLINE_PROPERTY":
        this.handleDeclineProperty(action.playerId);
        break;
      case "BUILD_HOUSE":
        this.handleBuildHouse(action.playerId, action.spaceId);
        break;
      case "PAY_RENT":
        this.handlePayRent(action.playerId);
        break;
      case "PAY_TAX":
        this.handlePayTax(action.playerId);
        break;
      case "USE_CARD":
        this.handleUseCard(action.playerId);
        break;
      case "PAY_JAIL_FINE":
        this.handlePayJailFine(action.playerId);
        break;
      case "END_TURN":
        this.handleEndTurn(action.playerId);
        break;
      case "ADD_BOT":
        this.handleAddBot(action.slotIndex);
        break;
      case "REMOVE_BOT":
        this.handleRemoveBot(action.slotIndex);
        break;
      case "REQUEST_SYNC":
        if (this.isHost) {
          this.broadcastState();
        }
        break;
    }
  }

  makeMove(action: MonopolyAction): void {
    if (this.isHost) {
      // Process action locally immediately for host
      this.handleAction({ action });
    } else {
      // Non-host sends action to host via socket
      this.sendAction(action);
    }
  }

  // === Game Flow ===

  private handleStartGame(): void {
    if (!this.isHost) return;
    if (this.state.gamePhase !== "waiting") return;

    // Count active players
    const activePlayers = this.state.players.filter((p) => p.id !== null);
    if (activePlayers.length < 2) return;

    this.state = {
      ...this.state,
      gamePhase: "playing",
      currentPlayerIndex: this.findFirstActivePlayer(),
      lastAction: "Game started!",
    };

    this.notifyAndBroadcast();
    this.checkBotTurn();
  }

  private findFirstActivePlayer(): number {
    for (let i = 0; i < this.state.players.length; i++) {
      if (this.state.players[i].id && !this.state.players[i].isBankrupt) {
        return i;
      }
    }
    return 0;
  }

  private handleRollDice(playerId: string): void {
    if (!this.isHost) return;
    if (this.state.gamePhase !== "playing") return;

    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;
    if (this.state.hasRolled && !this.state.canRollAgain) return;
    if (this.state.pendingAction) return;

    // Roll dice
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    // const total = die1 + die2;
    // const isDoubles = die1 === die2;

    this.state.diceValues = [die1, die2];
    this.state.hasRolled = true;
    this.state.lastAction = "Rolling...";

    this.notifyAndBroadcast();

    // Delay movement to allow UI animation to finish
    setTimeout(() => {
      this.processDiceResult(playerId, die1, die2);
    }, 1200);
  }

  private processDiceResult(
    playerId: string,
    die1: number,
    die2: number
  ): void {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    const total = die1 + die2;
    const isDoubles = die1 === die2;

    // Track doubles
    if (isDoubles) {
      this.state.doublesCount++;
      // 3 doubles = go to jail
      if (this.state.doublesCount >= 3) {
        this.sendToJail(player);
        this.state.lastAction = `${player.username} rolled 3 doubles, goes to jail!`;
        this.endTurn();
        this.notifyAndBroadcast(); // Notify changes
        return;
      }
      this.state.canRollAgain = true;
    } else {
      this.state.canRollAgain = false;
    }

    // In jail logic
    if (player.inJail) {
      if (isDoubles) {
        player.inJail = false;
        player.jailTurns = 0;
        this.state.lastAction = `${player.username} rolled doubles and escapes jail!`;
        this.movePlayer(player, total);
      } else {
        player.jailTurns++;
        if (player.jailTurns >= MAX_JAIL_TURNS) {
          // Force pay fine
          player.money -= JAIL_FINE;
          player.inJail = false;
          player.jailTurns = 0;
          this.state.lastAction = `${player.username} paid ${JAIL_FINE}đ and leaves jail`;
          this.movePlayer(player, total);
        } else {
          this.state.lastAction = `${player.username} stays in jail (turn ${player.jailTurns}/${MAX_JAIL_TURNS})`;
          this.state.canRollAgain = false;
        }
      }
    } else {
      this.movePlayer(player, total);
    }

    this.notifyAndBroadcast();

    // Check for bot turn after resolving any pending actions
    if (!this.state.pendingAction) {
      this.checkBotTurn();
    }
  }

  private movePlayer(player: MonopolyPlayer, spaces: number): void {
    const oldPosition = player.position;
    const newPosition = (player.position + spaces) % 40;

    // Passed GO?
    if (newPosition < oldPosition && spaces > 0) {
      player.money += SALARY;
      this.state.lastAction = `${player.username} passed GO, collects ${SALARY}đ`;
    }

    player.position = newPosition;
    this.handleLanding(player);
  }

  private handleLanding(player: MonopolyPlayer): void {
    const space = BOARD_SPACES[player.position];
    if (!space) return;

    switch (space.type) {
      case "go":
        // Just landed, already handled passing GO
        this.state.lastAction = `${player.username} landed on GO`;
        break;

      case "property":
      case "railroad":
      case "utility":
        this.handlePropertyLanding(player, space.id);
        break;

      case "tax":
        this.state.pendingAction = {
          type: "PAY_TAX",
          amount: space.taxAmount || 0,
        };
        this.state.lastAction = `${player.username} must pay ${space.taxAmount}đ tax`;
        break;

      case "chance":
        this.drawCard(player, "chance");
        break;

      case "chest":
        this.drawCard(player, "chest");
        break;

      case "jail":
        // Just visiting
        this.state.lastAction = `${player.username} is just visiting jail`;
        break;

      case "parking":
        // Free parking, nothing happens
        this.state.lastAction = `${player.username} landed on Free Parking`;
        break;

      case "gotojail":
        this.sendToJail(player);
        this.state.lastAction = `${player.username} goes to jail!`;
        break;
    }
  }

  private handlePropertyLanding(player: MonopolyPlayer, spaceId: number): void {
    const space = BOARD_SPACES[spaceId];
    const ownership = this.state.properties.find((p) => p.spaceId === spaceId);

    if (!ownership) {
      // Unowned - offer to buy
      if (space.price && player.money >= space.price) {
        this.state.pendingAction = { type: "BUY_DECISION", spaceId };
        this.state.lastAction = `${player.username} can buy ${space.nameVi} for ${space.price}đ`;
      } else {
        this.state.lastAction = `${player.username} cannot afford ${space.nameVi}`;
      }
    } else if (ownership.ownerId !== player.id && !ownership.mortgaged) {
      // Pay rent
      const rent = this.calculateRent(spaceId, ownership);
      const owner = this.state.players.find((p) => p.id === ownership.ownerId);
      if (owner && !owner.isBankrupt) {
        this.state.pendingAction = {
          type: "PAY_RENT",
          amount: rent,
          toPlayerId: ownership.ownerId,
        };
        this.state.lastAction = `${player.username} owes ${rent}đ rent to ${owner.username}`;
      }
    } else {
      this.state.lastAction = `${player.username} landed on their own property`;
    }
  }

  private calculateRent(spaceId: number, ownership: OwnedProperty): number {
    const space = BOARD_SPACES[spaceId];
    if (!space) return 0;

    if (space.type === "railroad") {
      // Count railroads owned by this player
      const railroadCount = this.state.properties.filter(
        (p) =>
          p.ownerId === ownership.ownerId &&
          BOARD_SPACES[p.spaceId]?.type === "railroad"
      ).length;
      return (space.baseRent || 250) * railroadCount;
    }

    if (space.type === "utility") {
      // Count utilities owned
      const utilityCount = this.state.properties.filter(
        (p) =>
          p.ownerId === ownership.ownerId &&
          BOARD_SPACES[p.spaceId]?.type === "utility"
      ).length;
      const diceTotal =
        (this.state.diceValues?.[0] || 1) + (this.state.diceValues?.[1] || 1);
      return utilityCount === 2 ? diceTotal * 10 : diceTotal * 4;
    }

    // Regular property
    if (!space.rent) return 0;

    // Check if player owns full color set
    const colorProperties = BOARD_SPACES.filter(
      (s) => s.color === space.color && s.type === "property"
    );
    const ownedInColor = colorProperties.filter((s) =>
      this.state.properties.some(
        (p) => p.spaceId === s.id && p.ownerId === ownership.ownerId
      )
    ).length;
    const ownsFullSet = ownedInColor === colorProperties.length;

    const houses = ownership.houses;
    if (houses > 0 && houses <= 5) {
      return space.rent[houses];
    }

    // Base rent, doubled if full set with no houses
    return ownsFullSet ? space.rent[0] * 2 : space.rent[0];
  }

  private drawCard(player: MonopolyPlayer, type: "chance" | "chest"): void {
    const cards = type === "chance" ? this.chanceCards : this.chestCards;
    const card = cards.shift();
    if (!card) return;

    // Put card back at bottom (unless it's get out of jail free)
    if (card.action.type !== "GET_OUT_JAIL") {
      cards.push(card);
    }

    this.state.pendingAction = { type: "CARD", card };
    this.state.lastAction = `${player.username} draws: ${card.textVi}`;
  }

  private sendToJail(player: MonopolyPlayer): void {
    player.position = 10; // Jail position
    player.inJail = true;
    player.jailTurns = 0;
    this.state.canRollAgain = false;
  }

  // === Property Actions ===

  private handleBuyProperty(playerId: string, spaceId: number): void {
    if (!this.isHost) return;

    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;

    const pending = this.state.pendingAction;
    if (
      !pending ||
      pending.type !== "BUY_DECISION" ||
      pending.spaceId !== spaceId
    )
      return;

    const space = BOARD_SPACES[spaceId];
    if (!space || !space.price || player.money < space.price) return;

    player.money -= space.price;
    this.state.properties.push({
      spaceId,
      ownerId: player.id!,
      houses: 0,
      mortgaged: false,
    });

    this.state.pendingAction = null;
    this.state.lastAction = `${player.username} bought ${space.nameVi} for ${space.price}đ`;

    this.notifyAndBroadcast();
    this.checkBotTurn();
  }

  private handleDeclineProperty(playerId: string): void {
    if (!this.isHost) return;

    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;
    if (
      !this.state.pendingAction ||
      this.state.pendingAction.type !== "BUY_DECISION"
    )
      return;

    const space = BOARD_SPACES[this.state.pendingAction.spaceId];
    this.state.pendingAction = null;
    this.state.lastAction = `${player.username} declined to buy ${space?.nameVi}`;

    this.notifyAndBroadcast();
    this.checkBotTurn();
  }

  private handleBuildHouse(playerId: string, spaceId: number): void {
    if (!this.isHost) return;

    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    const space = BOARD_SPACES[spaceId];
    const ownership = this.state.properties.find(
      (p) => p.spaceId === spaceId && p.ownerId === playerId
    );

    if (!space || !ownership || !space.houseCost) return;
    if (ownership.houses >= 5) return; // Max is hotel (5)
    if (player.money < space.houseCost) return;
    if (ownership.mortgaged) return;

    // Check if owns full color set
    const colorProperties = BOARD_SPACES.filter(
      (s) => s.color === space.color && s.type === "property"
    );
    const ownedInColor = this.state.properties.filter(
      (p) =>
        colorProperties.some((s) => s.id === p.spaceId) &&
        p.ownerId === playerId
    );
    if (ownedInColor.length !== colorProperties.length) return;

    // Must build evenly
    const minHouses = Math.min(...ownedInColor.map((p) => p.houses));
    if (ownership.houses > minHouses) return;

    player.money -= space.houseCost;
    ownership.houses++;

    const buildingType = ownership.houses === 5 ? "hotel" : "house";
    this.state.lastAction = `${player.username} built a ${buildingType} on ${space.nameVi}`;

    this.notifyAndBroadcast();
  }

  // === Payment Actions ===

  private handlePayRent(playerId: string): void {
    if (!this.isHost) return;

    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;

    const pending = this.state.pendingAction;
    if (!pending || pending.type !== "PAY_RENT") return;

    const owner = this.state.players.find((p) => p.id === pending.toPlayerId);
    if (!owner) return;

    if (player.money >= pending.amount) {
      player.money -= pending.amount;
      owner.money += pending.amount;
      this.state.lastAction = `${player.username} paid ${pending.amount}đ rent to ${owner.username}`;
    } else {
      // Bankruptcy
      this.handleBankruptcy(player, owner);
    }

    this.state.pendingAction = null;
    this.notifyAndBroadcast();
    this.checkBotTurn();
  }

  private handlePayTax(playerId: string): void {
    if (!this.isHost) return;

    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;

    const pending = this.state.pendingAction;
    if (!pending || pending.type !== "PAY_TAX") return;

    if (player.money >= pending.amount) {
      player.money -= pending.amount;
      this.state.lastAction = `${player.username} paid ${pending.amount}đ tax`;
    } else {
      this.handleBankruptcy(player, null);
    }

    this.state.pendingAction = null;
    this.notifyAndBroadcast();
    this.checkBotTurn();
  }

  private handleUseCard(playerId: string): void {
    if (!this.isHost) return;

    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;

    const pending = this.state.pendingAction;
    if (!pending || pending.type !== "CARD") return;

    const card = pending.card;
    this.state.pendingAction = null;

    switch (card.action.type) {
      case "COLLECT":
        player.money += card.action.amount;
        break;
      case "PAY":
        if (player.money >= card.action.amount) {
          player.money -= card.action.amount;
        } else {
          this.handleBankruptcy(player, null);
        }
        break;
      case "MOVE":
        const oldPos = player.position;
        player.position = card.action.position;
        if (player.position < oldPos) {
          player.money += SALARY; // Passed GO
        }
        this.handleLanding(player);
        break;
      case "MOVE_RELATIVE":
        const newPos = (player.position + card.action.spaces + 40) % 40;
        player.position = newPos;
        this.handleLanding(player);
        break;
      case "GO_TO_JAIL":
        this.sendToJail(player);
        break;
      case "GET_OUT_JAIL":
        const current = this.getOutOfJailCards.get(player.id!) || 0;
        this.getOutOfJailCards.set(player.id!, current + 1);
        break;
      case "PAY_EACH_PLAYER": {
        const activePlayers = this.state.players.filter(
          (p) => p.id && !p.isBankrupt && p.id !== player.id
        );
        const payAmount = card.action.amount;
        const totalPay = payAmount * activePlayers.length;
        if (player.money >= totalPay) {
          player.money -= totalPay;
          activePlayers.forEach((p) => (p.money += payAmount));
        }
        break;
      }
      case "COLLECT_FROM_EACH": {
        const others = this.state.players.filter(
          (p) => p.id && !p.isBankrupt && p.id !== player.id
        );
        const collectAmount = card.action.amount;
        others.forEach((p) => {
          if (p.money >= collectAmount) {
            p.money -= collectAmount;
            player.money += collectAmount;
          }
        });
        break;
      }
      case "REPAIRS": {
        const myProperties = this.state.properties.filter(
          (p) => p.ownerId === player.id
        );
        const perHouse = card.action.perHouse;
        const perHotel = card.action.perHotel;
        let repairCost = 0;
        myProperties.forEach((p) => {
          if (p.houses === 5) {
            repairCost += perHotel;
          } else {
            repairCost += p.houses * perHouse;
          }
        });
        if (player.money >= repairCost) {
          player.money -= repairCost;
        } else {
          this.handleBankruptcy(player, null);
        }
        break;
      }
    }

    this.state.lastAction = `${player.username}: ${card.textVi}`;
    this.notifyAndBroadcast();
    this.checkBotTurn();
  }

  private handlePayJailFine(playerId: string): void {
    if (!this.isHost) return;

    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player || player.id !== playerId || !player.inJail) return;

    // Check for get out of jail free card
    const freeCards = this.getOutOfJailCards.get(playerId) || 0;
    if (freeCards > 0) {
      this.getOutOfJailCards.set(playerId, freeCards - 1);
      player.inJail = false;
      player.jailTurns = 0;
      this.state.lastAction = `${player.username} used Get Out of Jail Free card`;
    } else if (player.money >= JAIL_FINE) {
      player.money -= JAIL_FINE;
      player.inJail = false;
      player.jailTurns = 0;
      this.state.lastAction = `${player.username} paid ${JAIL_FINE}đ to leave jail`;
    }

    this.notifyAndBroadcast();
  }

  private handleBankruptcy(
    player: MonopolyPlayer,
    creditor: MonopolyPlayer | null
  ): void {
    player.isBankrupt = true;
    this.state.lastAction = `${player.username} is bankrupt!`;

    // Transfer properties to creditor or back to bank
    this.state.properties = this.state.properties
      .map((p) => {
        if (p.ownerId === player.id) {
          if (creditor) {
            return { ...p, ownerId: creditor.id!, houses: 0 };
          }
          return null as any;
        }
        return p;
      })
      .filter(Boolean);

    // Transfer money
    if (creditor && player.money > 0) {
      creditor.money += player.money;
    }
    player.money = 0;

    // Check for winner
    const activePlayers = this.state.players.filter(
      (p) => p.id && !p.isBankrupt
    );
    if (activePlayers.length === 1) {
      this.state.gamePhase = "ended";
      this.state.winner = activePlayers[0].id;
      this.state.lastAction = `${activePlayers[0].username} wins!`;
    }
  }

  private handleEndTurn(playerId: string): void {
    if (!this.isHost) return;

    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return;
    if (this.state.pendingAction) return;
    if (!this.state.hasRolled) return;

    // Can't end turn if can roll again (doubles)
    if (this.state.canRollAgain && !player.inJail) return;

    this.endTurn();
  }

  private endTurn(): void {
    this.state.hasRolled = false;
    this.state.canRollAgain = false;
    this.state.doublesCount = 0;
    this.state.diceValues = null;
    this.state.pendingAction = null;

    // Find next active player
    let nextIndex = (this.state.currentPlayerIndex + 1) % 4;
    let attempts = 0;
    while (attempts < 4) {
      const next = this.state.players[nextIndex];
      if (next && next.id && !next.isBankrupt) {
        break;
      }
      nextIndex = (nextIndex + 1) % 4;
      attempts++;
    }

    this.state.currentPlayerIndex = nextIndex;
    const nextPlayer = this.state.players[nextIndex];
    this.state.lastAction = `${nextPlayer?.username}'s turn`;

    this.notifyAndBroadcast();
    this.checkBotTurn();
  }

  // === Bot Logic ===

  private handleAddBot(slotIndex: number): void {
    if (!this.isHost) return;
    if (slotIndex < 0 || slotIndex >= 4) return;
    if (this.state.players[slotIndex].id) return;

    const botId = `bot-${slotIndex}-${Date.now()}`;
    const newPlayers = [...this.state.players];
    newPlayers[slotIndex] = {
      ...newPlayers[slotIndex],
      id: botId,
      username: `Bot ${slotIndex + 1}`,
      isBot: true,
    };

    this.state = { ...this.state, players: newPlayers };
    this.notifyAndBroadcast();
  }

  private handleRemoveBot(slotIndex: number): void {
    if (!this.isHost) return;
    if (slotIndex < 0 || slotIndex >= 4) return;
    if (!this.state.players[slotIndex].isBot) return;

    const newPlayers = [...this.state.players];
    newPlayers[slotIndex] = {
      ...newPlayers[slotIndex],
      id: null,
      username: `Player ${slotIndex + 1}`,
      isBot: false,
    };

    this.state = { ...this.state, players: newPlayers };
    this.notifyAndBroadcast();
  }

  private checkBotTurn(): void {
    if (!this.isHost) return;
    if (this.state.gamePhase !== "playing") return;

    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    if (!currentPlayer?.isBot || currentPlayer.isBankrupt) return;

    // Delay bot actions for readability
    setTimeout(() => this.executeBotTurn(currentPlayer), 1000);
  }

  private executeBotTurn(bot: MonopolyPlayer): void {
    if (!this.isHost || this.state.gamePhase !== "playing") return;

    // Handle pending actions first
    if (this.state.pendingAction) {
      switch (this.state.pendingAction.type) {
        case "BUY_DECISION":
          const space = BOARD_SPACES[this.state.pendingAction.spaceId];
          // Bot buys if it has enough money and some buffer
          if (space?.price && bot.money >= space.price + 1000) {
            this.handleBuyProperty(bot.id!, this.state.pendingAction.spaceId);
          } else {
            this.handleDeclineProperty(bot.id!);
          }
          return;
        case "PAY_RENT":
          this.handlePayRent(bot.id!);
          return;
        case "PAY_TAX":
          this.handlePayTax(bot.id!);
          return;
        case "CARD":
          this.handleUseCard(bot.id!);
          return;
      }
    }

    // Pay jail fine if in jail and has money
    if (bot.inJail && bot.money >= JAIL_FINE && !this.state.hasRolled) {
      this.handlePayJailFine(bot.id!);
      setTimeout(() => this.executeBotTurn(bot), 500);
      return;
    }

    // Roll dice if can
    if (!this.state.hasRolled || this.state.canRollAgain) {
      this.handleRollDice(bot.id!);
      setTimeout(() => this.executeBotTurn(bot), 1500);
      return;
    }

    // Try to build houses
    const myProperties = this.state.properties.filter(
      (p) => p.ownerId === bot.id
    );
    for (const prop of myProperties) {
      const space = BOARD_SPACES[prop.spaceId];
      if (space?.houseCost && space.color && prop.houses < 5) {
        const colorProps = BOARD_SPACES.filter((s) => s.color === space.color);
        const ownedInColor = myProperties.filter((p) =>
          colorProps.some((c) => c.id === p.spaceId)
        );
        if (
          ownedInColor.length === colorProps.length &&
          bot.money >= space.houseCost + 2000
        ) {
          this.handleBuildHouse(bot.id!, prop.spaceId);
          setTimeout(() => this.executeBotTurn(bot), 500);
          return;
        }
      }
    }

    // End turn
    if (!this.state.pendingAction && !this.state.canRollAgain) {
      this.handleEndTurn(bot.id!);
    }
  }

  // === Request Methods (Client -> Host) ===

  requestRollDice(): void {
    this.makeMove({ type: "ROLL_DICE", playerId: this.userId });
  }

  requestBuyProperty(spaceId: number): void {
    this.makeMove({ type: "BUY_PROPERTY", playerId: this.userId, spaceId });
  }

  requestDeclineProperty(): void {
    this.makeMove({ type: "DECLINE_PROPERTY", playerId: this.userId });
  }

  requestBuildHouse(spaceId: number): void {
    this.makeMove({ type: "BUILD_HOUSE", playerId: this.userId, spaceId });
  }

  requestPayRent(): void {
    this.makeMove({ type: "PAY_RENT", playerId: this.userId });
  }

  requestPayTax(): void {
    this.makeMove({ type: "PAY_TAX", playerId: this.userId });
  }

  requestUseCard(): void {
    this.makeMove({ type: "USE_CARD", playerId: this.userId });
  }

  requestPayJailFine(): void {
    this.makeMove({ type: "PAY_JAIL_FINE", playerId: this.userId });
  }

  requestEndTurn(): void {
    this.makeMove({ type: "END_TURN", playerId: this.userId });
  }

  requestStartGame(): void {
    this.makeMove({ type: "START_GAME" });
  }

  requestAddBot(slotIndex: number): void {
    this.makeMove({ type: "ADD_BOT", slotIndex });
  }

  requestRemoveBot(slotIndex: number): void {
    this.makeMove({ type: "REMOVE_BOT", slotIndex });
  }

  requestSync(): void {
    if (this.isHost) {
      this.broadcastState();
    } else {
      this.sendAction({ type: "REQUEST_SYNC" });
    }
  }

  // === Utility Methods ===

  reset(): void {
    this.state.players.forEach((p) => {
      if (p.id) {
        p.position = 0;
        p.money = START_MONEY;
        p.inJail = false;
        p.jailTurns = 0;
        p.isBankrupt = false;
      }
    });
    this.state.properties = [];
    this.state.currentPlayerIndex = this.findFirstActivePlayer();
    this.state.diceValues = null;
    this.state.doublesCount = 0;
    this.state.hasRolled = false;
    this.state.canRollAgain = false;
    this.state.gamePhase = "playing";
    this.state.winner = null;
    this.state.pendingAction = null;
    this.state.lastAction = "Game reset!";
    this.getOutOfJailCards.clear();
    this.chanceCards = [...CHANCE_CARDS].sort(() => Math.random() - 0.5);
    this.chestCards = [...CHEST_CARDS].sort(() => Math.random() - 0.5);

    this.notifyAndBroadcast();
  }

  checkGameEnd(): GameResult | null {
    const activePlayers = this.state.players.filter(
      (p) => p.id && !p.isBankrupt
    );
    if (activePlayers.length <= 1 && this.state.gamePhase === "playing") {
      return { winner: activePlayers[0]?.id || undefined };
    }
    return null;
  }

  updatePlayers(players: { id: string; username: string }[]): void {
    players.forEach((player, index) => {
      if (index < 4 && !this.state.players[index].isBot) {
        this.state.players[index].id = player.id;
        this.state.players[index].username = player.username;
      }
    });
    this.onStateChange?.(this.state);
    if (this.isHost) {
      this.broadcastState();
    }
  }

  getMyPlayerIndex(): number {
    return this.state.players.findIndex((p) => p.id === this.userId);
  }

  canStartGame(): boolean {
    const activePlayers = this.state.players.filter((p) => p.id !== null);
    return activePlayers.length >= 2;
  }

  getPlayerProperties(playerId: string): OwnedProperty[] {
    return this.state.properties.filter((p) => p.ownerId === playerId);
  }
}
