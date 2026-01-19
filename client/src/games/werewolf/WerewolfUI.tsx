import React, { useEffect, useState, useMemo } from "react";
import type { GameUIProps } from "../types";
import Werewolf from "./Werewolf";
import type {
  WerewolfState,
  WerewolfPlayer,
  WerewolfRole,
  GamePhase,
} from "./types";
import { ROLE_INFO, QUICK_MESSAGES } from "./types";
import {
  Moon,
  Sun,
  MessageSquare,
  Vote,
  Skull,
  Users,
  Timer,
  Send,
  Target,
  Heart,
  X,
  Check,
  Bot,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAlertStore } from "../../stores/alertStore";

// Utility functions
const getRoleDisplayName = (
  role: WerewolfRole | null,
  lang: "en" | "vi" = "vi",
): string => {
  if (!role) return lang === "en" ? "Unknown" : "Chưa rõ";
  return ROLE_INFO[role]?.name[lang] || role;
};

const getPhaseIcon = (phase: GamePhase) => {
  switch (phase) {
    case "night":
      return <Moon className="w-5 h-5" />;
    case "morning":
      return <Sun className="w-5 h-5" />;
    case "discussion":
      return <MessageSquare className="w-5 h-5" />;
    case "voting":
      return <Vote className="w-5 h-5" />;
    case "elimination":
    case "hunterRevenge":
      return <Skull className="w-5 h-5" />;
    default:
      return <Users className="w-5 h-5" />;
  }
};

const getPhaseLabel = (phase: GamePhase, lang: "en" | "vi" = "vi"): string => {
  const labels: Record<GamePhase, { en: string; vi: string }> = {
    setup: { en: "Setup", vi: "Thiết lập" },
    night: { en: "Night", vi: "Đêm" },
    morning: { en: "Morning", vi: "Sáng" },
    discussion: { en: "Discussion", vi: "Thảo luận" },
    voting: { en: "Voting", vi: "Bình chọn" },
    elimination: { en: "Elimination", vi: "Loại bỏ" },
    hunterRevenge: { en: "Hunter's Revenge", vi: "Thợ Săn trả thù" },
    end: { en: "Game Over", vi: "Kết thúc" },
  };
  return labels[phase]?.[lang] || phase;
};

// Timer Component
const TimerDisplay: React.FC<{ endTime: number | null }> = ({ endTime }) => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endTime) return;
    const update = () =>
      setRemaining(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  if (!endTime) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div
      className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-mono ${
        remaining <= 10
          ? "bg-red-500/20 text-red-400 animate-pulse"
          : "bg-white/10 text-white/70"
      }`}
    >
      <Timer className="w-4 h-4" />
      {minutes}:{seconds.toString().padStart(2, "0")}
    </div>
  );
};

// Player Card Component
const PlayerCard: React.FC<{
  player: WerewolfPlayer;
  isMe: boolean;
  isSelected: boolean;
  canSelect: boolean;
  showRole: boolean;
  suspicionCount: number;
  voteCount: number;
  onClick?: () => void;
}> = ({
  player,
  isMe,
  isSelected,
  canSelect,
  showRole,
  suspicionCount,
  voteCount,
  onClick,
}) => {
  const roleInfo = player.role ? ROLE_INFO[player.role] : null;

  return (
    <button
      onClick={onClick}
      disabled={!canSelect}
      className={`relative flex flex-col items-center p-3 rounded-xl transition-all ${
        !player.isAlive ? "opacity-50 grayscale" : ""
      } ${
        isSelected
          ? "ring-2 ring-yellow-400 bg-yellow-400/20"
          : "bg-white/5 hover:bg-white/10"
      } ${canSelect ? "cursor-pointer" : "cursor-default"} ${isMe ? "ring-1 ring-blue-400" : ""}`}
    >
      {/* Avatar */}
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
          player.isAlive
            ? "bg-gradient-to-br from-purple-500 to-pink-500"
            : "bg-gray-600"
        }`}
      >
        {showRole && roleInfo ? roleInfo.icon : "👤"}
      </div>

      {/* Name */}
      <span className="mt-1 text-sm font-medium truncate max-w-full">
        {player.username}
        {isMe && <span className="text-blue-400 ml-1">(Bạn)</span>}
        {player.isBot && <Bot className="inline w-3 h-3 ml-1 text-gray-400" />}
      </span>

      {/* Status indicators */}
      <div className="flex gap-1 mt-1">
        {!player.isAlive && <span className="text-xs">💀</span>}
        {player.loverId && <span className="text-xs">💕</span>}
        {suspicionCount > 0 && (
          <span className="text-xs bg-red-500/30 px-1 rounded">
            🔴{suspicionCount}
          </span>
        )}
        {voteCount > 0 && (
          <span className="text-xs bg-orange-500/30 px-1 rounded">
            🗳️{voteCount}
          </span>
        )}
      </div>

      {/* Role (if visible) */}
      {showRole && roleInfo && (
        <span
          className={`text-xs mt-1 px-2 py-0.5 rounded-full`}
          style={{
            backgroundColor: roleInfo.color + "30",
            color: roleInfo.color,
          }}
        >
          {roleInfo.name.vi}
        </span>
      )}
    </button>
  );
};

// Setup Phase Component
const SetupPhase: React.FC<{
  game: Werewolf;
  state: WerewolfState;
  currentUserId: string;
  isHost: boolean;
}> = ({ game, state, currentUserId, isHost }) => {
  const mySlotIndex = state.players.findIndex((p) => p.id === currentUserId);
  const activeCount = state.players.filter((p) => p.id !== null).length;

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold">🐺 Ma Sói Online</h2>
        <p className="text-white/60 text-sm">
          Chờ người chơi... ({activeCount}/{state.minPlayers} tối thiểu)
        </p>
      </div>

      {/* Player Slots */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
        {state.players.slice(0, 12).map((player, index) => (
          <div
            key={index}
            className={`p-3 rounded-xl text-center ${
              player.id
                ? "bg-white/10"
                : "bg-white/5 border-2 border-dashed border-white/20"
            }`}
          >
            {player.id ? (
              <>
                <div className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl">
                  {player.isBot ? "🤖" : "👤"}
                </div>
                <p className="text-sm mt-1 truncate">{player.username}</p>
                {isHost && player.id !== currentUserId && (
                  <button
                    onClick={() =>
                      player.isBot
                        ? game.requestRemoveBot(index)
                        : game.requestLeaveSlot(index)
                    }
                    className="text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 px-2 py-1 rounded-lg mt-1 flex items-center justify-center gap-1"
                  >
                    <X className="w-3 h-3" /> Xóa
                  </button>
                )}
              </>
            ) : (
              <div className="py-2">
                {mySlotIndex === -1 ? (
                  <button
                    onClick={() => game.requestJoinSlot(index, "Player")}
                    className="text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1"
                  >
                    👤 Tham gia
                  </button>
                ) : isHost ? (
                  <button
                    onClick={() => game.requestAddBot(index)}
                    className="text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 px-3 py-1.5 rounded-lg flex items-center justify-center gap-1"
                  >
                    <Bot className="w-3 h-3" /> Thêm Bot
                  </button>
                ) : (
                  <span className="text-xs text-white/40">Trống</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Start Button */}
      {isHost && (
        <button
          onClick={() => game.requestStartGame()}
          disabled={!game.canStartGame()}
          className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${
            game.canStartGame()
              ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
              : "bg-gray-600 text-gray-400 cursor-not-allowed"
          }`}
        >
          <Play className="w-5 h-5" /> Bắt đầu game
        </button>
      )}
    </div>
  );
};

// Night Phase Component
const NightPhase: React.FC<{
  game: Werewolf;
  state: WerewolfState;
  currentUserId: string;
}> = ({ game, state, currentUserId }) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedSecondTarget, setSelectedSecondTarget] = useState<
    string | null
  >(null);
  const [useHeal, setUseHeal] = useState(false);
  const [useKill, setUseKill] = useState(false);

  const myPlayer = state.players.find((p) => p.id === currentUserId);
  const myRole = myPlayer?.role;
  const isMyTurn =
    myRole === state.nightSubPhase ||
    (myRole === "wolf" && state.nightSubPhase === "wolf");

  const roleInfo = myRole ? ROLE_INFO[myRole] : null;
  const witchPotions =
    myRole === "witch" && currentUserId
      ? state.witchPotions[currentUserId]
      : null;

  const targets = useMemo(() => {
    if (!myRole) return [];
    return state.players.filter((p) => {
      if (!p.isAlive || !p.id) return false;
      if (myRole === "wolf") return p.role !== "wolf";
      if (myRole === "bodyguard")
        return p.id !== state.nightActions.lastBodyguardTarget;
      if (myRole === "cupid") return true;
      if (myRole === "seer") return p.id !== currentUserId;
      return p.id !== currentUserId;
    });
  }, [
    myRole,
    state.players,
    state.nightActions.lastBodyguardTarget,
    currentUserId,
  ]);

  const handleConfirm = () => {
    if (!myRole) return;

    if (myRole === "cupid" && selectedTarget && selectedSecondTarget) {
      game.requestNightAction(
        myRole,
        selectedTarget,
        false,
        false,
        selectedSecondTarget,
      );
    } else if (myRole === "witch") {
      game.requestNightAction(
        myRole,
        useKill ? selectedTarget : null,
        useHeal,
        useKill,
        undefined,
      );
    } else if (selectedTarget) {
      game.requestNightAction(myRole, selectedTarget, false, false, undefined);
    }
  };

  if (!myPlayer?.isAlive) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/50">
        <Skull className="w-16 h-16 mb-4" />
        <p>Bạn đã chết. Đang chờ đêm kết thúc...</p>
      </div>
    );
  }

  if (!roleInfo?.hasNightAction || !isMyTurn) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Moon className="w-16 h-16 text-indigo-400 mb-4 animate-pulse" />
        <p className="text-white/70">💤 Làng đang ngủ...</p>
        <p className="text-white/50 text-sm mt-2">
          Chờ các vai trò khác hành động
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-4">
        <span className="text-3xl">{roleInfo.icon}</span>
        <h3 className="text-lg font-bold" style={{ color: roleInfo.color }}>
          {roleInfo.name.vi}
        </h3>
        <p className="text-sm text-white/60">
          {roleInfo.nightActionDescription?.vi}
        </p>
      </div>

      {/* Witch special UI */}
      {myRole === "witch" && witchPotions && (
        <div className="flex gap-2 mb-4">
          {witchPotions.hasHealPotion && state.nightActions.wolfTarget && (
            <button
              onClick={() => setUseHeal(!useHeal)}
              className={`flex-1 p-3 rounded-xl flex flex-col items-center ${
                useHeal
                  ? "bg-green-500/30 ring-2 ring-green-400"
                  : "bg-white/10"
              }`}
            >
              <Heart className="w-6 h-6 text-green-400" />
              <span className="text-xs mt-1">Cứu nạn nhân</span>
            </button>
          )}
          {witchPotions.hasKillPotion && (
            <button
              onClick={() => setUseKill(!useKill)}
              className={`flex-1 p-3 rounded-xl flex flex-col items-center ${
                useKill ? "bg-red-500/30 ring-2 ring-red-400" : "bg-white/10"
              }`}
            >
              <Skull className="w-6 h-6 text-red-400" />
              <span className="text-xs mt-1">Giết thêm</span>
            </button>
          )}
        </div>
      )}

      {/* Target selection */}
      {(myRole !== "witch" || useKill) && (
        <div className="grid grid-cols-3 gap-2 mb-4 flex-1 overflow-auto p-2">
          {targets.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isMe={player.id === currentUserId}
              isSelected={
                selectedTarget === player.id ||
                selectedSecondTarget === player.id
              }
              canSelect={true}
              showRole={false}
              suspicionCount={0}
              voteCount={0}
              onClick={() => {
                if (myRole === "cupid") {
                  if (!selectedTarget) setSelectedTarget(player.id);
                  else if (selectedTarget === player.id)
                    setSelectedTarget(null);
                  else if (!selectedSecondTarget)
                    setSelectedSecondTarget(player.id);
                  else if (selectedSecondTarget === player.id)
                    setSelectedSecondTarget(null);
                } else {
                  setSelectedTarget(
                    selectedTarget === player.id ? null : player.id,
                  );
                }
              }}
            />
          ))}
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={
          myRole === "cupid"
            ? !selectedTarget || !selectedSecondTarget
            : myRole !== "witch" && !selectedTarget
        }
        className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Check className="w-5 h-5 inline mr-2" />
        Xác nhận
      </button>
    </div>
  );
};

// Discussion Phase Component
const DiscussionPhase: React.FC<{
  game: Werewolf;
  state: WerewolfState;
  currentUserId: string;
}> = ({ game, state, currentUserId }) => {
  const [message, setMessage] = useState("");
  const [showQuickMessages, setShowQuickMessages] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  const myPlayer = state.players.find((p) => p.id === currentUserId);
  const alivePlayers = state.players.filter((p) => p.isAlive && p.id);

  const getSuspicionCount = (playerId: string) =>
    state.suspicionMarkers.filter((m) => m.toPlayerId === playerId).length;

  const handleSendMessage = () => {
    if (!message.trim() || !myPlayer?.isAlive) return;
    game.requestSendMessage(message.trim(), "text");
    setMessage("");
  };

  const handleQuickMessage = (qm: (typeof QUICK_MESSAGES)[0]) => {
    if (!myPlayer?.isAlive) return;
    if (qm.targetRequired && !selectedTarget) return;

    const content =
      qm.targetRequired && selectedTarget
        ? qm.textVi.replace(
            "{target}",
            state.players.find((p) => p.id === selectedTarget)?.username || "",
          )
        : qm.textVi;

    game.requestSendMessage(
      content,
      "quick",
      selectedTarget || undefined,
      qm.id,
    );
    setSelectedTarget(null);
  };

  return (
    <div className="flex flex-col h-full p-2">
      {/* Player grid with suspicion */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        {alivePlayers.map((player) => (
          <button
            key={player.id}
            onClick={() =>
              setSelectedTarget(selectedTarget === player.id ? null : player.id)
            }
            className={`p-2 rounded-lg text-center text-xs ${
              selectedTarget === player.id
                ? "bg-yellow-500/30 ring-1 ring-yellow-400"
                : "bg-white/5"
            }`}
          >
            <span className="block truncate">{player.username}</span>
            {getSuspicionCount(player.id!) > 0 && (
              <span className="text-red-400">
                🔴{getSuspicionCount(player.id!)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Suspicion button */}
      {selectedTarget && myPlayer?.isAlive && (
        <button
          onClick={() => game.requestAddSuspicion(selectedTarget)}
          className="w-full mb-2 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm"
        >
          <Target className="w-4 h-4 inline mr-1" />
          Nghi ngờ{" "}
          {state.players.find((p) => p.id === selectedTarget)?.username}
        </button>
      )}

      {/* Quick messages */}
      <button
        onClick={() => setShowQuickMessages(!showQuickMessages)}
        className="flex items-center justify-between w-full p-2 bg-white/5 rounded-lg mb-2 text-sm"
      >
        <span>💬 Tin nhắn nhanh</span>
        {showQuickMessages ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {showQuickMessages && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          {QUICK_MESSAGES.slice(0, 8).map((qm) => (
            <button
              key={qm.id}
              onClick={() => handleQuickMessage(qm)}
              disabled={qm.targetRequired && !selectedTarget}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-left flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <span className="text-lg">{qm.icon}</span>
              <span className="truncate">
                {qm.targetRequired
                  ? qm.textVi.replace(
                      "{target}",
                      selectedTarget
                        ? state.players.find((p) => p.id === selectedTarget)
                            ?.username || "..."
                        : "[chọn người]",
                    )
                  : qm.textVi}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-auto bg-black/20 rounded-lg p-2 mb-2 min-h-[100px]">
        {state.chatMessages.slice(-20).map((msg) => (
          <div key={msg.id} className="mb-1 text-sm">
            <span className="font-medium text-blue-400">{msg.playerName}:</span>{" "}
            <span className="text-white/80">{msg.content}</span>
          </div>
        ))}
      </div>

      {/* Input */}
      {myPlayer?.isAlive && (myPlayer.messagesRemaining || 0) > 0 && (
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 100))}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={`Nhập tin nhắn... (${myPlayer.messagesRemaining}/3)`}
            className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={handleSendMessage}
            className="p-2 bg-blue-500 rounded-lg"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

// Voting Phase Component
const VotingPhase: React.FC<{
  game: Werewolf;
  state: WerewolfState;
  currentUserId: string;
}> = ({ game, state, currentUserId }) => {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  const myPlayer = state.players.find((p) => p.id === currentUserId);
  const alivePlayers = state.players.filter((p) => p.isAlive && p.id);

  const getVoteCount = (playerId: string) =>
    state.eliminationVotes.filter((v) => v.targetId === playerId).length;

  const handleVote = () => {
    game.requestCastVote(selectedTarget);
  };

  if (myPlayer?.hasVoted) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Check className="w-16 h-16 text-green-400 mb-4" />
        <p className="text-white/70">Đã bình chọn! Đang chờ người khác...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-4">
        <Vote className="w-10 h-10 mx-auto text-orange-400 mb-2" />
        <h3 className="text-lg font-bold">Bình chọn loại ai?</h3>
      </div>

      <div className="grid grid-cols-3 gap-2 flex-1 overflow-auto mb-4">
        {alivePlayers.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            isMe={player.id === currentUserId}
            isSelected={selectedTarget === player.id}
            canSelect={myPlayer?.isAlive || false}
            showRole={false}
            suspicionCount={0}
            voteCount={getVoteCount(player.id!)}
            onClick={() =>
              setSelectedTarget(selectedTarget === player.id ? null : player.id)
            }
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            setSelectedTarget(null);
            handleVote();
          }}
          className="flex-1 py-3 bg-gray-600 rounded-xl font-bold"
        >
          Bỏ qua
        </button>
        <button
          onClick={handleVote}
          disabled={!selectedTarget}
          className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl font-bold disabled:opacity-50"
        >
          Bình chọn
        </button>
      </div>
    </div>
  );
};

// Game End Component
const GameEnd: React.FC<{
  game: Werewolf;
  state: WerewolfState;
  currentUserId: string;
  isHost: boolean;
}> = ({ game, state, isHost }) => {
  const winnerLabel =
    state.winner === "wolf"
      ? "🐺 Ma Sói thắng!"
      : state.winner === "village"
        ? "🏘️ Dân Làng thắng!"
        : "💕 Tình Nhân thắng!";

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-3xl font-bold mb-4">{winnerLabel}</h2>

      <div className="grid grid-cols-3 gap-2 mb-6">
        {state.players
          .filter((p) => p.id)
          .map((player) => (
            <div
              key={player.id}
              className="text-center p-2 bg-white/5 rounded-lg"
            >
              <span className="text-2xl">
                {player.role ? ROLE_INFO[player.role].icon : "👤"}
              </span>
              <p className="text-sm">{player.username}</p>
              <p className="text-xs text-white/60">
                {getRoleDisplayName(player.role)}
              </p>
            </div>
          ))}
      </div>

      {isHost && (
        <button
          onClick={() => game.requestResetGame()}
          className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-bold flex items-center gap-2"
        >
          <RotateCcw className="w-5 h-5" /> Chơi lại
        </button>
      )}
    </div>
  );
};

// Main Component
const WerewolfUI: React.FC<GameUIProps> = ({ game, currentUserId = "" }) => {
  const werewolf = game as Werewolf;
  const [state, setState] = useState<WerewolfState>(werewolf.getState());
  const { confirm: showConfirm } = useAlertStore();

  useEffect(() => {
    return werewolf.onUpdate(setState);
  }, [werewolf]);

  const renderPhase = () => {
    switch (state.phase) {
      case "setup":
        return (
          <SetupPhase
            game={werewolf}
            state={state}
            currentUserId={currentUserId}
            isHost={werewolf.isHost}
          />
        );
      case "night":
        return (
          <NightPhase
            game={werewolf}
            state={state}
            currentUserId={currentUserId}
          />
        );
      case "morning":
      case "elimination":
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <Sun className="w-16 h-16 text-yellow-400 mb-4" />
            {state.logs.slice(-3).map((log) => (
              <p key={log.id} className="text-center mb-2">
                {log.message.vi}
              </p>
            ))}
          </div>
        );
      case "discussion":
        return (
          <DiscussionPhase
            game={werewolf}
            state={state}
            currentUserId={currentUserId}
          />
        );
      case "voting":
        return (
          <VotingPhase
            game={werewolf}
            state={state}
            currentUserId={currentUserId}
          />
        );
      case "hunterRevenge":
        return (
          <VotingPhase
            game={werewolf}
            state={state}
            currentUserId={currentUserId}
          />
        );
      case "end":
        return (
          <GameEnd
            game={werewolf}
            state={state}
            currentUserId={currentUserId}
            isHost={werewolf.isHost}
          />
        );
      default:
        return null;
    }
  };

  const myPlayer = state.players.find((p) => p.id === currentUserId);
  const myRole = myPlayer?.role ? ROLE_INFO[myPlayer.role] : null;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {getPhaseIcon(state.phase)}
          <span className="font-bold">{getPhaseLabel(state.phase)}</span>
          {state.day > 0 && (
            <span className="text-white/60 text-sm">Ngày {state.day}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* New Game button for host */}
          {werewolf.isHost && state.isGameStarted && (
            <button
              onClick={async () => {
                if (
                  await showConfirm("Bạn có chắc chắn muốn chơi lại ván này?")
                ) {
                  werewolf.requestResetGame();
                }
              }}
              className="px-2 py-1 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-lg text-xs flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Ván mới
            </button>
          )}
          {myRole && state.isGameStarted && (
            <span
              className="px-2 py-1 rounded-full text-xs"
              style={{
                backgroundColor: myRole.color + "30",
                color: myRole.color,
              }}
            >
              {myRole.icon} {myRole.name.vi}
            </span>
          )}
          <TimerDisplay endTime={state.phaseEndTime} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-2">{renderPhase()}</div>
    </div>
  );
};

export default WerewolfUI;
