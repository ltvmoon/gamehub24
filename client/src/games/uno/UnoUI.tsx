import { useEffect, useState, useMemo } from "react";
import Uno from "./Uno";
import type { UnoState, UnoCard, PlayerSlot, CardColor } from "./types";
import {
  CardColor as Colors,
  CardType,
  COLOR_BG_CLASSES,
  TYPE_DISPLAY,
} from "./types";
import {
  Play,
  Bot,
  User,
  X,
  RefreshCcw,
  Check,
  Crown,
  Sparkle,
  Layers,
  Hand,
} from "lucide-react";
import { useUserStore } from "../../stores/userStore";
import { useAlertStore } from "../../stores/alertStore";
import type { GameUIProps } from "../types";

export default function UnoUI({ game: baseGame }: GameUIProps) {
  const game = baseGame as Uno;
  const [state, setState] = useState<UnoState>(game.getState());
  const [selectedCard, setSelectedCard] = useState<UnoCard | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showDiscardHistory, setShowDiscardHistory] = useState(false);
  const { username } = useUserStore();

  const isHost = game.isHostUser;
  const myIndex = game.getMyPlayerIndex();
  const mySlot = myIndex >= 0 ? state.players[myIndex] : null;
  const isMyTurn = state.currentTurnIndex === myIndex;
  const canStart = game.canStartGame();

  useEffect(() => {
    game.onUpdate((newState) => {
      setState(newState);
      setSelectedCard(null);
    });
  }, [game]);

  const handleCardClick = (card: UnoCard) => {
    if (!isMyTurn || state.gamePhase !== "playing") return;
    if (state.pendingDraw > 0) return; // Must draw first

    if (!game.canPlayCardCheck(card)) return;

    // Check if wild card
    if (card.type === CardType.WILD || card.type === CardType.WILD_DRAW_FOUR) {
      setSelectedCard(card);
      setShowColorPicker(true);
    } else {
      game.requestPlayCard(card);
    }
  };

  const handleColorSelect = (color: CardColor) => {
    if (selectedCard) {
      game.requestPlayCard(selectedCard, color);
      setShowColorPicker(false);
      setSelectedCard(null);
    }
  };

  const handleDraw = () => {
    game.requestDrawCard();
  };

  const handleCallUno = () => {
    game.requestCallUno();
  };

  // Arrange players around table
  const arrangedPlayers = useMemo(() => {
    const result = [];
    const baseIndex = myIndex >= 0 ? myIndex : 0;
    for (let i = 0; i < 4; i++) {
      const actualIndex = (baseIndex + i) % 4;
      result.push({ slot: state.players[actualIndex], actualIndex });
    }
    return result;
  }, [state.players, myIndex]);

  const topCard = state.discardPile[state.discardPile.length - 1];

  const renderPlayerSlot = (playerIndex: number, compact = false) => {
    const player = arrangedPlayers[playerIndex];
    const isInGame = myIndex >= 0;
    return (
      <PlayerSlotDisplay
        key={player.actualIndex}
        slot={player.slot}
        index={player.actualIndex}
        isCurrentTurn={state.currentTurnIndex === player.actualIndex}
        isHost={isHost}
        gamePhase={state.gamePhase}
        onAddBot={() => game.requestAddBot(player.actualIndex)}
        onJoinSlot={() => game.requestJoinSlot(player.actualIndex, username)}
        onRemove={() => game.requestRemovePlayer(player.actualIndex)}
        compact={compact}
        isInGame={isInGame}
      />
    );
  };

  return (
    <div className="flex flex-col h-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
      {/* Mobile: Top row with 3 opponents */}
      <div className="flex sm:hidden justify-center gap-2">
        {renderPlayerSlot(1, true)}
        {renderPlayerSlot(2, true)}
        {renderPlayerSlot(3, true)}
      </div>

      {/* Desktop: Top Player */}
      <div className="hidden sm:flex justify-center">{renderPlayerSlot(2)}</div>

      {/* Desktop: Middle Row */}
      <div className="hidden sm:flex flex-1 items-center justify-between gap-4">
        {renderPlayerSlot(1)}

        {/* Play Area - Desktop */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[200px] bg-slate-800/30 rounded-2xl p-4">
          {state.gamePhase === "waiting" && (
            <div className="flex flex-col items-center gap-4">
              <span className="text-slate-400">Waiting for players...</span>
              {isHost && canStart && (
                <button
                  onClick={() => game.requestStartGame()}
                  className="px-6 py-3 bg-slate-600 hover:bg-slate-500 rounded-lg font-medium flex items-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Start Game
                </button>
              )}
              {isHost && !canStart && (
                <span className="text-sm text-slate-500">
                  Need at least 2 players to start
                </span>
              )}
            </div>
          )}

          {state.gamePhase === "playing" && (
            <div className="flex flex-col items-center gap-4">
              {/* Discard Pile */}
              <div className="flex items-center gap-6">
                {/* Draw Pile */}
                <button
                  onClick={handleDraw}
                  disabled={!isMyTurn}
                  className="relative w-20 h-28 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl border-2 border-slate-600 flex items-center justify-center hover:border-slate-400 transition-all disabled:opacity-50"
                >
                  <Layers className="w-8 h-8 text-slate-400" />
                  <span className="absolute bottom-1 text-xs text-slate-400">
                    {state.drawPile.length}
                  </span>
                </button>

                {/* Discard Pile Stack */}
                <button
                  onClick={() => setShowDiscardHistory(true)}
                  className="relative w-20 h-28 cursor-pointer hover:scale-105 transition-transform"
                  title="Click to view history"
                >
                  {state.discardPile.slice(-4).map((card, index, arr) => {
                    const isTop = index === arr.length - 1;
                    const offset = (arr.length - 1 - index) * 3;
                    const rotation = (index - Math.floor(arr.length / 2)) * 5;
                    return (
                      <div
                        key={card.id}
                        className={`absolute inset-0 ${
                          isTop ? "animate-[cardPlay_0.3s_ease-out]" : ""
                        }`}
                        style={{
                          transform: `translateX(${offset}px) translateY(${-offset}px) rotate(${rotation}deg)`,
                          zIndex: index,
                          opacity: isTop ? 1 : 0.7,
                        }}
                      >
                        <UnoCardDisplay card={card} size="large" />
                      </div>
                    );
                  })}
                  {/* Current color indicator */}
                  {topCard && (
                    <div
                      className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-white z-10 ${
                        COLOR_BG_CLASSES[state.currentColor]
                      }`}
                    />
                  )}
                  {/* Badge showing total count */}
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-slate-600 rounded-full text-[10px] flex items-center justify-center z-20">
                    {state.discardPile.length}
                  </div>
                </button>
              </div>

              {/* Pending Draw Indicator */}
              {state.pendingDraw > 0 && (
                <div className="text-lg font-bold text-red-400 animate-pulse">
                  +{state.pendingDraw} cards pending!
                </div>
              )}

              {/* Turn Indicator */}
              <div className="text-sm">
                {isMyTurn ? (
                  <span className="text-primary-400 font-medium">
                    Your Turn
                    {state.hasDrawn && " - Play drawn card or pass"}
                  </span>
                ) : (
                  <span className="text-slate-400">
                    {state.players[state.currentTurnIndex]?.username}'s Turn
                  </span>
                )}
              </div>

              {/* Direction indicator */}
              <div className="text-xs text-slate-500">
                Direction:{" "}
                {state.turnDirection === 1
                  ? "→ Clockwise"
                  : "← Counter-clockwise"}
              </div>
            </div>
          )}

          {state.gamePhase === "ended" && (
            <div className="flex flex-col items-center gap-4">
              <Sparkle className="w-12 h-12 text-yellow-400" />
              <span className="text-xl font-bold text-yellow-400">
                {state.players.find((p) => p.id === state.winner)?.username}{" "}
                Won!
              </span>
            </div>
          )}
        </div>

        {renderPlayerSlot(3)}
      </div>

      {/* Mobile: Play Area */}
      <div className="flex sm:hidden flex-1 flex-col items-center justify-center gap-2 bg-slate-800/30 rounded-xl p-2 min-h-[120px]">
        {state.gamePhase === "waiting" && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-slate-400 text-sm">
              Waiting for players...
            </span>
            {isHost && canStart && (
              <button
                onClick={() => game.requestStartGame()}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-medium flex items-center gap-2 text-sm"
              >
                <Play className="w-4 h-4" />
                Start
              </button>
            )}
          </div>
        )}

        {state.gamePhase === "playing" && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <button
                onClick={handleDraw}
                disabled={!isMyTurn}
                className="relative w-14 h-20 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg border-2 border-slate-600 flex items-center justify-center"
              >
                <Layers className="w-5 h-5 text-slate-400" />
                <span className="absolute bottom-0.5 text-[10px] text-slate-400">
                  {state.drawPile.length}
                </span>
              </button>

              {/* Discard Pile Stack - Mobile */}
              <button
                onClick={() => setShowDiscardHistory(true)}
                className="relative w-14 h-20"
              >
                {state.discardPile.slice(-3).map((card, index, arr) => {
                  const isTop = index === arr.length - 1;
                  const offset = (arr.length - 1 - index) * 2;
                  const rotation = (index - Math.floor(arr.length / 2)) * 4;
                  return (
                    <div
                      key={card.id}
                      className={`absolute inset-0 ${
                        isTop ? "animate-[cardPlay_0.3s_ease-out]" : ""
                      }`}
                      style={{
                        transform: `translateX(${offset}px) translateY(${-offset}px) rotate(${rotation}deg)`,
                        zIndex: index,
                        opacity: isTop ? 1 : 0.6,
                      }}
                    >
                      <UnoCardDisplay card={card} size="medium" />
                    </div>
                  );
                })}
                {/* Current color indicator */}
                {topCard && (
                  <div
                    className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border border-white z-10 ${
                      COLOR_BG_CLASSES[state.currentColor]
                    }`}
                  />
                )}
                {/* Badge showing total count */}
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-600 rounded-full text-[8px] flex items-center justify-center z-20">
                  {state.discardPile.length}
                </div>
              </button>
            </div>

            {state.pendingDraw > 0 && (
              <div className="text-sm font-bold text-red-400">
                +{state.pendingDraw} pending
              </div>
            )}

            <div className="text-xs">
              {isMyTurn ? (
                <span className="text-primary-400">Your Turn</span>
              ) : (
                <span className="text-slate-400">
                  {state.players[state.currentTurnIndex]?.username}'s Turn
                </span>
              )}
            </div>
          </div>
        )}

        {state.gamePhase === "ended" && (
          <div className="flex flex-col items-center gap-2">
            <Sparkle className="w-8 h-8 text-yellow-400" />
            <span className="text-base font-bold text-yellow-400">
              {state.players.find((p) => p.id === state.winner)?.username} Won!
            </span>
          </div>
        )}
      </div>

      {/* Bottom: My Slot and Hand */}
      <div className="flex flex-col items-center gap-2 sm:gap-4">
        <div className="hidden sm:block">{renderPlayerSlot(0)}</div>
        <div className="flex sm:hidden">{renderPlayerSlot(0, true)}</div>

        {/* My Hand */}
        {mySlot && state.gamePhase === "playing" && (
          <div className="w-full overflow-x-auto overflow-y-visible pt-4 pb-1">
            <div className="flex w-fit mx-auto px-4">
              {mySlot.hand.map((card, index) => {
                const canPlay = isMyTurn && game.canPlayCardCheck(card);
                return (
                  <button
                    key={card.id}
                    onClick={() => handleCardClick(card)}
                    disabled={!isMyTurn || !canPlay}
                    className={`transition-transform duration-150 ${
                      index > 0 ? "-ml-6 md:-ml-8" : ""
                    } ${
                      canPlay
                        ? "-translate-y-2 hover:-translate-y-3 cursor-pointer"
                        : "cursor-not-allowed"
                    }`}
                    style={{ zIndex: index }}
                  >
                    <UnoCardDisplay card={card} size="medium" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {state.gamePhase === "playing" && isMyTurn && (
          <div className="flex gap-2">
            {state.pendingDraw > 0 && (
              <button
                onClick={handleDraw}
                className="px-4 py-1.5 sm:px-6 sm:py-2 bg-red-600 hover:bg-red-500 rounded-lg font-medium flex items-center gap-1 sm:gap-2 text-sm"
              >
                <Layers className="w-4 h-4" />
                Draw {state.pendingDraw}
              </button>
            )}
            {state.hasDrawn && (
              <button
                onClick={handleDraw}
                className="px-4 py-1.5 sm:px-6 sm:py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-medium flex items-center gap-1 sm:gap-2 text-sm"
              >
                Pass
              </button>
            )}
            {mySlot && mySlot.hand.length <= 2 && !mySlot.calledUno && (
              <button
                onClick={handleCallUno}
                className="px-4 py-1.5 sm:px-6 sm:py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-bold flex items-center gap-1 sm:gap-2 text-sm animate-pulse"
              >
                <Hand className="w-4 h-4" />
                UNO!
              </button>
            )}
          </div>
        )}

        {/* Game Controls */}
        {state.gamePhase !== "waiting" && (
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (isHost && state.gamePhase === "playing") {
                  const confirmed = await useAlertStore
                    .getState()
                    .confirm(
                      "This will reset the current game and start fresh.",
                      "Start New Game?"
                    );
                  if (confirmed) {
                    game.requestNewGame();
                  }
                } else {
                  game.requestNewGame();
                }
              }}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs sm:text-sm flex items-center gap-1 sm:gap-2"
            >
              <RefreshCcw className="w-3 h-3 sm:w-4 sm:h-4" />
              New game
            </button>
          </div>
        )}
      </div>

      {/* Color Picker Modal */}
      {showColorPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6 shadow-xl">
            <h3 className="text-base sm:text-lg font-bold mb-4 text-center">
              Choose Color
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[Colors.RED, Colors.BLUE, Colors.GREEN, Colors.YELLOW].map(
                (color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl ${COLOR_BG_CLASSES[color]} hover:scale-110 transition-transform border-4 border-white/30`}
                  />
                )
              )}
            </div>
            <button
              onClick={() => {
                setShowColorPicker(false);
                setSelectedCard(null);
              }}
              className="mt-4 w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* New Game Request Modal */}
      {isHost && state.newGameRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-4 sm:p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">
              New Game Request
            </h3>
            <p className="text-slate-300 mb-4 sm:mb-6 text-sm sm:text-base">
              <span className="font-medium text-white">
                {state.newGameRequest.fromName}
              </span>{" "}
              wants to start a new game.
            </p>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => game.declineNewGame()}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium flex items-center justify-center gap-2 text-sm"
              >
                <X className="w-4 h-4" />
                Decline
              </button>
              <button
                onClick={() => game.acceptNewGame()}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium flex items-center justify-center gap-2 text-sm"
              >
                <Check className="w-4 h-4" />
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard History Modal */}
      {showDiscardHistory && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDiscardHistory(false)}
        >
          <div
            className="bg-slate-800 rounded-xl p-4 sm:p-6 max-w-md w-full max-h-[80vh] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base sm:text-lg font-bold">
                Discard Pile ({state.discardPile.length} cards)
              </h3>
              <button
                onClick={() => setShowDiscardHistory(false)}
                className="p-1 hover:bg-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] grid grid-cols-4 sm:grid-cols-5 gap-2">
              {[...state.discardPile].reverse().map((card, index) => (
                <div key={`${card.id}-${index}`} className="relative">
                  <UnoCardDisplay card={card} size="small" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// UNO Card Component
function UnoCardDisplay({
  card,
  size = "medium",
}: {
  card: UnoCard;
  size?: "small" | "medium" | "large";
}) {
  const sizeClasses = {
    small: "w-10 h-14",
    medium: "w-14 h-20 md:w-16 md:h-24",
    large: "w-20 h-28",
  };

  const textSizes = {
    small: "text-lg",
    medium: "text-xl md:text-2xl",
    large: "text-3xl",
  };

  const getCardContent = () => {
    if (card.type === CardType.NUMBER) {
      return card.value?.toString() || "0";
    }
    return TYPE_DISPLAY[card.type];
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${COLOR_BG_CLASSES[card.color]}
        rounded-lg md:rounded-xl shadow-lg
        border-2 border-white/30
        font-bold text-white
        ${textSizes[size]}
        shrink-0
        relative
      `}
      style={{
        textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
      }}
    >
      <span className="absolute top-0.5 left-1.5">{getCardContent()}</span>
    </div>
  );
}

// Player Slot Display
function PlayerSlotDisplay({
  slot,
  index,
  isCurrentTurn,
  isHost,
  gamePhase,
  onAddBot,
  onJoinSlot,
  onRemove,
  compact = false,
  isInGame,
}: {
  slot: PlayerSlot;
  index: number;
  isCurrentTurn: boolean;
  isHost: boolean;
  gamePhase: string;
  onAddBot: () => void;
  onJoinSlot: () => void;
  onRemove: () => void;
  compact?: boolean;
  isInGame: boolean;
}) {
  const isEmpty = slot.id === null;
  const canAddBot = isHost && gamePhase === "waiting";
  const canJoin = !isHost && gamePhase === "waiting" && !isInGame;

  return (
    <div
      className={`
        ${
          compact
            ? "p-2 min-w-[90px]"
            : "p-2 sm:p-3 min-w-[100px] sm:min-w-[120px]"
        }
        rounded-lg sm:rounded-xl transition-all border-2
        ${
          isCurrentTurn && gamePhase === "playing"
            ? "border-primary-600 bg-primary-500/10 animate-bounce"
            : "border-slate-700 bg-slate-800/50"
        }
        ${isEmpty ? "border-dashed" : ""}
      `}
    >
      {isEmpty ? (
        <div className="flex flex-col gap-1">
          <span className="text-slate-500 text-xs text-center">
            Slot {index + 1}
          </span>
          <div className="flex gap-1">
            {canAddBot && (
              <button
                onClick={onAddBot}
                className="flex-1 p-1 bg-slate-700 hover:bg-slate-600 rounded text-xs flex items-center justify-center"
                title="Add Bot"
              >
                <Bot className="w-5 h-5" />
              </button>
            )}
            {canJoin && (
              <button
                onClick={onJoinSlot}
                className="flex-1 p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs flex items-center justify-center gap-1"
                title="Join this slot"
              >
                <User className="w-4 h-4" />
                Join
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1">
            {slot.isBot && <Bot className="w-5 h-5 text-blue-400" />}
            {slot.isGuest && <User className="w-5 h-5 text-green-400" />}
            {slot.isHost && <Crown className="w-5 h-5 text-yellow-400" />}
            <span className="text-xs font-medium">{slot.username}</span>
            {canAddBot && (slot.isBot || slot.isGuest) && (
              <button
                onClick={onRemove}
                className="p-0.5 hover:bg-slate-700 rounded"
                title="Remove"
              >
                <X className="w-5 h-5 text-red-400" />
              </button>
            )}
          </div>
          {(gamePhase === "playing" || gamePhase === "ended") && (
            <span className="text-[10px] text-slate-400">
              {slot.hand.length} cards
            </span>
          )}
          {slot.calledUno && slot.hand.length <= 1 && (
            <span className="text-[10px] text-yellow-400 font-bold">UNO!</span>
          )}
        </div>
      )}
    </div>
  );
}
