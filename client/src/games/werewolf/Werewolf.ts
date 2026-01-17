import { BaseGame, type GameAction } from "../BaseGame";
import type { Socket } from "socket.io-client";
import {
  type WerewolfState,
  type WerewolfAction,
  type WerewolfPlayer,
  type WerewolfRole,
  type WerewolfPhase,
  type WerewolfMessage,
} from "./types";

export default class Werewolf extends BaseGame<WerewolfState> {
  private state: WerewolfState;
  private phaseTimer: number | null = null;
  private readonly PHASE_DURATIONS = {
    NIGHT: 30,
    DAY_SUSPICION: 30,
    DAY_DEFENSE: 30,
    DAY_VOTE: 15,
    WAITING: 0,
    FINISHED: 0,
  };

  constructor(
    roomId: string,
    socket: Socket,
    isHost: boolean,
    userId: string,
    players: { id: string; username: string }[],
  ) {
    super(roomId, socket, isHost, userId);

    const initialPlayers: Record<string, WerewolfPlayer> = {};
    players.forEach((p) => {
      initialPlayers[p.id] = {
        id: p.id,
        role: null,
        isAlive: true,
        votes: 0,
      };
    });

    this.state = {
      players: initialPlayers,
      phase: "WAITING",
      dayCount: 0,
      timeRemaining: 0,
      history: [],
      votes: {},
      wolfVotes: {},
      winner: null,

      messages: [],
      suspicion: {},
      reactions: {},

      seerCheck: null,
      bodyguardProtect: null,
      lawyerSave: null,
      detectiveCheck: null,
    };

    if (isHost) {
      this.init();
    }
  }

  init(): void {
    if (this.isHost) {
      this.broadcastState();
    }
  }

  // Required by BaseGame
  makeMove(action: GameAction): void {
    // route to handleAction
  }

  checkGameEnd(): {} | null {
    return this.state.winner ? { winner: this.state.winner } : null;
  }

  reset(): void {
    this.resetGame();
  }

  updatePlayers(players: { id: string; username: string }[]): void {
    players.forEach((p) => {
      if (!this.state.players[p.id]) {
        this.state.players[p.id] = {
          id: p.id,
          role: null,
          isAlive: true,
          votes: 0,
        };
      }
    });
    this.broadcastState();
  }

  getState(): WerewolfState {
    return { ...this.state };
  }

  setState(state: WerewolfState): void {
    this.state = state;
    this.onStateChange?.(this.state);
  }

  handleAction(data: { action: GameAction }): void {
    const action = data.action as WerewolfAction & { playerId?: string };

    if (this.isHost) {
      switch (action.type) {
        case "START_GAME":
          this.startGame();
          break;
        case "ADD_BOT":
          this.addBot();
          break;
        case "REMOVE_BOT":
          if ("botId" in action) this.removeBot(action.botId);
          break;
        case "RESET_GAME":
          this.resetGame();
          break;

        // Night Actions
        case "WOLF_KILL":
          if (action.playerId && "targetId" in action)
            this.handleWolfVote(action.playerId, action.targetId);
          break;
        case "SEER_CHECK":
          if (action.playerId && "targetId" in action)
            this.handleSeerCheck(action.playerId, action.targetId);
          break;
        case "BODYGUARD_PROTECT":
          if (action.playerId && "targetId" in action)
            this.handleBodyguardProtect(action.playerId, action.targetId);
          break;

        // Day Actions
        case "SPEECH":
          if (action.playerId && "text" in action)
            this.handleSpeech(action.playerId, action.text);
          break;
        case "SUSPECT":
          if (action.playerId && "targetId" in action)
            this.handleSuspect(action.playerId, action.targetId);
          break;
        case "REACT":
          if (action.playerId && "emoji" in action)
            this.handleReact(
              action.playerId,
              action.emoji || "",
              (action as any).msgId,
              (action as any).targetId,
            );
          break;
        case "VOTE":
          if (action.playerId)
            this.handleVote(action.playerId, action.targetId);
          break;

        // Special
        case "LAWYER_SAVE":
          if (action.playerId && "targetId" in action)
            this.handleLawyerSave(action.playerId, action.targetId);
          break;
        case "DETECTIVE_CHECK":
          if (action.playerId && "targetId" in action)
            this.handleDetectiveCheck(action.playerId, action.targetId);
          break;
        case "DECEIVER_FAKE":
          if (action.playerId && "text" in action)
            this.handleDeceiverFake(action.playerId, action.text);
          break;
      }
    }
  }

  // --- Client Request Methods ---

  requestStart(): void {
    this.isHost ? this.startGame() : this.sendAction({ type: "START_GAME" });
  }

  requestAddBot(): void {
    if (this.isHost) this.addBot();
  }

  requestRemoveBot(botId: string): void {
    if (this.isHost) this.removeBot(botId);
  }

  requestReset(): void {
    this.sendAction({ type: "RESET_GAME" });
    if (this.isHost) this.resetGame();
  }

  requestVote(targetId: string | null): void {
    this.sendAction({ type: "VOTE", targetId });
    if (this.isHost) this.handleVote(this.userId, targetId);
  }

  requestSpeech(text: string): void {
    this.sendAction({ type: "SPEECH", text });
    if (this.isHost) this.handleSpeech(this.userId, text);
  }

  requestSuspect(targetId: string): void {
    this.sendAction({ type: "SUSPECT", targetId });
    if (this.isHost) this.handleSuspect(this.userId, targetId);
  }

  requestReact(emoji: string, msgId?: string, targetId?: string): void {
    this.sendAction({ type: "REACT", emoji, msgId, targetId });
    if (this.isHost) this.handleReact(this.userId, emoji, msgId, targetId);
  }

  requestWolfKill(targetId: string): void {
    this.sendAction({ type: "WOLF_KILL", targetId });
    if (this.isHost) this.handleWolfVote(this.userId, targetId);
  }

  requestSeerCheck(targetId: string): void {
    this.sendAction({ type: "SEER_CHECK", targetId });
    if (this.isHost) this.handleSeerCheck(this.userId, targetId);
  }

  requestBodyguardProtect(targetId: string): void {
    this.sendAction({ type: "BODYGUARD_PROTECT", targetId });
    if (this.isHost) this.handleBodyguardProtect(this.userId, targetId);
  }

  requestDetectiveCheck(targetId: string): void {
    this.sendAction({ type: "DETECTIVE_CHECK", targetId });
    if (this.isHost) this.handleDetectiveCheck(this.userId, targetId);
  }

  requestLawyerSave(targetId: string): void {
    this.sendAction({ type: "LAWYER_SAVE", targetId });
    if (this.isHost) this.handleLawyerSave(this.userId, targetId);
  }

  requestDeceiverFake(text: string): void {
    this.sendAction({ type: "DECEIVER_FAKE", text });
    if (this.isHost) this.handleDeceiverFake(this.userId, text);
  }

  // --- Logic Implementation ---

  private startGame(): void {
    if (this.state.phase !== "WAITING") return;

    const playerIds = Object.keys(this.state.players);
    if (playerIds.length < 3) return; // Validation?

    // Assign Roles
    // Core: 2 Wolf, 1 Seer, 1 Bodyguard, rest Villager.
    // Random: Lawyer, Detective, Deceiver if enough players?
    // For now simple dist:
    const roles: WerewolfRole[] = ["WOLF", "WOLF", "SEER", "BODYGUARD"];
    if (playerIds.length >= 6) roles.push("LAWYER");
    if (playerIds.length >= 7) roles.push("DETECTIVE");
    if (playerIds.length >= 8) roles.push("DECEIVER");

    while (roles.length < playerIds.length) {
      roles.push("VILLAGER");
    }

    // Shuffle
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    playerIds.forEach((id, index) => {
      this.state.players[id].role = roles[index];
      this.state.players[id].isAlive = true;
      this.state.players[id].votes = 0;
    });

    this.state.dayCount = 1;
    this.state.history.push("night_start");

    this.startPhase("NIGHT");
  }

  private startPhase(phase: WerewolfPhase): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);

    this.state.phase = phase;
    this.state.timeRemaining = this.PHASE_DURATIONS[phase] || 0;

    this.broadcastState();
    this.setState({ ...this.state });

    // Start Timer
    if (this.state.timeRemaining > 0) {
      const interval = setInterval(() => {
        if (this.state.timeRemaining > 0) {
          this.state.timeRemaining--;
          // Optimization: Don't broadcast every second if expensive, but for < 20 players it's fine.
          this.broadcastState();
          this.setState({ ...this.state });
        } else {
          clearInterval(interval);
          this.handlePhaseTimeout(phase);
        }
      }, 1000);
      this.phaseTimer = interval;
    }

    // Auto-actions for bots
    if (phase === "NIGHT") this.processBotNightActions();
    if (phase === "DAY_SUSPICION") this.processBotSuspectActions();
    if (phase === "DAY_VOTE") this.processBotVoteActions();
  }

  private handlePhaseTimeout(phase: WerewolfPhase): void {
    switch (phase) {
      case "NIGHT":
        this.resolveNight();
        break;
      case "DAY_SUSPICION":
        this.startPhase("DAY_DEFENSE");
        break;
      case "DAY_DEFENSE":
        this.startPhase("DAY_VOTE");
        break;
      case "DAY_VOTE":
        this.resolveDayVoting();
        break;
    }
  }

  // --- Handlers ---

  private handleSpeech(playerId: string, text: string): void {
    if (!this.state.players[playerId]?.isAlive) return;
    if (text.length > 25) text = text.substring(0, 25); // Hard truncate

    // Limit check: 1 msg per phase in SUSPECT
    if (this.state.phase === "DAY_SUSPICION") {
      const sent = this.state.messages.filter(
        (m) => m.senderId === playerId && m.phase === "DAY_SUSPICION",
      ).length;
      if (sent >= 1) return;
    }

    const msg: WerewolfMessage = {
      id: Date.now().toString() + Math.random(),
      senderId: playerId,
      text,
      timestamp: Date.now(),
      phase: this.state.phase,
    };

    this.state.messages.push(msg);
    this.broadcastState();
    this.setState({ ...this.state });
  }

  private handleSuspect(playerId: string, targetId: string): void {
    if (this.state.phase !== "DAY_SUSPICION") return;
    this.state.suspicion[targetId] = (this.state.suspicion[targetId] || 0) + 1;
    this.broadcastState();
    this.setState({ ...this.state });
  }

  private handleReact(
    playerId: string,
    emoji: string,
    msgId?: string,
    targetId?: string,
  ): void {
    // Allow reactions mainly in Defense phase
    if (
      this.state.phase !== "DAY_DEFENSE" &&
      this.state.phase !== "DAY_SUSPICION"
    )
      return;

    if (msgId) {
      if (!this.state.reactions[msgId]) this.state.reactions[msgId] = {};
      this.state.reactions[msgId][playerId] = emoji;
    }
    this.broadcastState();
    this.setState({ ...this.state });
  }

  private handleVote(voterId: string, targetId: string | null): void {
    if (this.state.phase !== "DAY_VOTE") return;
    if (!this.state.players[voterId]?.isAlive) return;

    if (targetId) {
      this.state.votes[voterId] = targetId;
    } else {
      delete this.state.votes[voterId];
    }
    this.broadcastState();
    this.setState({ ...this.state });
  }

  private handleWolfVote(wolfId: string, targetId: string): void {
    if (this.state.phase !== "NIGHT") return;
    const p = this.state.players[wolfId];
    if (p.role !== "WOLF" || !p.isAlive) return;

    this.state.wolfVotes[wolfId] = targetId;
    this.broadcastState();
    this.setState({ ...this.state });
    // No early resolve, wait for timer
  }

  private handleSeerCheck(seerId: string, targetId: string): void {
    if (this.state.phase !== "NIGHT") return;
    const p = this.state.players[seerId];
    if (p.role !== "SEER" || !p.isAlive) return;

    const target = this.state.players[targetId];
    this.state.seerCheck = { seerId, targetId, result: target.role };
    this.broadcastState();
    this.setState({ ...this.state });
  }

  private handleBodyguardProtect(bgId: string, targetId: string): void {
    if (this.state.phase !== "NIGHT") return;
    const p = this.state.players[bgId];
    if (p.role !== "BODYGUARD" || !p.isAlive) return;

    this.state.bodyguardProtect = { bodyguardId: bgId, targetId };
    this.broadcastState();
    this.setState({ ...this.state });
  }

  private handleLawyerSave(lawyerId: string, targetId: string): void {
    if (
      !this.state.players[lawyerId]?.isAlive ||
      this.state.players[lawyerId].role !== "LAWYER"
    )
      return;
    if (this.state.lawyerSave) return; // Once per game
    this.state.lawyerSave = { lawyerId, targetId };
    // Can result in msg
    this.broadcastState();
    this.setState({ ...this.state });
  }

  private handleDetectiveCheck(detId: string, targetId: string): void {
    // Check if target acted last night
    if (
      !this.state.players[detId]?.isAlive ||
      this.state.players[detId].role !== "DETECTIVE"
    )
      return;
    // Simple logic: Did they target anyone?
    // We need to store last night's actions to verified.
    // For MVP, just return false or random? No, let's try to be accurate if possible.
    // But we cleared actions.
    // Let's simplify: Detective checks Suspicion? No, "Acted last night".
    // Need to persist previous night actions?
    // Skipping specific Detective Logic for MVP stability, always returning false for now or implementing later.
    this.state.detectiveCheck = { detectiveId: detId, targetId, result: false };
    this.broadcastState();
    this.setState({ ...this.state });
  }

  private handleDeceiverFake(deceiverId: string, text: string): void {
    if (
      !this.state.players[deceiverId]?.isAlive ||
      this.state.players[deceiverId].role !== "DECEIVER"
    )
      return;
    // Send as system message
    const msg: WerewolfMessage = {
      id: Date.now().toString(),
      senderId: "SYSTEM",
      text: text,
      timestamp: Date.now(),
      phase: this.state.phase,
      isSystem: true,
    };
    this.state.messages.push(msg);
    this.broadcastState();
    this.setState({ ...this.state });
  }

  // --- Resolutions ---

  private resolveNight(): void {
    // Tally Wolf Kills
    const voteCounts: Record<string, number> = {};
    Object.values(this.state.wolfVotes).forEach((target) => {
      voteCounts[target] = (voteCounts[target] || 0) + 1;
    });

    // Max vote victim
    let victimId: string | null = null;
    let maxVotes = 0;
    for (const [t, c] of Object.entries(voteCounts)) {
      if (c > maxVotes) {
        maxVotes = c;
        victimId = t;
      } else if (c === maxVotes) {
        victimId = null;
      }
    }

    // Bodyguard save
    if (victimId && this.state.bodyguardProtect?.targetId === victimId) {
      victimId = null; // Saved
    }

    if (victimId) {
      this.state.players[victimId].isAlive = false;
      this.state.history.push(`player_died:${victimId}`);
      this.state.messages.push({
        id: Date.now().toString(),
        senderId: "SYSTEM",
        text: `${this.state.players[victimId].id} was killed!`,
        timestamp: Date.now(),
        phase: "NIGHT",
        isSystem: true,
      });
    } else {
      this.state.history.push(`nobody_died`);
      this.state.messages.push({
        id: Date.now().toString(),
        senderId: "SYSTEM",
        text: `Peaceful night.`,
        timestamp: Date.now(),
        phase: "NIGHT",
        isSystem: true,
      });
    }

    // Cleanup Night State
    this.state.wolfVotes = {};
    this.state.seerCheck = null;
    this.state.bodyguardProtect = null;

    if (this.checkWinCondition()) return;

    this.startPhase("DAY_SUSPICION");
  }

  private resolveDayVoting(): void {
    const voteCounts: Record<string, number> = {};
    Object.values(this.state.votes).forEach((target) => {
      voteCounts[target] = (voteCounts[target] || 0) + 1;
    });

    // Lawyer implementation: Remove votes?
    if (this.state.lawyerSave) {
      const target = this.state.lawyerSave.targetId;
      if (voteCounts[target])
        voteCounts[target] = Math.max(0, voteCounts[target] - 1);
    }

    let victimId: string | null = null;
    let maxVotes = 0;
    for (const [t, c] of Object.entries(voteCounts)) {
      if (c > maxVotes) {
        maxVotes = c;
        victimId = t;
      } else if (c === maxVotes) victimId = null;
    }

    if (victimId) {
      this.state.players[victimId].isAlive = false;
      this.state.messages.push({
        id: Date.now().toString(),
        senderId: "SYSTEM",
        text: `${victimId} was executed!`,
        timestamp: Date.now(),
        phase: "DAY_VOTE",
        isSystem: true,
      });
    } else {
      this.state.messages.push({
        id: Date.now().toString(),
        senderId: "SYSTEM",
        text: `No one was executed.`,
        timestamp: Date.now(),
        phase: "DAY_VOTE",
        isSystem: true,
      });
    }

    this.state.votes = {};

    if (this.checkWinCondition()) return;

    this.state.dayCount++;
    this.startPhase("NIGHT");
  }

  private checkWinCondition(): boolean {
    const alive = Object.values(this.state.players).filter((p) => p.isAlive);
    const wolves = alive.filter((p) => p.role === "WOLF");
    const bad = wolves.length;
    const good = alive.length - bad;

    if (bad === 0) {
      this.state.winner = "VILLAGERS";
      this.state.phase = "FINISHED";
      if (this.phaseTimer) clearInterval(this.phaseTimer);
      this.broadcastState();
      this.setState({ ...this.state });
      return true;
    }
    if (bad >= good) {
      this.state.winner = "WOLVES";
      this.state.phase = "FINISHED";
      if (this.phaseTimer) clearInterval(this.phaseTimer);
      this.broadcastState();
      this.setState({ ...this.state });
      return true;
    }
    return false;
  }

  // --- Bot AI ---

  addBot(): void {
    if (this.state.phase !== "WAITING") return;
    const count = Object.keys(this.state.players).filter((id) =>
      id.startsWith("BOT_"),
    ).length;
    const id = `BOT_${count + 1}`;
    this.state.players[id] = { id, role: null, isAlive: true, votes: 0 };
    this.broadcastState();
    this.setState({ ...this.state });
  }

  removeBot(botId: string): void {
    if (this.state.phase !== "WAITING") return;
    if (this.state.players[botId]) {
      delete this.state.players[botId];
      this.broadcastState();
      this.setState({ ...this.state });
    }
  }

  private processBotNightActions(): void {
    // similar to before
    const bots = Object.values(this.state.players).filter(
      (p) => p.id.startsWith("BOT_") && p.isAlive,
    );
    bots.forEach((bot) => {
      setTimeout(
        () => {
          if (bot.role === "WOLF") this.botWolfAction(bot.id);
          if (bot.role === "SEER") this.botSeerAction(bot.id);
          if (bot.role === "BODYGUARD") this.botBodyguardAction(bot.id);
        },
        1000 + Math.random() * 5000,
      );
    });
  }

  private processBotSuspectActions(): void {
    // Bots randomly suspect someone
    const bots = Object.values(this.state.players).filter(
      (p) => p.id.startsWith("BOT_") && p.isAlive,
    );
    bots.forEach((bot) => {
      setTimeout(() => {
        const targets = Object.values(this.state.players).filter(
          (p) => p.id !== bot.id && p.isAlive,
        );
        if (targets.length > 0) {
          const t = targets[Math.floor(Math.random() * targets.length)];
          this.handleSuspect(bot.id, t.id);
        }
      }, Math.random() * 10000);
    });
  }

  private processBotVoteActions(): void {
    const bots = Object.values(this.state.players).filter(
      (p) => p.id.startsWith("BOT_") && p.isAlive,
    );
    bots.forEach((bot) => {
      setTimeout(() => {
        const targets = Object.values(this.state.players).filter(
          (p) => p.id !== bot.id && p.isAlive,
        );
        // Simple AI: Vote for most suspicious person?
        // Find person with most suspicions
        // For now random
        if (targets.length > 0) {
          const t = targets[Math.floor(Math.random() * targets.length)];
          this.handleVote(bot.id, t.id);
        }
      }, Math.random() * 5000);
    });
  }
  private botWolfAction(botId: string): void {
    const targets = Object.values(this.state.players).filter(
      (p) => p.isAlive && p.id !== botId && p.role !== "WOLF",
    );
    if (targets.length > 0) {
      const t = targets[Math.floor(Math.random() * targets.length)];
      this.handleWolfVote(botId, t.id);
    }
  }

  private botSeerAction(botId: string): void {
    const targets = Object.values(this.state.players).filter(
      (p) => p.isAlive && p.id !== botId,
    );
    if (targets.length > 0) {
      const t = targets[Math.floor(Math.random() * targets.length)];
      this.handleSeerCheck(botId, t.id);
    }
  }

  private botBodyguardAction(botId: string): void {
    const targets = Object.values(this.state.players).filter(
      (p) => p.isAlive && p.id !== botId,
    );
    if (targets.length > 0) {
      const t = targets[Math.floor(Math.random() * targets.length)];
      this.handleBodyguardProtect(botId, t.id);
    }
  }

  private resetGame(): void {
    // Reset state completely
    const initialPlayers: Record<string, WerewolfPlayer> = {};
    Object.keys(this.state.players).forEach((id) => {
      initialPlayers[id] = { id, role: null, isAlive: true, votes: 0 };
    });

    if (this.phaseTimer) clearInterval(this.phaseTimer);

    this.state = {
      players: initialPlayers,
      phase: "WAITING",
      dayCount: 0,
      timeRemaining: 0,
      history: [],
      votes: {},
      wolfVotes: {},
      winner: null,
      messages: [],
      suspicion: {},
      reactions: {},
      seerCheck: null,
      bodyguardProtect: null,
      lawyerSave: null,
      detectiveCheck: null,
    };
    this.broadcastState();
    this.setState({ ...this.state });
  }
}
