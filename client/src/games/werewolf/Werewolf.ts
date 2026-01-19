import type { Player } from "../../stores/roomStore";
import { BaseGame, type GameAction, type GameResult } from "../BaseGame";
import {
  type WerewolfState,
  type WerewolfAction,
  type WerewolfPlayer,
  type WerewolfRole,
  type GamePhase,
  type NightSubPhase,
  type NightResult,
  type ChatMessage,
  type GameLog,
  type WitchPotions,
  type Team,
  DEFAULT_CONFIG,
  ROLE_SETS,
  ROLE_INFO,
} from "./types";

export default class Werewolf extends BaseGame<WerewolfState> {
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  getInitState(): WerewolfState {
    // Create initial player slots
    const initialPlayers: WerewolfPlayer[] = [];
    for (let i = 0; i < 12; i++) {
      initialPlayers.push({
        id: null,
        username: `Slot ${i + 1}`,
        role: null,
        isAlive: true,
        isBot: false,
        loverId: null,
        hasPendingShot: false,
        hasVoted: false,
        messagesRemaining: 3,
      });
    }

    // Add existing room players to slots
    this.players.forEach((player, index) => {
      if (index < 12) {
        initialPlayers[index] = {
          ...initialPlayers[index],
          id: player.id,
          username: player.username,
        };
      }
    });

    return {
      players: initialPlayers,
      minPlayers: 5,
      maxPlayers: 12,

      phase: "setup",
      nightSubPhase: "done",
      day: 0,
      isGameStarted: false,
      isGameOver: false,
      winner: null,

      nightActions: {
        wolfTarget: null,
        wolfVotes: [],
        seerTarget: null,
        bodyguardTarget: null,
        lastBodyguardTarget: null,
        witchHealTarget: null,
        witchKillTarget: null,
        cupidTargets: null,
      },
      witchPotions: {},

      nightResult: null,
      suspicionMarkers: [],
      eliminationVotes: [],
      pendingElimination: null,

      chatMessages: [],
      config: { ...DEFAULT_CONFIG },
      logs: [],
      phaseEndTime: null,
    };
  }

  onSocketGameAction(data: { action: GameAction }): void {
    const action = data.action as WerewolfAction;

    if (this.isHost) {
      // Host processes all actions
      this.handleAction(action);
    }
  }

  // === Action Handlers ===

  private handleAction(action: WerewolfAction): void {
    switch (action.type) {
      case "JOIN_SLOT":
        this.handleJoinSlot(
          action.slotIndex,
          action.playerId,
          action.playerName,
        );
        break;
      case "LEAVE_SLOT":
        this.handleLeaveSlot(action.slotIndex);
        break;
      case "ADD_BOT":
        this.handleAddBot(action.slotIndex);
        break;
      case "REMOVE_BOT":
        this.handleRemoveBot(action.slotIndex);
        break;
      case "UPDATE_CONFIG":
        this.handleUpdateConfig(action.config);
        break;
      case "START_GAME":
        this.handleStartGame();
        break;
      case "NIGHT_ACTION":
        this.handleNightAction(
          action.playerId,
          action.role,
          action.targetId,
          action.useHealPotion,
          action.useKillPotion,
          action.secondTargetId,
        );
        break;
      case "SKIP_NIGHT_ACTION":
        this.handleSkipNightAction(action.playerId, action.role);
        break;
      case "SEND_MESSAGE":
        this.handleSendMessage(
          action.playerId,
          action.content,
          action.messageType,
          action.targetPlayerId,
          action.quickMessageId,
        );
        break;
      case "ADD_SUSPICION":
        this.handleAddSuspicion(action.playerId, action.targetId);
        break;
      case "REMOVE_SUSPICION":
        this.handleRemoveSuspicion(action.playerId, action.targetId);
        break;
      case "CAST_VOTE":
        this.handleCastVote(action.playerId, action.targetId);
        break;
      case "HUNTER_SHOOT":
        this.handleHunterShoot(action.playerId, action.targetId);
        break;
      case "PHASE_TIMEOUT":
        this.handlePhaseTimeout();
        break;
      case "RESET_GAME":
        this.handleResetGame();
        break;
    }
  }

  // === Setup Phase ===

  private handleJoinSlot(
    slotIndex: number,
    playerId: string,
    playerName: string,
  ): void {
    if (this.state.isGameStarted) return;

    const slot = this.state.players[slotIndex];
    if (!slot || slot.id !== null) return; // Slot taken

    // Check if player is already in another slot
    const existingSlot = this.state.players.find((p) => p.id === playerId);
    if (existingSlot) {
      // Remove from existing slot
      existingSlot.id = null;
      existingSlot.username = `Slot ${this.state.players.indexOf(existingSlot) + 1}`;
      existingSlot.isBot = false;
    }

    slot.id = playerId;
    slot.username = playerName;
    slot.isBot = false;

    this.syncState();
  }

  private handleLeaveSlot(slotIndex: number): void {
    if (this.state.isGameStarted) return;

    const slot = this.state.players[slotIndex];
    if (!slot) return;

    slot.id = null;
    slot.username = `Slot ${slotIndex + 1}`;
    slot.isBot = false;

    this.syncState();
  }

  private handleAddBot(slotIndex: number): void {
    if (this.state.isGameStarted) return;

    const slot = this.state.players[slotIndex];
    if (!slot || slot.id !== null) return;

    const botIndex = this.state.players.filter((p) => p.isBot).length;
    const botName = "Bot " + botIndex;

    slot.id = `bot_${Date.now()}_${slotIndex}`;
    slot.username = botName;
    slot.isBot = true;

    this.syncState();
  }

  private handleRemoveBot(slotIndex: number): void {
    if (this.state.isGameStarted) return;

    const slot = this.state.players[slotIndex];
    if (!slot || !slot.isBot) return;

    slot.id = null;
    slot.username = `Slot ${slotIndex + 1}`;
    slot.isBot = false;

    this.syncState();
  }

  private handleUpdateConfig(config: Partial<typeof DEFAULT_CONFIG>): void {
    if (this.state.isGameStarted) return;

    this.state.config = { ...this.state.config, ...config };
    this.syncState();
  }

  private handleStartGame(): void {
    const activePlayers = this.state.players.filter((p) => p.id !== null);
    if (activePlayers.length < this.state.minPlayers) return;
    if (this.state.isGameStarted) return;

    // Assign roles
    this.assignRoles(activePlayers);

    // Initialize witch potions
    const witches = this.state.players.filter((p) => p.role === "witch");
    witches.forEach((witch) => {
      if (witch.id) {
        this.state.witchPotions[witch.id] = {
          hasHealPotion: true,
          hasKillPotion: true,
        };
      }
    });

    // Start game
    this.state.isGameStarted = true;
    this.state.day = 1;

    // Add log
    this.addLog({ en: "Game started!", vi: "Trò chơi bắt đầu!" }, "info");

    // Start night phase
    this.startNightPhase();
  }

  private assignRoles(activePlayers: WerewolfPlayer[]): void {
    const playerCount = activePlayers.length;

    // Get role set based on player count
    let roles = this.state.config.roles;
    if (ROLE_SETS[playerCount.toString()]) {
      roles = [...ROLE_SETS[playerCount.toString()]];
    }

    // Adjust roles if needed
    while (roles.length < playerCount) {
      roles.push("villager");
    }
    while (roles.length > playerCount) {
      const villagerIndex = roles.lastIndexOf("villager");
      if (villagerIndex !== -1) {
        roles.splice(villagerIndex, 1);
      } else {
        roles.pop();
      }
    }

    // Shuffle roles
    const shuffledRoles = this.shuffleArray([...roles]);

    // Assign roles to active players
    let roleIndex = 0;
    this.state.players.forEach((player) => {
      if (player.id !== null) {
        player.role = shuffledRoles[roleIndex++];
        player.isAlive = true;
        player.hasVoted = false;
        player.messagesRemaining = this.state.config.chatLimit;
      }
    });
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // === Night Phase ===

  private startNightPhase(): void {
    this.state.phase = "night";
    this.state.nightActions = {
      wolfTarget: null,
      wolfVotes: [],
      seerTarget: null,
      bodyguardTarget: null,
      lastBodyguardTarget: this.state.nightActions.lastBodyguardTarget,
      witchHealTarget: null,
      witchKillTarget: null,
      cupidTargets: this.state.nightActions.cupidTargets, // Keep cupid targets from night 1
    };

    // Determine first night sub-phase
    if (this.state.day === 1 && this.hasAliveRole("cupid")) {
      this.state.nightSubPhase = "cupid";
    } else if (this.hasAliveRole("seer")) {
      this.state.nightSubPhase = "seer";
    } else if (this.hasAliveRole("bodyguard")) {
      this.state.nightSubPhase = "bodyguard";
    } else if (this.hasAliveRole("wolf")) {
      this.state.nightSubPhase = "wolf";
    } else if (this.hasAliveRole("witch")) {
      this.state.nightSubPhase = "witch";
    } else {
      this.state.nightSubPhase = "done";
    }

    this.startPhaseTimer();
    this.syncState();

    // Process bot actions for current sub-phase
    this.processBotNightAction();
  }

  private hasAliveRole(role: WerewolfRole): boolean {
    return this.state.players.some((p) => p.role === role && p.isAlive);
  }

  private advanceNightSubPhase(): void {
    const order: NightSubPhase[] = [
      "cupid",
      "seer",
      "bodyguard",
      "wolf",
      "witch",
      "done",
    ];
    const currentIndex = order.indexOf(this.state.nightSubPhase);

    for (let i = currentIndex + 1; i < order.length; i++) {
      const nextPhase = order[i];

      if (nextPhase === "done") {
        this.processNightResults();
        return;
      }

      if (nextPhase === "cupid" && this.state.day !== 1) continue;

      if (this.hasAliveRole(nextPhase as WerewolfRole)) {
        this.state.nightSubPhase = nextPhase;
        this.startPhaseTimer();
        this.syncState();
        this.processBotNightAction();
        return;
      }
    }

    // No more phases, process results
    this.processNightResults();
  }

  private handleNightAction(
    playerId: string,
    role: WerewolfRole,
    targetId: string | null,
    useHealPotion?: boolean,
    useKillPotion?: boolean,
    secondTargetId?: string,
  ): void {
    if (this.state.phase !== "night") return;

    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || player.role !== role || !player.isAlive) return;

    switch (role) {
      case "wolf":
        this.handleWolfAction(playerId, targetId);
        break;
      case "seer":
        this.handleSeerAction(playerId, targetId);
        break;
      case "bodyguard":
        this.handleBodyguardAction(playerId, targetId);
        break;
      case "witch":
        this.handleWitchAction(
          playerId,
          targetId,
          useHealPotion,
          useKillPotion,
        );
        break;
      case "cupid":
        this.handleCupidAction(playerId, targetId, secondTargetId);
        break;
    }
  }

  private handleWolfAction(playerId: string, targetId: string | null): void {
    if (this.state.nightSubPhase !== "wolf") return;

    // Record wolf vote
    const existingVoteIndex = this.state.nightActions.wolfVotes.findIndex(
      (v) => v.wolfId === playerId,
    );
    if (existingVoteIndex !== -1) {
      this.state.nightActions.wolfVotes[existingVoteIndex].targetId =
        targetId || "";
    } else if (targetId) {
      this.state.nightActions.wolfVotes.push({ wolfId: playerId, targetId });
    }

    // Check if all wolves have voted
    const aliveWolves = this.state.players.filter(
      (p) => p.role === "wolf" && p.isAlive,
    );
    const allVoted = aliveWolves.every((wolf) =>
      this.state.nightActions.wolfVotes.some((v) => v.wolfId === wolf.id),
    );

    if (allVoted) {
      // Count votes
      const voteCounts: Record<string, number> = {};
      this.state.nightActions.wolfVotes.forEach((v) => {
        voteCounts[v.targetId] = (voteCounts[v.targetId] || 0) + 1;
      });

      // Get target with most votes
      let maxVotes = 0;
      let target: string | null = null;
      Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          target = id;
        }
      });

      this.state.nightActions.wolfTarget = target;
      this.advanceNightSubPhase();
    } else {
      this.syncState();
    }
  }

  private handleSeerAction(playerId: string, targetId: string | null): void {
    if (this.state.nightSubPhase !== "seer") return;
    if (!targetId) return;

    this.state.nightActions.seerTarget = targetId;
    this.advanceNightSubPhase();
  }

  private handleBodyguardAction(
    playerId: string,
    targetId: string | null,
  ): void {
    if (this.state.nightSubPhase !== "bodyguard") return;
    if (!targetId) return;

    // Can't protect same person twice in a row
    if (targetId === this.state.nightActions.lastBodyguardTarget) return;

    this.state.nightActions.bodyguardTarget = targetId;
    this.advanceNightSubPhase();
  }

  private handleWitchAction(
    playerId: string,
    targetId: string | null,
    useHealPotion?: boolean,
    useKillPotion?: boolean,
  ): void {
    if (this.state.nightSubPhase !== "witch") return;

    const potions = this.state.witchPotions[playerId];
    if (!potions) return;

    if (
      useHealPotion &&
      potions.hasHealPotion &&
      this.state.nightActions.wolfTarget
    ) {
      this.state.nightActions.witchHealTarget =
        this.state.nightActions.wolfTarget;
      potions.hasHealPotion = false;
    }

    if (useKillPotion && potions.hasKillPotion && targetId) {
      this.state.nightActions.witchKillTarget = targetId;
      potions.hasKillPotion = false;
    }

    this.advanceNightSubPhase();
  }

  private handleCupidAction(
    playerId: string,
    targetId: string | null,
    secondTargetId?: string,
  ): void {
    if (this.state.nightSubPhase !== "cupid") return;
    if (!targetId || !secondTargetId) return;
    if (this.state.day !== 1) return;

    // Set lovers
    const player1 = this.state.players.find((p) => p.id === targetId);
    const player2 = this.state.players.find((p) => p.id === secondTargetId);

    if (player1 && player2) {
      player1.loverId = secondTargetId;
      player2.loverId = targetId;
      this.state.nightActions.cupidTargets = [targetId, secondTargetId];
    }

    this.advanceNightSubPhase();
  }

  private handleSkipNightAction(playerId: string, role: WerewolfRole): void {
    if (this.state.phase !== "night") return;

    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || player.role !== role || !player.isAlive) return;

    // For some roles, skipping is allowed
    if (role === "witch" || role === "bodyguard") {
      this.advanceNightSubPhase();
    }
  }

  private processNightResults(): void {
    const result: NightResult = {
      killedByWolves: null,
      savedByBodyguard: false,
      savedByWitch: false,
      killedByWitch: null,
    };

    // Process wolf kill
    if (this.state.nightActions.wolfTarget) {
      const isProtected =
        this.state.nightActions.bodyguardTarget ===
        this.state.nightActions.wolfTarget;
      const isHealed =
        this.state.nightActions.witchHealTarget ===
        this.state.nightActions.wolfTarget;

      if (isProtected) {
        result.savedByBodyguard = true;
      } else if (isHealed) {
        result.savedByWitch = true;
      } else {
        result.killedByWolves = this.state.nightActions.wolfTarget;
      }
    }

    // Process witch kill
    if (this.state.nightActions.witchKillTarget) {
      result.killedByWitch = this.state.nightActions.witchKillTarget;
    }

    // Update last bodyguard target
    this.state.nightActions.lastBodyguardTarget =
      this.state.nightActions.bodyguardTarget;

    // Store result
    this.state.nightResult = result;

    // Move to morning phase
    this.startMorningPhase();
  }

  // === Morning Phase ===

  private startMorningPhase(): void {
    this.state.phase = "morning";
    this.state.nightSubPhase = "done";

    const deaths: string[] = [];

    // Process deaths
    if (this.state.nightResult?.killedByWolves) {
      deaths.push(this.state.nightResult.killedByWolves);
    }
    if (this.state.nightResult?.killedByWitch) {
      deaths.push(this.state.nightResult.killedByWitch);
    }

    // Kill players and handle lovers
    deaths.forEach((playerId) => {
      this.killPlayer(playerId);
    });

    // Add logs for deaths
    if (deaths.length === 0) {
      this.addLog(
        { en: "No one died last night!", vi: "Không ai chết đêm qua!" },
        "death",
      );
    } else {
      deaths.forEach((playerId) => {
        const player = this.state.players.find((p) => p.id === playerId);
        if (player) {
          this.addLog(
            {
              en: `${player.username} was killed last night!`,
              vi: `${player.username} đã bị giết đêm qua!`,
            },
            "death",
          );

          if (this.state.config.revealRolesOnDeath && player.role) {
            const roleInfo = ROLE_INFO[player.role];
            this.addLog(
              {
                en: `${player.username} was a ${roleInfo.name.en}`,
                vi: `${player.username} là ${roleInfo.name.vi}`,
              },
              "info",
            );
          }
        }
      });
    }

    // Check for hunter pending shot
    const hunterWithPendingShot = this.state.players.find(
      (p) => p.role === "hunter" && p.hasPendingShot && !p.isAlive,
    );
    if (hunterWithPendingShot) {
      this.state.phase = "hunterRevenge";
      this.state.pendingElimination = hunterWithPendingShot.id;
      this.startPhaseTimer();
      this.syncState();
      return;
    }

    // Check win condition
    if (this.checkWinCondition()) {
      this.endGame();
      return;
    }

    // Auto-advance to discussion after brief pause
    this.state.phaseEndTime = Date.now() + 5000; // 5 second pause
    this.syncState();

    setTimeout(() => {
      if (this.state.phase === "morning") {
        this.startDiscussionPhase();
      }
    }, 5000);
  }

  private killPlayer(playerId: string): void {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || !player.isAlive) return;

    player.isAlive = false;

    // Hunter gets pending shot
    if (player.role === "hunter") {
      player.hasPendingShot = true;
    }

    // Check for lover death
    if (player.loverId) {
      const lover = this.state.players.find((p) => p.id === player.loverId);
      if (lover && lover.isAlive) {
        this.addLog(
          {
            en: `${lover.username} died of a broken heart!`,
            vi: `${lover.username} chết vì đau tim!`,
          },
          "death",
        );
        lover.isAlive = false;

        // Hunter lover gets pending shot too
        if (lover.role === "hunter") {
          lover.hasPendingShot = true;
        }
      }
    }
  }

  // === Discussion Phase ===

  private startDiscussionPhase(): void {
    this.state.phase = "discussion";
    this.state.suspicionMarkers = [];

    // Reset message counts
    this.state.players.forEach((p) => {
      if (p.isAlive) {
        p.messagesRemaining = this.state.config.chatLimit;
      }
    });

    this.startPhaseTimer();
    this.syncState();
  }

  private handleSendMessage(
    playerId: string,
    content: string,
    messageType: "text" | "quick" | "reaction",
    targetPlayerId?: string,
    quickMessageId?: string,
  ): void {
    if (this.state.phase !== "discussion") return;

    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || !player.isAlive) return;

    // Check message limit for text messages
    if (messageType === "text" && player.messagesRemaining <= 0) return;

    // Validate message length
    if (messageType === "text" && content.length > 100) {
      content = content.substring(0, 100);
    }

    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random()}`,
      playerId,
      playerName: player.username,
      content,
      type: messageType,
      timestamp: Date.now(),
      targetPlayerId,
      quickMessageId,
    };

    this.state.chatMessages.push(message);

    if (messageType === "text") {
      player.messagesRemaining--;
    }

    // Keep only last 50 messages
    if (this.state.chatMessages.length > 50) {
      this.state.chatMessages = this.state.chatMessages.slice(-50);
    }

    this.syncState();
  }

  private handleAddSuspicion(playerId: string, targetId: string): void {
    if (this.state.phase !== "discussion") return;

    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || !player.isAlive) return;

    // Remove existing suspicion from this player
    this.state.suspicionMarkers = this.state.suspicionMarkers.filter(
      (m) => m.fromPlayerId !== playerId,
    );

    // Add new suspicion
    this.state.suspicionMarkers.push({
      fromPlayerId: playerId,
      toPlayerId: targetId,
      timestamp: Date.now(),
    });

    this.syncState();
  }

  private handleRemoveSuspicion(playerId: string, targetId: string): void {
    if (this.state.phase !== "discussion") return;

    this.state.suspicionMarkers = this.state.suspicionMarkers.filter(
      (m) => !(m.fromPlayerId === playerId && m.toPlayerId === targetId),
    );

    this.syncState();
  }

  // === Voting Phase ===

  private startVotingPhase(): void {
    this.state.phase = "voting";
    this.state.eliminationVotes = [];

    // Reset vote status
    this.state.players.forEach((p) => {
      p.hasVoted = false;
    });

    this.startPhaseTimer();
    this.syncState();
  }

  private handleCastVote(playerId: string, targetId: string | null): void {
    if (this.state.phase !== "voting") return;

    const player = this.state.players.find((p) => p.id === playerId);
    if (!player || !player.isAlive || player.hasVoted) return;

    // Can't vote for dead players
    if (targetId) {
      const target = this.state.players.find((p) => p.id === targetId);
      if (!target || !target.isAlive) return;
    }

    player.hasVoted = true;

    // Remove any existing vote
    this.state.eliminationVotes = this.state.eliminationVotes.filter(
      (v) => v.voterId !== playerId,
    );

    // Add vote
    this.state.eliminationVotes.push({
      voterId: playerId,
      targetId,
    });

    // Check if all alive players have voted
    const alivePlayers = this.state.players.filter(
      (p) => p.isAlive && p.id !== null,
    );
    const allVoted = alivePlayers.every((p) => p.hasVoted);

    if (allVoted) {
      this.processVotes();
    } else {
      this.syncState();
    }
  }

  private processVotes(): void {
    // Count votes
    const voteCounts: Record<string, number> = {};
    this.state.eliminationVotes.forEach((v) => {
      if (v.targetId) {
        voteCounts[v.targetId] = (voteCounts[v.targetId] || 0) + 1;
      }
    });

    // Find player with most votes
    let maxVotes = 0;
    let eliminatedId: string | null = null;
    let isTie = false;

    Object.entries(voteCounts).forEach(([id, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedId = id;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    });

    // Handle tie
    if (isTie && this.state.config.tieHandling === "noElimination") {
      eliminatedId = null;
      this.addLog(
        {
          en: "Vote was tied - no one eliminated!",
          vi: "Bình chọn hòa - không ai bị loại!",
        },
        "vote",
      );
    }

    if (eliminatedId) {
      this.state.pendingElimination = eliminatedId;
      this.startEliminationPhase();
    } else {
      // No elimination, start next night
      this.state.day++;
      this.startNightPhase();
    }
  }

  // === Elimination Phase ===

  private startEliminationPhase(): void {
    this.state.phase = "elimination";

    const eliminatedId = this.state.pendingElimination;
    if (!eliminatedId) {
      this.state.day++;
      this.startNightPhase();
      return;
    }

    const eliminated = this.state.players.find((p) => p.id === eliminatedId);
    if (eliminated) {
      this.addLog(
        {
          en: `${eliminated.username} was voted out!`,
          vi: `${eliminated.username} bị bình chọn loại!`,
        },
        "vote",
      );

      this.killPlayer(eliminatedId);

      if (this.state.config.revealRolesOnDeath && eliminated.role) {
        const roleInfo = ROLE_INFO[eliminated.role];
        this.addLog(
          {
            en: `${eliminated.username} was a ${roleInfo.name.en}`,
            vi: `${eliminated.username} là ${roleInfo.name.vi}`,
          },
          "info",
        );
      }
    }

    // Check for hunter pending shot
    const hunterWithPendingShot = this.state.players.find(
      (p) => p.role === "hunter" && p.hasPendingShot && !p.isAlive,
    );
    if (hunterWithPendingShot) {
      this.state.phase = "hunterRevenge";
      this.state.pendingElimination = hunterWithPendingShot.id;
      this.startPhaseTimer();
      this.syncState();
      return;
    }

    // Check win condition
    if (this.checkWinCondition()) {
      this.endGame();
      return;
    }

    // Pause then start next night
    this.state.phaseEndTime = Date.now() + 5000;
    this.syncState();

    setTimeout(() => {
      if (this.state.phase === "elimination") {
        this.state.pendingElimination = null;
        this.state.day++;
        this.startNightPhase();
      }
    }, 5000);
  }

  // === Hunter Revenge ===

  private handleHunterShoot(playerId: string, targetId: string): void {
    if (this.state.phase !== "hunterRevenge") return;

    const hunter = this.state.players.find((p) => p.id === playerId);
    if (!hunter || hunter.role !== "hunter" || !hunter.hasPendingShot) return;

    const target = this.state.players.find((p) => p.id === targetId);
    if (!target || !target.isAlive) return;

    hunter.hasPendingShot = false;

    this.addLog(
      {
        en: `${hunter.username} took ${target.username} with them!`,
        vi: `${hunter.username} kéo ${target.username} đi cùng!`,
      },
      "death",
    );

    this.killPlayer(targetId);

    if (this.state.config.revealRolesOnDeath && target.role) {
      const roleInfo = ROLE_INFO[target.role];
      this.addLog(
        {
          en: `${target.username} was a ${roleInfo.name.en}`,
          vi: `${target.username} là ${roleInfo.name.vi}`,
        },
        "info",
      );
    }

    // Check for another hunter
    const anotherHunter = this.state.players.find(
      (p) =>
        p.role === "hunter" &&
        p.hasPendingShot &&
        !p.isAlive &&
        p.id !== playerId,
    );
    if (anotherHunter) {
      this.state.pendingElimination = anotherHunter.id;
      this.syncState();
      return;
    }

    // Check win condition
    if (this.checkWinCondition()) {
      this.endGame();
      return;
    }

    // Continue to next phase
    if (
      this.state.nightResult &&
      (this.state.nightResult.killedByWolves ||
        this.state.nightResult.killedByWitch)
    ) {
      // It was morning, continue to discussion
      this.state.pendingElimination = null;
      this.startDiscussionPhase();
    } else {
      // It was after voting, start next night
      this.state.pendingElimination = null;
      this.state.day++;
      this.startNightPhase();
    }
  }

  // === Win Condition ===

  private checkWinCondition(): boolean {
    const alivePlayers = this.state.players.filter(
      (p) => p.isAlive && p.id !== null,
    );
    const aliveWolves = alivePlayers.filter((p) => p.role === "wolf");
    const aliveVillagers = alivePlayers.filter((p) => p.role !== "wolf");

    // Check lovers win (both survives and one is wolf)
    const lovers = this.state.players.filter((p) => p.loverId && p.isAlive);
    if (lovers.length === 2 && alivePlayers.length === 2) {
      const hasWolfLover = lovers.some((p) => p.role === "wolf");
      if (hasWolfLover) {
        this.state.winner = "lovers";
        return true;
      }
    }

    // Wolves win when equal or more than villagers
    if (aliveWolves.length >= aliveVillagers.length) {
      this.state.winner = "wolf";
      return true;
    }

    // Village wins when all wolves are dead
    if (aliveWolves.length === 0) {
      this.state.winner = "village";
      return true;
    }

    return false;
  }

  private endGame(): void {
    this.state.phase = "end";
    this.state.isGameOver = true;
    this.clearTimer();

    const winnerLabel =
      this.state.winner === "wolf"
        ? { en: "Werewolves win!", vi: "Ma Sói thắng!" }
        : this.state.winner === "village"
          ? { en: "Village wins!", vi: "Dân Làng thắng!" }
          : { en: "Lovers win!", vi: "Tình Nhân thắng!" };

    this.addLog(winnerLabel, "info");
    this.syncState();

    this.broadcastGameEnd({
      winner: this.state.winner || undefined,
    });
  }

  // === Timer ===

  private startPhaseTimer(): void {
    this.clearTimer();

    let duration: number;
    switch (this.state.phase) {
      case "night":
        duration = this.state.config.nightPhaseTime * 1000;
        break;
      case "discussion":
        duration = this.state.config.discussionTime * 1000;
        break;
      case "voting":
        duration = this.state.config.voteTime * 1000;
        break;
      case "hunterRevenge":
        duration = 15000; // 15 seconds for hunter shot
        break;
      default:
        duration = 30000;
    }

    this.state.phaseEndTime = Date.now() + duration;

    if (this.isHost) {
      this.timerInterval = setInterval(() => {
        if (Date.now() >= (this.state.phaseEndTime || 0)) {
          this.handlePhaseTimeout();
        }
      }, 1000);
    }
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private handlePhaseTimeout(): void {
    this.clearTimer();

    switch (this.state.phase) {
      case "night":
        // Auto-advance night sub-phase
        this.advanceNightSubPhase();
        break;
      case "discussion":
        // Move to voting
        this.startVotingPhase();
        break;
      case "voting":
        // Process whatever votes we have
        this.processVotes();
        break;
      case "hunterRevenge":
        // Hunter didn't shoot, continue
        const hunter = this.state.players.find(
          (p) => p.id === this.state.pendingElimination && p.hasPendingShot,
        );
        if (hunter) {
          hunter.hasPendingShot = false;
        }
        this.state.pendingElimination = null;
        if (this.checkWinCondition()) {
          this.endGame();
        } else {
          this.state.day++;
          this.startNightPhase();
        }
        break;
    }
  }

  // === Bot AI ===

  private processBotNightAction(): void {
    if (!this.isHost) return;

    const delay = 1000 + Math.random() * 2000; // 1-3 second delay

    setTimeout(() => {
      if (this.state.phase !== "night") return;

      switch (this.state.nightSubPhase) {
        case "wolf":
          this.processBotWolfAction();
          break;
        case "seer":
          this.processBotSeerAction();
          break;
        case "bodyguard":
          this.processBotBodyguardAction();
          break;
        case "witch":
          this.processBotWitchAction();
          break;
        case "cupid":
          this.processBotCupidAction();
          break;
      }
    }, delay);
  }

  private processBotWolfAction(): void {
    const botWolves = this.state.players.filter(
      (p) => p.role === "wolf" && p.isAlive && p.isBot,
    );

    botWolves.forEach((wolf) => {
      if (!wolf.id) return;

      // Check if already voted
      const hasVoted = this.state.nightActions.wolfVotes.some(
        (v) => v.wolfId === wolf.id,
      );
      if (hasVoted) return;

      // Pick random alive non-wolf player
      const targets = this.state.players.filter(
        (p) => p.isAlive && p.role !== "wolf" && p.id !== null,
      );
      if (targets.length === 0) return;

      const target = targets[Math.floor(Math.random() * targets.length)];
      this.handleNightAction(
        wolf.id,
        "wolf",
        target.id,
        false,
        false,
        undefined,
      );
    });
  }

  private processBotSeerAction(): void {
    const botSeer = this.state.players.find(
      (p) => p.role === "seer" && p.isAlive && p.isBot,
    );
    if (!botSeer?.id) return;

    const targets = this.state.players.filter(
      (p) => p.isAlive && p.id !== botSeer.id && p.id !== null,
    );
    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)];
    this.handleNightAction(
      botSeer.id,
      "seer",
      target.id,
      false,
      false,
      undefined,
    );
  }

  private processBotBodyguardAction(): void {
    const botBodyguard = this.state.players.find(
      (p) => p.role === "bodyguard" && p.isAlive && p.isBot,
    );
    if (!botBodyguard?.id) return;

    const targets = this.state.players.filter(
      (p) =>
        p.isAlive &&
        p.id !== null &&
        p.id !== this.state.nightActions.lastBodyguardTarget,
    );
    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)];
    this.handleNightAction(
      botBodyguard.id,
      "bodyguard",
      target.id,
      false,
      false,
      undefined,
    );
  }

  private processBotWitchAction(): void {
    const botWitch = this.state.players.find(
      (p) => p.role === "witch" && p.isAlive && p.isBot,
    );
    if (!botWitch?.id) return;

    const potions = this.state.witchPotions[botWitch.id];
    if (!potions) {
      this.advanceNightSubPhase();
      return;
    }

    // 50% chance to use heal if available and someone was targeted
    const useHeal =
      potions.hasHealPotion &&
      this.state.nightActions.wolfTarget &&
      Math.random() > 0.5;

    // 30% chance to use kill if available
    let killTarget: string | null = null;
    if (potions.hasKillPotion && Math.random() > 0.7) {
      const targets = this.state.players.filter(
        (p) => p.isAlive && p.id !== botWitch.id && p.id !== null,
      );
      if (targets.length > 0) {
        killTarget = targets[Math.floor(Math.random() * targets.length)].id;
      }
    }

    this.handleNightAction(
      botWitch.id,
      "witch",
      killTarget,
      useHeal || false,
      !!killTarget,
      undefined,
    );
  }

  private processBotCupidAction(): void {
    const botCupid = this.state.players.find(
      (p) => p.role === "cupid" && p.isAlive && p.isBot,
    );
    if (!botCupid?.id) return;

    const targets = this.state.players.filter(
      (p) => p.isAlive && p.id !== null,
    );
    if (targets.length < 2) return;

    const shuffled = this.shuffleArray(targets);
    this.handleNightAction(
      botCupid.id,
      "cupid",
      shuffled[0].id,
      false,
      false,
      shuffled[1].id || undefined,
    );
  }

  // === Utility ===

  private addLog(
    message: { en: string; vi: string },
    type: GameLog["type"],
  ): void {
    this.state.logs.push({
      id: `log_${Date.now()}_${Math.random()}`,
      message,
      type,
      timestamp: Date.now(),
      day: this.state.day,
    });

    // Keep only last 100 logs
    if (this.state.logs.length > 100) {
      this.state.logs = this.state.logs.slice(-100);
    }
  }

  private handleResetGame(): void {
    this.clearTimer();
    const newState = this.getInitState();

    // Preserve player slots
    this.state.players.forEach((player, index) => {
      if (player.id !== null) {
        newState.players[index] = {
          ...newState.players[index],
          id: player.id,
          username: player.username,
          isBot: player.isBot,
        };
      }
    });

    this.state = newState;
    this.syncState();
  }

  // === Public API ===

  requestJoinSlot(slotIndex: number, playerName: string): void {
    this.makeAction({
      type: "JOIN_SLOT",
      playerId: this.userId,
      playerName,
      slotIndex,
    });
  }

  requestLeaveSlot(slotIndex: number): void {
    this.makeAction({
      type: "LEAVE_SLOT",
      slotIndex,
    });
  }

  requestAddBot(slotIndex: number): void {
    if (!this.isHost) return;
    this.handleAddBot(slotIndex);
  }

  requestRemoveBot(slotIndex: number): void {
    if (!this.isHost) return;
    this.handleRemoveBot(slotIndex);
  }

  requestUpdateConfig(config: Partial<typeof DEFAULT_CONFIG>): void {
    if (!this.isHost) return;
    this.handleUpdateConfig(config);
  }

  requestStartGame(): void {
    if (!this.isHost) return;
    this.handleStartGame();
  }

  requestNightAction(
    role: WerewolfRole,
    targetId: string | null,
    useHealPotion?: boolean,
    useKillPotion?: boolean,
    secondTargetId?: string,
  ): void {
    this.makeAction({
      type: "NIGHT_ACTION",
      playerId: this.userId,
      role,
      targetId,
      useHealPotion,
      useKillPotion,
      secondTargetId,
    });
  }

  requestSkipNightAction(role: WerewolfRole): void {
    this.makeAction({
      type: "SKIP_NIGHT_ACTION",
      playerId: this.userId,
      role,
    });
  }

  requestSendMessage(
    content: string,
    messageType: "text" | "quick" | "reaction",
    targetPlayerId?: string,
    quickMessageId?: string,
  ): void {
    this.makeAction({
      type: "SEND_MESSAGE",
      playerId: this.userId,
      content,
      messageType,
      targetPlayerId,
      quickMessageId,
    });
  }

  requestAddSuspicion(targetId: string): void {
    this.makeAction({
      type: "ADD_SUSPICION",
      playerId: this.userId,
      targetId,
    });
  }

  requestRemoveSuspicion(targetId: string): void {
    this.makeAction({
      type: "REMOVE_SUSPICION",
      playerId: this.userId,
      targetId,
    });
  }

  requestCastVote(targetId: string | null): void {
    this.makeAction({
      type: "CAST_VOTE",
      playerId: this.userId,
      targetId,
    });
  }

  requestHunterShoot(targetId: string): void {
    this.makeAction({
      type: "HUNTER_SHOOT",
      playerId: this.userId,
      targetId,
    });
  }

  requestResetGame(): void {
    if (!this.isHost) return;
    this.handleResetGame();
  }

  getMyPlayer(): WerewolfPlayer | null {
    return this.state.players.find((p) => p.id === this.userId) || null;
  }

  getMyRole(): WerewolfRole | null {
    return this.getMyPlayer()?.role || null;
  }

  canStartGame(): boolean {
    const activePlayers = this.state.players.filter((p) => p.id !== null);
    return (
      activePlayers.length >= this.state.minPlayers && !this.state.isGameStarted
    );
  }

  // Cleanup
  destroy(): void {
    this.clearTimer();
    super.destroy();
  }
}
