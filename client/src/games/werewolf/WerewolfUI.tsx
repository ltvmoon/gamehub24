import { useState, useEffect, useRef } from "react";
import Werewolf from "./Werewolf";
import {
  type WerewolfState,
  type WerewolfRole,
  type WerewolfPhase,
} from "./types";
import { useUserStore } from "../../stores/userStore";
import useLanguage from "../../stores/languageStore";
import type { GameUIProps } from "../types";
import {
  Moon,
  Sun,
  User,
  Skull,
  Eye,
  Vote,
  Play,
  RotateCcw,
  Bot,
  Trash2,
  Shield,
  Search,
  Scale, // Lawyer
  Zap, // Deceiver
  MessageSquare,
  AlertTriangle,
  Send,
  Timer,
} from "lucide-react";

export default function WerewolfUI({ game: baseGame }: GameUIProps) {
  const game = baseGame as Werewolf;
  const [state, setState] = useState<WerewolfState>(game.getState());
  const { userId } = useUserStore();
  const { ti } = useLanguage();
  const isHost = game.isHostUser;

  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    game.onUpdate((newState) => setState(newState));
  }, [game]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  const myPlayer = state.players[userId];
  const isMyRole = (role: WerewolfRole) => myPlayer?.role === role;
  const isAlive = myPlayer?.isAlive;

  const getRoleIcon = (role: WerewolfRole | null) => {
    switch (role) {
      case "WOLF":
        return <Moon className="w-5 h-5 text-red-400" />;
      case "SEER":
        return <Eye className="w-5 h-5 text-indigo-400" />;
      case "BODYGUARD":
        return <Shield className="w-5 h-5 text-green-400" />;
      case "LAWYER":
        return <Scale className="w-5 h-5 text-yellow-400" />;
      case "DETECTIVE":
        return <Search className="w-5 h-5 text-blue-400" />;
      case "DECEIVER":
        return <Zap className="w-5 h-5 text-orange-400" />;
      case "VILLAGER":
        return <User className="w-5 h-5 text-slate-400" />;
      default:
        return <User className="w-5 h-5 text-slate-600" />;
    }
  };

  const getRoleDisplayName = (role: WerewolfRole | null) => {
    switch (role) {
      case "WOLF":
        return "Werewolf";
      case "SEER":
        return "Seer";
      case "BODYGUARD":
        return "Bodyguard";
      case "LAWYER":
        return "Lawyer";
      case "DETECTIVE":
        return "Detective";
      case "DECEIVER":
        return "Deceiver";
      case "VILLAGER":
        return "Villager";
      default:
        return "Spectator";
    }
  };

  const getPhaseTitle = () => {
    switch (state.phase) {
      case "WAITING":
        return "WAITING LOBBY";
      case "NIGHT":
        return `NIGHT ${state.dayCount}`;
      case "DAY_SUSPICION":
        return `DAY ${state.dayCount}: SUSPICION`;
      case "DAY_DEFENSE":
        return `DAY ${state.dayCount}: DEFENSE`;
      case "DAY_VOTE":
        return `DAY ${state.dayCount}: VOTING`;
      case "FINISHED":
        return "GAME OVER";
    }
  };

  const getPhaseColor = () => {
    switch (state.phase) {
      case "NIGHT":
        return "bg-indigo-950 border-indigo-900";
      case "DAY_SUSPICION":
        return "bg-orange-900/50 border-orange-800";
      case "DAY_DEFENSE":
        return "bg-blue-900/50 border-blue-800";
      case "DAY_VOTE":
        return "bg-red-900/50 border-red-800";
      default:
        return "bg-slate-800 border-slate-700";
    }
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    if (state.phase === ("DECEIVER_fake" as any)) return; // Logic check elsewhere
    if (isMyRole("DECEIVER")) {
      // Deceiver UI toggle? Simplified: Deceiver always speaks truth in chat, uses ability button for fake?
      // Or toggle? Let's assume standard chat is standard.
    }
    game.requestSpeech(chatInput);
    setChatInput("");
  };

  const renderHeader = () => (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border-2 ${getPhaseColor()} transition-colors duration-500`}
    >
      <div className="flex items-center gap-3">
        {state.phase === "NIGHT" ? (
          <Moon className="w-8 h-8 text-indigo-300" />
        ) : (
          <Sun className="w-8 h-8 text-yellow-400" />
        )}
        <div>
          <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
            {getPhaseTitle()}
          </h2>
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <Timer className="w-4 h-4" />
            <span className="font-mono text-xl text-white">
              {state.timeRemaining}s
            </span>
          </div>
        </div>
      </div>

      {/* Action Prompts */}
      <div className="hidden md:block text-right">
        {state.phase === "DAY_SUSPICION" && (
          <p className="text-orange-200">Ping suspects! Max 25 chars.</p>
        )}
        {state.phase === "DAY_DEFENSE" && (
          <p className="text-blue-200">Listen to defense! React only.</p>
        )}
        {state.phase === "DAY_VOTE" && (
          <p className="text-red-200">Cast your vote!</p>
        )}
      </div>
    </div>
  );

  const renderPlayerGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Object.values(state.players).map((p) => {
        const isMe = p.id === userId;
        const suspiciousCount = state.suspicion[p.id] || 0;
        const recentMsg = state.messages
          .filter((m) => m.senderId === p.id && m.phase === state.phase)
          .pop();

        // Role Visibility
        const showRole =
          isMe ||
          state.phase === "FINISHED" ||
          !p.isAlive ||
          (isMyRole("WOLF") && p.role === "WOLF");

        // Actions on Player
        const canInteract = isAlive && p.isAlive && p.id !== userId;

        return (
          <div
            key={p.id}
            className={`relative flex flex-col p-3 rounded-xl border-2 transition-all ${p.isAlive ? "bg-slate-800 border-slate-700" : "bg-slate-900 border-slate-800 opacity-60 grayscale"}`}
          >
            {/* Suspicion Meter */}
            {p.isAlive && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-700 rounded-t-xl overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all"
                  style={{ width: `${Math.min(suspiciousCount * 10, 100)}%` }}
                />
              </div>
            )}

            {/* Avatar Area */}
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-slate-400" />
                </div>
                {/* Badges */}
                {state.votes[p.id] && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-xs w-4 h-4 flex items-center justify-center rounded-full">
                    V
                  </div>
                )}
              </div>
              <div className="overflow-hidden">
                <div className="font-bold text-slate-200 truncate">
                  {isMe ? "YOU" : p.id.substring(0, 8)}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  {showRole ? (
                    getRoleIcon(p.role)
                  ) : (
                    <User className="w-3 h-3" />
                  )}
                  {showRole ? p.role : "Unknown"}
                </div>
              </div>
            </div>

            {/* Chat Bubble */}
            {recentMsg && (
              <div className="bg-slate-700 p-2 rounded-lg text-xs text-slate-200 mb-2 relative animate-fade-in break-words">
                {recentMsg.text}
                <div className="absolute bottom-0 left-2 w-2 h-2 bg-slate-700 rotate-45 translate-y-1" />
              </div>
            )}

            {/* Action Buttons Overlay */}
            {canInteract && (
              <div className="mt-auto flex gap-1 justify-center">
                {/* Night Actions */}
                {state.phase === "NIGHT" && isMyRole("WOLF") && (
                  <button
                    onClick={() => game.requestWolfKill(p.id)}
                    className="p-1.5 bg-red-900/80 hover:bg-red-600 rounded text-red-200"
                  >
                    <Skull className="w-4 h-4" />
                  </button>
                )}
                {state.phase === "NIGHT" &&
                  isMyRole("SEER") &&
                  !state.seerCheck && (
                    <button
                      onClick={() => game.requestSeerCheck(p.id)}
                      className="p-1.5 bg-indigo-900/80 hover:bg-indigo-600 rounded text-indigo-200"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                {state.phase === "NIGHT" &&
                  isMyRole("BODYGUARD") &&
                  !state.bodyguardProtect && (
                    <button
                      onClick={() => game.requestBodyguardProtect(p.id)}
                      className="p-1.5 bg-green-900/80 hover:bg-green-600 rounded text-green-200"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                  )}
                {state.phase === "NIGHT" &&
                  isMyRole("DETECTIVE") &&
                  !state.detectiveCheck && (
                    <button
                      onClick={() => game.requestDetectiveCheck(p.id)}
                      className="p-1.5 bg-blue-900/80 hover:bg-blue-600 rounded text-blue-200"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  )}

                {/* Day Actions */}
                {state.phase === "DAY_SUSPICION" && (
                  <button
                    onClick={() => game.requestSuspect(p.id)}
                    className="p-1.5 bg-orange-900/80 hover:bg-orange-600 rounded text-orange-200 flex items-center gap-1 text-xs px-2"
                  >
                    <AlertTriangle className="w-3 h-3" /> Suspect
                  </button>
                )}
                {state.phase === "DAY_VOTE" && (
                  <button
                    onClick={() => game.requestVote(p.id)}
                    className="p-1.5 bg-red-900/80 hover:bg-red-600 rounded text-red-200 flex items-center gap-1 text-xs px-2"
                  >
                    <Vote className="w-3 h-3" /> VOTE
                  </button>
                )}

                {/* Special Role Day Actions */}
                {isMyRole("LAWYER") &&
                  !state.lawyerSave &&
                  state.phase.startsWith("DAY") && (
                    <button
                      onClick={() => game.requestLawyerSave(p.id)}
                      className="p-1.5 bg-yellow-900/80 hover:bg-yellow-600 rounded text-yellow-200"
                    >
                      <Scale className="w-4 h-4" />
                    </button>
                  )}
              </div>
            )}

            {/* Host Actions */}
            {state.phase === "WAITING" && isHost && p.id.startsWith("BOT_") && (
              <button
                onClick={() => game.requestRemoveBot(p.id)}
                className="absolute top-2 right-2 text-red-500 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderChatArea = () => (
    <div className="flex flex-col h-64 bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* System & Game Messages */}
        {state.messages.map((msg) => {
          const isSystem = msg.isSystem;
          const senderName =
            msg.senderId === "SYSTEM"
              ? "SYSTEM"
              : msg.senderId === userId
                ? "You"
                : msg.senderId.substring(0, 8);
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isSystem ? "items-center" : msg.senderId === userId ? "items-end" : "items-start"}`}
            >
              {isSystem ? (
                <span className="bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-full">
                  {msg.text}
                </span>
              ) : (
                <div
                  className={`max-w-[80%] p-2 rounded-lg text-sm ${msg.senderId === userId ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-200"}`}
                >
                  <div className="text-xs opacity-50 mb-1">{senderName}</div>
                  {msg.text}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {(state.phase === "DAY_SUSPICION" || state.phase === "DAY_DEFENSE") &&
        isAlive && (
          <div className="p-2 bg-slate-800 border-t border-slate-700 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= 25) setChatInput(val);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder={
                state.phase === "DAY_SUSPICION"
                  ? "Suspect someone (max 25 chars)..."
                  : "Defense..."
              }
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              disabled={
                state.phase === "DAY_DEFENSE" &&
                false /* TODO: Check if forced to speak? For now everyone can speak strictly */
              }
            />
            <div className="flex items-center text-xs text-slate-500 w-10 justify-center">
              {25 - chatInput.length}
            </div>
            <button
              onClick={handleSendChat}
              className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        )}

      {/* Emoji Reactions for Defense Phase */}
      {state.phase === "DAY_DEFENSE" && isAlive && (
        <div className="p-2 bg-slate-800 border-t border-slate-700 flex justify-center gap-4">
          {["🤔", "😱", "😂", "🐺", "❌"].map((emoji) => (
            <button
              key={emoji}
              onClick={() => game.requestReact(emoji)}
              className="text-2xl hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 p-2 w-full max-w-5xl mx-auto pb-20">
      {renderHeader()}

      {/* Waiting Lobby Controls */}
      {state.phase === "WAITING" && (
        <div className="flex justify-center gap-4 p-4">
          {isHost && (
            <>
              <button
                onClick={() => game.requestStart()}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold flex gap-2"
              >
                <Play /> Start Game
              </button>
              <button
                onClick={() => game.requestAddBot()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold flex gap-2"
              >
                <Bot /> Add Bot
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
          {renderPlayerGrid()}
        </div>
        <div className="lg:col-span-1 order-1 lg:order-2">
          {renderChatArea()}

          {/* My Role Card */}
          {myPlayer && (
            <div className="mt-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                {getRoleIcon(myPlayer.role)}
                <span className="text-xl font-bold text-white">
                  {getRoleDisplayName(myPlayer.role)}
                </span>
              </div>
              <div className="text-sm text-slate-400">
                {isMyRole("WOLF") &&
                  "Kill villagers at night. Don't get caught!"}
                {isMyRole("SEER") && "Check one player's role each night."}
                {isMyRole("BODYGUARD") && "Protect one player each night."}
                {isMyRole("VILLAGER") && "Find the wolves!"}
                {isMyRole("LAWYER") && "Save a client from execution once."}
              </div>
              {/* Deceiver Ability */}
              {isMyRole("DECEIVER") && state.phase.startsWith("DAY") && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <p className="text-xs text-orange-400 mb-1">
                    Deceiver Ability (Fake System Msg)
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Fake msg..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                      id="fake-msg"
                    />
                    <button
                      onClick={() => {
                        const el = document.getElementById(
                          "fake-msg",
                        ) as HTMLInputElement;
                        if (el && el.value) game.requestDeceiverFake(el.value);
                      }}
                      className="bg-orange-600 text-white text-xs px-2 py-1 rounded"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {state.phase === "FINISHED" && isHost && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-2xl text-center border-2 border-yellow-500">
            <h1 className="text-4xl font-bold text-yellow-400 mb-4">
              {state.winner} WIN!
            </h1>
            <button
              onClick={() => game.requestReset()}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-xl flex items-center gap-2 mx-auto hover:bg-blue-500 transition-colors"
            >
              <RotateCcw /> Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
