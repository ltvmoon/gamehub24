import { useState, useMemo, useEffect, useRef } from "react";
import ExplodingKittens from "./ExplodingKittens";
import {
  type EKCard,
  EKCardType,
  EKGamePhase,
  type EKState,
  PENDING_ACTION_TIMEOUT,
  type PlayerSlot,
} from "./types";
import {
  Play,
  Bot,
  User,
  X,
  Crown,
  Sparkle,
  Layers,
  Hand,
  Eye,
  Swords,
  Gift,
  Bomb,
  BookOpen,
  RotateCcw,
  ChevronsRight,
  Ban,
  Check,
} from "lucide-react";
import { useUserStore } from "../../stores/userStore";
import useLanguage, { trans } from "../../stores/languageStore";
import type { GameUIProps } from "../types";
import { createPortal } from "react-dom";
import useGameState from "../../hooks/useGameState";
import SoundManager from "../../utils/SoundManager";
import usePrevious from "../../hooks/usePrevious";
import { useAlertStore } from "../../stores/alertStore";
import CommonFlyingCard, { isVisible } from "../../components/FlyingCard";
import { CARD_CONFIG, COMBO_CONFIG } from "./cards";

interface NopeWindowOverlayProps {
  state: EKState;
  game: ExplodingKittens;
  mySlot: PlayerSlot | null | undefined;
}

const NopeWindowOverlay: React.FC<NopeWindowOverlayProps> = ({
  state,
  game,
  mySlot,
}) => {
  const { ti } = useLanguage();
  const [timerNow, setTimerNow] = useState<number>(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerNow(Date.now());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  if (state.gamePhase !== EKGamePhase.NOPE_WINDOW || !state.pendingAction)
    return null;

  const { action, timerStart, nopeCount, nopeChain, entryTimestamp } =
    state.pendingAction;
  const targetPlayerId = (action as any).targetPlayerId;
  const targetPlayer = targetPlayerId
    ? state.players.find((p) => p.id === targetPlayerId)
    : null;

  const originalEntry = entryTimestamp
    ? state.discardHistory.find((e) => e.timestamp === entryTimestamp)
    : null;

  const timeLeft = Math.max(
    0,
    PENDING_ACTION_TIMEOUT - (timerNow - timerStart),
  );
  // Check if I have a nope card
  const myNopeCount =
    mySlot?.hand.filter((c: EKCard) => c && c[0] === EKCardType.NOPE).length ||
    0;
  const alreadyAllowed = state.pendingAction.responses[game.userId] === "ALLOW";

  const isBlocked = nopeCount % 2 === 1;
  const lastPlayerId = nopeChain[nopeChain.length - 1].playerId;
  const isWaitingForOthers = game.userId === lastPlayerId || myNopeCount === 0;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 backdrop-blur-xl">
      <div className="bg-slate-950 border-4 border-slate-800 rounded-[2.5rem] p-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-md w-full flex flex-col items-center gap-4 animate-in zoom-in duration-300 relative overflow-hidden">
        {/* Background Accent */}
        <div
          className={`absolute -top-24 -left-24 w-48 h-48 blur-[100px] opacity-20 rounded-full ${isBlocked ? "bg-red-500" : "bg-green-500"}`}
        />

        <div className="relative">
          <svg className="w-28 h-28 transform -rotate-90">
            <circle
              cx="56"
              cy="56"
              r="52"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="4"
              className="text-slate-800"
            />
            <circle
              cx="56"
              cy="56"
              r="52"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray={326.7}
              strokeDashoffset={326.7 * (1 - timeLeft / PENDING_ACTION_TIMEOUT)}
              strokeLinecap="round"
              className={`transition-all duration-100 ${timeLeft < 3000 ? "text-red-500" : "text-yellow-400"}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={`text-4xl font-black tabular-nums ${timeLeft < 3000 ? "text-red-500 animate-pulse" : "text-white"}`}
            >
              {(timeLeft / 1000).toFixed(1)}
            </span>
          </div>
        </div>

        <div className="text-center w-full">
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-4 shadow-lg ${
              isBlocked
                ? "bg-red-600/20 text-red-400 border-red-500/30"
                : "bg-green-600/20 text-green-400 border-green-500/30"
            }`}
          >
            {isBlocked ? (
              <X className="w-5 h-5 font-black" />
            ) : (
              <Sparkle className="w-5 h-5" />
            )}
            <span className="text-sm font-black uppercase tracking-[0.2em]">
              {isBlocked
                ? ti({ en: "BLOCKED!", vi: "ĐÃ CHẶN!" })
                : ti({ en: "PROGRESSING...", vi: "SẮP THỰC THI..." })}
            </span>
          </div>

          {/* {isWaitingForOthers && (
            <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50 shadow-inner w-full mb-2">
              <p className="text-slate-400 text-sm font-medium animate-pulse text-center">
                {ti({
                  en: "Waiting for other players to react...",
                  vi: "Đang chờ người khác phản ứng...",
                })}
              </p>
            </div>
          )} */}
        </div>

        {/* Action Chain */}
        <div className="w-full flex flex-col gap-2 max-h-60 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 p-2">
          {nopeChain.map((item, i) => {
            const p = state.players.find((sp) => sp.id === item.playerId);
            const cardType = item.cardType;
            const isFirst = i === 0;
            const card = CARD_CONFIG[cardType];
            const description =
              card.isCombo && originalEntry?.cards.length
                ? COMBO_CONFIG[originalEntry.cards.length]?.description
                : card.description;

            return (
              <div
                key={i}
                className={`flex flex-wrap gap-2 p-3 rounded-2xl transition-all border ${
                  i === nopeChain.length - 1
                    ? "bg-slate-800/80 border-slate-600 shadow-lg z-10 scale-[1.02]"
                    : "bg-slate-900/30 border-slate-800/50 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="text-sm font-bold text-white truncate max-w-[100px] @md:max-w-none">
                        {p?.username || "Unknown"}
                      </span>
                      {isFirst && targetPlayer && (
                        <>
                          <ChevronsRight className="w-4 h-4 text-slate-500 shrink-0" />
                          <span className="text-sm font-bold text-blue-400 truncate max-w-[100px] @md:max-w-none">
                            {targetPlayer.username}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-black tracking-tighter my-1">
                      {ti(description)}
                    </span>
                  </div>
                  {i === nopeChain.length - 1 && (
                    <div className="absolute top-2 right-2 shrink-0 w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {isFirst &&
                  originalEntry &&
                  originalEntry.cards.length > 0 ? (
                    originalEntry.cards.map((c, idx) => (
                      <div key={idx} className="shrink-0">
                        {renderInlineCard(c[0])}
                      </div>
                    ))
                  ) : (
                    <div className="shrink-0">{renderInlineCard(cardType)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!isWaitingForOthers ? (
          <div className="flex flex-col w-full gap-4 pt-2">
            <button
              onClick={() => game.requestRespondNope("NOPE")}
              disabled={
                state.players.find((p) => p.id === game.userId)?.isExploded
              }
              className={`
                group relative w-full py-5 rounded-2xl font-black text-2xl flex items-center justify-center gap-3 transition-all
                bg-red-600 hover:bg-red-500 text-white shadow-[0_10px_30px_rgba(220,38,38,0.4)] hover:-translate-y-1 active:scale-95
              `}
            >
              <Ban className={`w-8 h-8 animate-wiggle`} />
              <div className="flex flex-col items-start leading-none">
                <span className="uppercase tracking-widest leading-none">
                  {ti({ en: "NOPE!", vi: "CHẶN!" })}
                </span>
                <span className="text-xs opacity-70 mt-1">
                  {ti({ en: "USE 1 CARD", vi: "DÙNG 1 LÁ" })} (
                  {ti({ en: myNopeCount + " left", vi: "còn " + myNopeCount })})
                </span>
              </div>
            </button>

            <button
              onClick={() => game.requestRespondNope("ALLOW")}
              disabled={
                alreadyAllowed ||
                state.players.find((p) => p.id === game.userId)?.isExploded
              }
              className={`
                w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                ${
                  alreadyAllowed
                    ? "bg-slate-900 text-green-500/50 cursor-default border border-green-500/20"
                    : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                }
              `}
            >
              {alreadyAllowed ? (
                <>
                  <div className="flex gap-1 mr-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce"></div>
                  </div>
                  {ti({ en: "READY", vi: "XONG" })}
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  {ti({ en: "SKIP / ALLOW", vi: "BỎ QUA / ĐỒNG Ý" })}
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="w-full h-24 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>
              </div>
              <span className="text-md text-slate-400 animate-pulse">
                {ti({
                  en: "Waiting for other players to react...",
                  vi: "Chờ người chơi khác phản ứng...",
                })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const renderInlineCard = (type: EKCardType) => {
  const config = CARD_CONFIG[type];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md mx-1 align-baseline bg-slate-700`}
    >
      <span
        className={`${config.bgColor} ${config.borderColor} p-1.5 rounded-full`}
      >
        <Icon className={`w-4 h-4 ${config.iconColor}`} />
      </span>
      <span
        className={`text-xs font-black uppercase tracking-tighter ${config.textColor}`}
      >
        {trans(config.name)}
      </span>
    </span>
  );
};

export default function ExplodingKittensUI({ game: baseGame }: GameUIProps) {
  const game = baseGame as ExplodingKittens;

  const { confirm: showConfirm } = useAlertStore();

  const [state] = useGameState(game);
  const [showRules, setShowRules] = useState(false);
  const { username } = useUserStore();
  const { ti, ts } = useLanguage();
  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);
  const [localFutureCards, setLocalFutureCards] = useState<EKCard[] | null>(
    null,
  );
  const [favorTargetingIndex, setFavorTargetingIndex] = useState<number | null>(
    null,
  );
  const [comboTargetingIndices, setComboTargetingIndices] = useState<
    number[] | null
  >(null);
  const [comboPhase, setComboPhase] = useState<"target" | "card_type" | null>(
    null,
  );
  const [comboTargetPlayerId, setComboTargetPlayerId] = useState<string | null>(
    null,
  );
  const [showDiscardHistory, setShowDiscardHistory] = useState(false);
  const [toasts, setToasts] = useState<
    {
      id: number;
      message: React.ReactNode;
      type: "success" | "error";
      icon: any;
      isExiting?: boolean;
    }[]
  >([]);
  const toastIdRef = useRef(0);

  const players = state.players.filter((p) => p.id);

  // Flying card animation state
  const [flyingCard, setFlyingCard] = useState<{
    card?: EKCard;
    fromPlayerIndex: number; // Index in arrangedPlayers (Target for toHand, Source for toDiscard)
    sourcePlayerIndex?: number; // Optional source index for player-to-player transfers
    direction: "toDiscard" | "toHand" | "playerToPlayer";
    hidden?: boolean;
  } | null>(null);

  // Hide the newest card in discard pile while animation is playing
  const [hideTopDiscard, setHideTopDiscard] = useState(false);
  // Hide drawn cards in hand while animation is playing (by ID)
  const [hiddenCardIds, setHiddenCardIds] = useState<number[]>([]);

  // Refs for tracking positions
  const desktopSlotRefs = useRef<(HTMLDivElement | null)[]>(
    Array(5).fill(null),
  );
  const mobileSlotRefs = useRef<(HTMLDivElement | null)[]>(Array(5).fill(null));
  const drawPileRef = useRef<HTMLButtonElement>(null);
  const discardPileRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const myHandRef = useRef<HTMLDivElement>(null);

  // Track previous lengths for detection
  const prevDiscardLengthRef = useRef(state.discardPile.length);
  const prevHandLengthsRef = useRef(state.players.map((p) => p.hand.length));
  const prevTurnIndexRef = useRef(state.currentTurnIndex);

  const myIndex = state.players.findIndex((p) => p.id === game.userId);
  const mySlot = myIndex >= 0 ? state.players[myIndex] : null;
  const isMyTurn = state.currentTurnIndex === myIndex;
  const isHost = game.isHost;

  const sortedHand = useMemo(() => {
    if (!mySlot) return [];
    return mySlot.hand
      .map((card, originalIndex) => ({ card, originalIndex }))
      .sort((a, b) => {
        // null case
        if (!a.card) return 1;
        if (!b.card) return -1;
        // Sort by card type
        if (a.card[0] !== b.card[0]) return a.card[0] - b.card[0];
        // Then by card id (for stability)
        return a.card[1] - b.card[1];
      });
  }, [mySlot?.hand]);

  usePrevious(state.currentTurnIndex, (prev, _current) => {
    if (state.gamePhase !== EKGamePhase.PLAYING) return;
    if (prev !== null) SoundManager.playTurnSwitch(isMyTurn);

    console.log(prev, _current);
  });

  useEffect(() => {
    if (
      state.lastAction &&
      !state.lastAction.isNoped &&
      state.lastAction.cardType === EKCardType.SEE_THE_FUTURE &&
      state.lastAction.playerId === game.userId
    ) {
      setLocalFutureCards(state.drawPile.slice(-3).reverse());
    }

    // Toast logic for action results
    if (state.lastAction) {
      const { action, playerId, isNoped, cardType } = state.lastAction;
      const player = state.players.find((p) => p.id === playerId);
      const initiatorName = player?.username || "Unknown";

      let actionName = "";
      let Icon: any = Sparkle;

      if (action.type === "PLAY_CARD") {
        const config = CARD_CONFIG[cardType || EKCardType.EXPLODING_KITTEN];
        actionName = ts(config.name);
        Icon = config.icon;
      } else if (action.type === "PLAY_COMBO") {
        actionName =
          (action as any).cardIndices.length === 2
            ? ts({ en: "Pair Combo", vi: "Combo Đôi" })
            : ts({ en: "Triplet Combo", vi: "Combo Ba" });
        Icon = Layers;
      } else if (action.type === "DRAW_CARD") {
        actionName = ts({ en: "Draw a card", vi: "Rút một lá bài" });
        Icon = Hand;
      } else if (action.type === "DEFUSE") {
        actionName = ts({ en: "Defuse the bomb", vi: "Gỡ bom" });
        Icon = Sparkle;
      }

      const id = ++toastIdRef.current;
      const message = isNoped
        ? ts({
            en: `${initiatorName}'s ${actionName} was BLOCKED!`,
            vi: `${actionName} của ${initiatorName} đã bị CHẶN!`,
          })
        : action.type === "DRAW_CARD"
          ? ts({
              en: `${initiatorName} drew a card`,
              vi: `${initiatorName} đã rút một lá bài`,
            })
          : ts({
              en: `${initiatorName} executed ${actionName}`,
              vi: `${initiatorName} đã thực hiện ${actionName}`,
            });

      setToasts((prev) => [
        ...prev,
        { id, message, type: isNoped ? "error" : "success", icon: Icon },
      ]);

      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t)),
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 500);
      }, 5000);
    }
  }, [state.lastAction, game.userId]);

  const animationElements = useMemo(() => {
    if (!flyingCard || !containerRef.current) return null;
    const { fromPlayerIndex, direction, sourcePlayerIndex } = flyingCard;

    let sourceEl: HTMLElement | null = null;
    let targetEl: HTMLElement | null = null;

    const getPlayerEl = (idx: number) => {
      if (idx === 0 && isVisible(myHandRef.current)) return myHandRef.current;
      if (isVisible(desktopSlotRefs.current?.[idx]))
        return desktopSlotRefs.current?.[idx];
      if (isVisible(mobileSlotRefs.current?.[idx]))
        return mobileSlotRefs.current?.[idx];
      return (
        (idx === 0
          ? myHandRef.current
          : desktopSlotRefs.current?.[idx] || mobileSlotRefs.current?.[idx]) ||
        null
      );
    };

    if (direction === "toDiscard") {
      sourceEl = getPlayerEl(fromPlayerIndex);
      targetEl = discardPileRef.current;
    } else if (direction === "toHand") {
      sourceEl = drawPileRef.current;
      targetEl = getPlayerEl(fromPlayerIndex);
    } else if (
      direction === "playerToPlayer" &&
      sourcePlayerIndex !== undefined
    ) {
      sourceEl = getPlayerEl(sourcePlayerIndex);
      targetEl = getPlayerEl(fromPlayerIndex);
    }

    if (!sourceEl || !targetEl) return null;

    return {
      sourceRect: sourceEl.getBoundingClientRect(),
      targetRect: targetEl.getBoundingClientRect(),
    };
  }, [flyingCard]);

  const arrangedPlayers = useMemo(() => {
    const result = [];
    const baseIndex = myIndex >= 0 ? myIndex : 0;
    for (let i = 0; i < 5; i++) {
      const actualIndex = (baseIndex + i) % 5;
      result.push({ slot: state.players[actualIndex], actualIndex });
    }
    return result;
  }, [state.players, myIndex]);

  useEffect(() => {
    return game.onUpdate((newState) => {
      // 1. Detect if a card was played (discard pile grew)
      if (
        newState.discardPile.length > prevDiscardLengthRef.current &&
        newState.gamePhase === EKGamePhase.PLAYING
      ) {
        const newCard = newState.discardPile[newState.discardPile.length - 1];
        const fromPlayerIndex = prevTurnIndexRef.current;
        const arrangedFromIndex = arrangedPlayers.findIndex(
          (p) => p.actualIndex === fromPlayerIndex,
        );

        setHideTopDiscard(true);
        setFlyingCard({
          card: newCard,
          fromPlayerIndex: arrangedFromIndex,
          direction: "toDiscard",
        });

        setTimeout(() => {
          setHideTopDiscard(false);
          setFlyingCard(null);
        }, 400);
      }

      // 2. Detect if cards were drawn (hand grew)
      newState.players.forEach((player, actualIndex) => {
        const prevLength = prevHandLengthsRef.current[actualIndex] || 0;
        const newLength = player.hand.length;

        if (
          newLength > prevLength &&
          newState.gamePhase === EKGamePhase.PLAYING
        ) {
          const isMe = actualIndex === myIndex;
          const arrangedToIndex = arrangedPlayers.findIndex(
            (p) => p.actualIndex === actualIndex,
          );

          // Detect if this was a transfer from another player (Favor)
          let sourcePlayerIndex: number | undefined = undefined;
          if (
            newState.gamePhase === EKGamePhase.PLAYING ||
            newState.gamePhase === EKGamePhase.FAVOR_GIVING
          ) {
            const giverIndex = newState.players.findIndex((p, i) => {
              const prevHandSize = prevHandLengthsRef.current[i] || 0;
              return p.hand.length < prevHandSize;
            });

            if (giverIndex !== -1 && giverIndex !== actualIndex) {
              sourcePlayerIndex = arrangedPlayers.findIndex(
                (p) => p.actualIndex === giverIndex,
              );
            }
          }

          if (isMe) {
            // Determine which cards are new
            // They are added to the end of the array on the server/state update
            const diff = newLength - prevLength;
            if (diff > 0) {
              const newCards = player.hand.slice(-diff);
              const newIds = newCards.map((c) => c[1]);
              setHiddenCardIds(newIds);
            }
          }

          setFlyingCard({
            card: isMe ? player.hand[newLength - 1] : undefined,
            fromPlayerIndex: arrangedToIndex,
            sourcePlayerIndex: sourcePlayerIndex,
            direction:
              sourcePlayerIndex !== undefined ? "playerToPlayer" : "toHand",
            hidden: !isMe,
          });

          setTimeout(() => {
            if (isMe) setHiddenCardIds([]);
            setFlyingCard(null);
          }, 400);
        }
      });

      // Update refs
      prevDiscardLengthRef.current = newState.discardPile.length;
      prevHandLengthsRef.current = newState.players.map((p) => p.hand.length);
      prevTurnIndexRef.current = newState.currentTurnIndex;
    });
  }, [game, myIndex, arrangedPlayers]);

  const handleDraw = () => {
    if (isMyTurn && state.gamePhase === EKGamePhase.PLAYING) {
      game.requestDrawCard();
    }
  };

  const handleCardClick = (cardIndex: number) => {
    if (!mySlot) return;
    const card = mySlot.hand[cardIndex];
    if (!card) return;

    if (state.gamePhase === EKGamePhase.PLAYING) {
      if (selectedCardIndices.includes(cardIndex)) {
        setSelectedCardIndices(
          selectedCardIndices.filter((i) => i !== cardIndex),
        );
      } else {
        // Auto-select cats for convenience
        // SAFEGUARD: Check if card is defined
        if (
          card &&
          card[0] >= EKCardType.CAT_1 &&
          card[0] <= EKCardType.CAT_5
        ) {
          const matchingIndices = mySlot.hand
            .map((c, i) => (c && c[0] === card[0] ? i : -1))
            .filter((i) => i !== -1);
          const newSelection = Array.from(
            new Set([...selectedCardIndices, ...matchingIndices]),
          );
          setSelectedCardIndices(newSelection);
        } else {
          setSelectedCardIndices([...selectedCardIndices, cardIndex]);
        }
      }
    } else if (state.gamePhase === EKGamePhase.DEFUSING) {
      if (card[0] === EKCardType.DEFUSE) {
        game.requestDefuse();
        setSelectedCardIndices([]);
      }
    }
  };

  const handlePlaySelected = () => {
    if (selectedCardIndices.length === 0) return;

    if (selectedCardIndices.length === 1) {
      const index = selectedCardIndices[0];
      const card = mySlot!.hand[index];
      if (card[0] === EKCardType.FAVOR) {
        setFavorTargetingIndex(index);
      } else {
        game.requestPlayCard(index);
      }
    } else if (
      selectedCardIndices.length === 2 ||
      selectedCardIndices.length === 3
    ) {
      // Combo logic
      const cards = selectedCardIndices.map((i) => mySlot!.hand[i]);
      if (cards.every((c) => c[0] === cards[0][0])) {
        setComboTargetingIndices(selectedCardIndices);
        setComboPhase("target");
      }
    }
    setSelectedCardIndices([]);
  };

  const getTurnHint = () => {
    if (mySlot?.isExploded) {
      return ti({
        en: "You exploded! You are out of the game.",
        vi: "Bạn đã Nổ tung! Bạn đã bị loại khỏi trò chơi.",
      });
    }

    if (!isMyTurn)
      return ti({
        en: `Waiting for ${state.players[state.currentTurnIndex]?.username}...`,
        vi: `Đang đợi ${state.players[state.currentTurnIndex]?.username}...`,
      });

    if (state.gamePhase === EKGamePhase.PLAYING) {
      if (selectedCardIndices.length > 0) {
        return ti({
          en: "Click 'PLAY' to use selected cards, or click to SELECT MORE.",
          vi: "Bấm 'ĐÁNH' để dùng các lá đã chọn, hoặc CHỌN THÊM.",
        });
      }
      return ti({
        en: "Your turn! PLAY cards, or DRAW to end your turn.",
        vi: "Tới lượt bạn! ĐÁNH BÀI, hoặc RÚT BÀI để kết thúc lượt.",
      });
    }

    if (state.gamePhase === EKGamePhase.DEFUSING) {
      return ti({
        en: "QUICK! Use a DEFUSE card or you'll explode!",
        vi: "NHANH LÊN! Dùng lá GỠ BOM nếu không bạn sẽ nổ tung!",
      });
    }

    if (state.gamePhase === EKGamePhase.INSERTING_KITTEN) {
      return ti({
        en: "Choose where to put the kitten back in the deck.",
        vi: "Chọn vị trí để đặt lại mèo nổ vào xấp bài.",
      });
    }

    if (state.gamePhase === EKGamePhase.NOPE_WINDOW) {
      return ti({
        en: "Someone played a card! Can anyone NOPE it?",
        vi: "Có người vừa đánh bài! Có ai muốn KHÔNG! (NOPE) không?",
      });
    }

    return "";
  };

  const renderCard = (
    card: EKCard | undefined,
    isSelectable = false,
    onClick?: () => void,
    size: "small" | "medium" | "large" = "medium",
    showCornerIcon = false,
  ) => {
    // If card is missing, show a generic back
    if (!card) {
      const sizeClasses = {
        small: "w-12 h-16",
        medium: "w-20 h-28",
        large: "w-28 h-40",
      };
      return (
        <div
          className={`${sizeClasses[size]} rounded-lg border-2 border-slate-700 bg-slate-800 flex items-center justify-center p-2 shadow-lg`}
        >
          <div className="w-full h-full rounded bg-slate-700/50 flex items-center justify-center">
            <Bomb className="w-1/2 h-1/2 text-slate-600 opacity-20" />
          </div>
        </div>
      );
    }

    const [type] = card;
    const config = CARD_CONFIG[type];
    if (!config) return null;
    const Icon = config.icon;

    const sizeClasses = {
      small: "w-12 h-16 text-[10px]",
      medium: "w-20 h-28 text-xs",
      large: "w-28 h-40 text-sm",
    };

    return (
      <div
        onClick={onClick}
        className={`${sizeClasses[size]} relative rounded-lg border-2 ${config.borderColor} ${config.bgColor} flex flex-col items-center justify-center p-2 shadow-lg transition-all select-none ${isSelectable ? "cursor-pointer hover:-translate-y-2 hover:shadow-xl" : ""}`}
      >
        {/* Corner Icon for identification during overlap */}
        {showCornerIcon && (
          <div className="absolute top-1 left-1 opacity-80">
            <Icon
              className={`${size === "small" ? "w-3 h-3" : "w-5 h-5"} ${config.iconColor}`}
            />
          </div>
        )}
        <Icon
          className={`${size === "small" ? "w-4 h-4" : "w-8 h-8"} ${config.iconColor} mb-1`}
        />
        <span
          className={`text-center font-bold ${config.textColor} ${size === "small" ? "text-[8px]" : "text-[10px] @md:text-xs"} leading-tight`}
        >
          {ti(config.name)}
        </span>
        {size === "large" && (
          <span
            className={`text-xs text-center mt-1 opacity-80 ${config.textColor}`}
          >
            {ti(config.description || { en: "", vi: "" })}
          </span>
        )}
      </div>
    );
  };

  const renderPlayCardButton = () => {
    if (!mySlot) return null;
    const count = selectedCardIndices.length;
    const cards = selectedCardIndices
      .map((i) => mySlot.hand[i])
      .filter((c) => !!c); // Filter out undefined
    if (cards.length === 0) return null;

    const allSame = cards.every((c) => c[0] === cards[0][0]);
    const topCardType = cards[0][0];

    let isValid = false;
    let errorLabel: React.ReactNode = "";

    if (count === 1) {
      if (topCardType === EKCardType.NOPE) {
        errorLabel = ti({
          en: "CANNOT PLAY ALONE",
          vi: "CHỈ DÙNG ĐỂ CHẶN",
        });
      } else if (topCardType === EKCardType.DEFUSE) {
        errorLabel = ti({
          en: "DEFUSE ONLY ON BOMB",
          vi: "CHỈ DÙNG KHI CÓ BOM",
        });
      } else if (topCardType >= EKCardType.CAT_1) {
        errorLabel = ti({
          en: "COMBO ONLY",
          vi: "CẦN COMBO",
        });
      } else {
        isValid = true;
      }
    } else if (count === 2 || count === 3) {
      if (allSame) {
        isValid = true;
      } else {
        errorLabel = ti({
          en: "MUST BE SAME TYPE",
          vi: "PHẢI CÙNG LOẠI",
        });
      }
    } else {
      errorLabel = ti({
        en: "INVALID SELECTION",
        vi: "CHỌN KHÔNG HỢP LỆ",
      });
    }

    if (isValid && !isMyTurn) {
      isValid = false;
      errorLabel = ti({
        en: "WAIT YOUR TURN",
        vi: "ĐỢI TỚI LƯỢT",
      });
    }

    return (
      <button
        onClick={() => isValid && handlePlaySelected()}
        disabled={!isValid}
        className={`
                    font-black py-2 px-6 rounded-full shadow-2xl border-2 flex items-center gap-2 transition-all w-max max-w-[90vw]
                    ${
                      !isValid
                        ? "bg-slate-700/80 text-slate-400 cursor-not-allowed border-slate-600 backdrop-blur-md"
                        : "bg-green-600 hover:bg-green-500 text-white border-white animate-in zoom-in-50 duration-200"
                    }
                  `}
      >
        {isValid ? (
          <Play className="w-5 h-5 fill-current" />
        ) : (
          <X className="w-5 h-5" />
        )}
        <span className="uppercase">
          {isValid
            ? count > 1
              ? ti({ en: `PLAY COMBO (${count})`, vi: `DÙNG COMBO (${count})` })
              : ti({ en: "PLAY CARD", vi: "ĐÁNH BÀI" })
            : errorLabel}
        </span>
      </button>
    );
  };

  const renderHand = () => {
    if (!mySlot) return null;
    return (
      <div className="w-full relative mt-4">
        {/* Hand container with overlapping cards */}
        <div
          ref={myHandRef}
          className="flex justify-center h-32 @md:h-44 relative"
        >
          {sortedHand.map(({ card, originalIndex }, index) => {
            if (!card) {
              // should never happen
              debugger;
              return null;
            }

            if (hiddenCardIds.includes(card[1])) {
              // This card is currently flying in, don't show it yet
              return null;
            }

            const isSelected = selectedCardIndices.includes(originalIndex);
            const isSelectable =
              state.gamePhase === EKGamePhase.PLAYING ||
              (state.gamePhase === EKGamePhase.DEFUSING &&
                card[0] === EKCardType.DEFUSE);

            // Don't show newly drawn cards while animating
            // We need to check if the *original* index corresponds to a newly drawn card
            // For now, simple length check might be enough or we need more complex tracking if strictly required.
            // Using logic: if this card's original index is high enough to be "new"
            const isHidden = false; // logic handled by hiddenCardIds above return null

            // Calculate overlap and rotation
            const totalCards = mySlot.hand.length;
            const mid = (totalCards - 1) / 2;
            const offset = index - mid;
            const rotation = offset * 2; // Subtle fan effect

            // Dynamic scaling and overlap based on hand size
            const scale = totalCards > 12 ? 0.75 : totalCards > 8 ? 0.85 : 1;
            const baseShift = totalCards > 12 ? 15 : totalCards > 8 ? 25 : 35;
            const xShift = offset * baseShift;

            return (
              <div
                key={`${card[1]}-${index}`}
                className={`absolute transition-all duration-300 ease-out ${isHidden ? "opacity-0 pointer-events-none" : ""}`}
                style={{
                  transform: `translateX(${xShift}px) rotate(${rotation}deg) translateY(${isSelected ? -30 : 0}px) scale(${scale})`,
                  zIndex: isSelected ? 30 : index + 10,
                }}
              >
                {renderCard(
                  card,
                  isSelectable,
                  () => {
                    if (!isSelectable) return;
                    handleCardClick(originalIndex);
                  },
                  isSelected ? "large" : "medium",
                  totalCards > 1 && !isSelected,
                )}
              </div>
            );
          })}
        </div>

        {/* Global PLAY button for selected cards */}
        {selectedCardIndices.length > 0 && (
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-50">
            {renderPlayCardButton()}
          </div>
        )}
      </div>
    );
  };

  const renderPlayerSlot = (
    index: number,
    targetRefArray?: React.MutableRefObject<(HTMLDivElement | null)[]>,
  ) => {
    const player = arrangedPlayers[index];
    const slot = player.slot;
    const isCurrent = state.currentTurnIndex === player.actualIndex;
    const isEmpty = slot.id === null;

    return (
      <div
        key={player.actualIndex}
        ref={(el) => {
          if (targetRefArray) targetRefArray.current[index] = el;
        }}
        className={`
          p-2 @md:p-3 min-w-[100px] @md:min-w-[120px] rounded-xl transition-all border-2
          ${
            isCurrent && state.gamePhase === EKGamePhase.PLAYING
              ? "border-primary-600 bg-primary-500/10 animate-bounce"
              : "border-slate-700 bg-slate-800/50"
          }
          ${isEmpty ? "border-dashed" : ""}
        `}
      >
        {isEmpty ? (
          <div className="flex flex-col gap-1">
            <span className="text-slate-500 text-[10px] text-center uppercase font-medium">
              Slot {player.actualIndex + 1}
            </span>
            <div className="flex gap-1 mt-1">
              {isHost && state.gamePhase === EKGamePhase.WAITING && (
                <button
                  onClick={() => game.requestAddBot(player.actualIndex)}
                  className="flex-1 p-1 bg-slate-700 hover:bg-slate-600 rounded text-xs flex items-center justify-center"
                  title="Add Bot"
                >
                  <Bot className="w-5 h-5" />
                </button>
              )}
              {!isHost &&
                state.gamePhase === EKGamePhase.WAITING &&
                !mySlot && (
                  <button
                    onClick={() =>
                      game.requestJoinSlot(player.actualIndex, username)
                    }
                    className="flex-1 p-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] flex items-center justify-center gap-1"
                  >
                    <User className="w-4 h-4" />
                    Join
                  </button>
                )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-0.5">
            <div className="flex items-center gap-1">
              {slot.isBot && <Bot className="w-5 h-5 text-blue-400" />}
              {slot.isHost && <Crown className="w-5 h-5 text-yellow-400" />}
              <span
                className={`text-xs font-medium ${slot.isExploded ? "text-red-400" : "text-slate-200"}`}
              >
                {slot.username}
              </span>
              {isHost &&
                state.gamePhase === EKGamePhase.WAITING &&
                slot.isBot && (
                  <button
                    onClick={() => game.requestRemovePlayer(player.actualIndex)}
                    className="p-0.5 hover:bg-slate-700 rounded ml-1"
                  >
                    <X className="w-5 h-5 text-red-400" />
                  </button>
                )}
            </div>

            {state.gamePhase !== EKGamePhase.WAITING && (
              <div className="flex items-center gap-2">
                {slot.isExploded ? (
                  <Bomb className="w-4 h-4 text-red-500 animate-pulse" />
                ) : (
                  <div className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400 font-bold">
                      {slot.hand.length}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderNopeWindow = () => {
    return <NopeWindowOverlay state={state} game={game} mySlot={mySlot} />;
  };

  const renderFutureCards = () => {
    if (!localFutureCards) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl max-w-md w-full relative">
          <button
            onClick={() => setLocalFutureCards(null)}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-slate-400 z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Eye className="w-6 h-6 text-blue-400" />
            {ti({ en: "See The Future", vi: "Nhìn thấu tương lai" })}
          </h3>
          <p className="text-slate-400 mb-6 text-sm">
            {ti({
              en: "Top 3 cards in the draw pile:",
              vi: "3 lá bài trên cùng của xấp bài:",
            })}
          </p>
          <div className="flex justify-center gap-2">
            {localFutureCards.map((card, i) => (
              <div
                key={i}
                className="animate-in fade-in slide-in-from-bottom-4 duration-300"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {renderCard(card)}
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setLocalFutureCards(null)}
              className="px-8 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm font-bold transition-all"
            >
              {ti({ en: "GOT IT", vi: "ĐÃ HIỂU" })}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderKittenInsertion = () => {
    if (state.gamePhase !== EKGamePhase.INSERTING_KITTEN || !isMyTurn)
      return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl max-w-md w-full">
          <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
            <Bomb className="w-6 h-6" />
            {ti({ en: "Re-insert Kitten", vi: "Đặt lại Bomb mèo" })}
          </h3>
          <p className="text-slate-400 mb-6 text-sm">
            {ti({
              en: "Choose where to hide the kitten back in the deck:",
              vi: "Chọn vị trí để đặt lại mèo nổ vào xấp bài:",
            })}
          </p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => game.requestInsertKitten(0)}
              className="py-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 text-sm font-medium transition-colors"
            >
              {ti({ en: "Top of deck", vi: "Trên cùng" })}
            </button>
            <button
              onClick={() =>
                game.requestInsertKitten(Math.floor(state.drawPile.length / 2))
              }
              className="py-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 text-sm font-medium transition-colors"
            >
              {ti({ en: "Middle", vi: "Ở giữa" })}
            </button>
            <button
              onClick={() => game.requestInsertKitten(state.drawPile.length)}
              className="py-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 text-sm font-medium transition-colors"
            >
              {ti({ en: "Bottom", vi: "Dưới cùng" })}
            </button>
            <button
              onClick={() =>
                game.requestInsertKitten(
                  Math.floor(Math.random() * (state.drawPile.length + 1)),
                )
              }
              className="py-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 text-sm font-medium transition-colors"
            >
              {ti({ en: "Random", vi: "Ngẫu nhiên" })}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderFavorTargetSelection = () => {
    if (favorTargetingIndex === null) return null;

    const targets = state.players.filter(
      (p) => p.id !== null && p.id !== game.userId && !p.isExploded,
    );

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl max-w-md w-full">
          <h3 className="text-xl font-bold text-pink-400 mb-4 flex items-center gap-2">
            <Gift className="w-6 h-6" />
            {ti({ en: "Choose Player", vi: "Chọn người chơi" })}
          </h3>
          <p className="text-slate-400 mb-6 text-sm">
            {ti({
              en: "Pick a player to give you a card:",
              vi: "Chọn một người chơi để lấy 1 lá bài từ họ:",
            })}
          </p>
          <div className="grid grid-cols-1 gap-3 mb-6">
            {targets.map((target) => (
              <button
                key={target.id}
                onClick={() => {
                  game.requestPlayCard(favorTargetingIndex, target.id!);
                  setFavorTargetingIndex(null);
                }}
                className="flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-slate-400" />
                  <span className="text-white font-bold">
                    {target.username}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Hand className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-400 text-xs font-bold">
                    {target.hand.length}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setFavorTargetingIndex(null)}
            className="w-full py-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            {ti({ en: "Cancel", vi: "Hủy" })}
          </button>
        </div>
      </div>
    );
  };

  const renderFavorGiving = () => {
    if (
      state.gamePhase !== EKGamePhase.FAVOR_GIVING ||
      (state.favorFrom !== game.userId && state.favorTo !== game.userId)
    )
      return null;

    const isGiver = state.favorFrom === game.userId;
    const otherPlayerName =
      state.players.find(
        (p) => p.id === (isGiver ? state.favorTo : state.favorFrom),
      )?.username || "Unknown";
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl max-w-lg w-full">
          {isGiver ? (
            <>
              <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
                <Gift className="w-6 h-6" />
                {ti({ en: "Give a Favor", vi: "Ban ơn" })}
              </h3>
              <p className="text-slate-400 mb-6 text-sm">
                {ti({
                  en: `${otherPlayerName} requested a card. Pick one to give:`,
                  vi: `${otherPlayerName} yêu cầu 1 lá bài. Chọn 1 lá để đưa:`,
                })}
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-h-60 overflow-y-auto p-2">
                {mySlot?.hand.map((card, idx) => (
                  <div key={idx} className="shrink-0">
                    {renderCard(
                      card,
                      true,
                      () => game.requestGiveFavor(idx),
                      "medium",
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-6 py-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
                <Gift className="absolute inset-0 m-auto w-6 h-6 text-blue-400 animate-pulse" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">
                  {ti({ en: "FAVOR PENDING", vi: "ĐANG CHỜ BAN ƠN" })}
                </h3>
                <p className="text-slate-400 text-sm">
                  {ti({
                    en: `Waiting for ${otherPlayerName} to pick a card for you...`,
                    vi: `Đang chờ ${otherPlayerName} chọn bài cho bạn...`,
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDefusing = () => {
    if (state.gamePhase !== EKGamePhase.DEFUSING || !isMyTurn) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-900 border-4 border-red-500 rounded-2xl p-8 shadow-2xl max-w-md w-full animate-pulse">
          <h3 className="text-3xl font-black text-red-500 mb-6 text-center tracking-widest">
            {ti({ en: "EXPLODING!", vi: "MÈO NỔ!" })}
          </h3>
          <div className="flex justify-center mb-8">
            <Bomb className="w-24 h-24 text-red-500 animate-bounce" />
          </div>
          <p className="text-white text-center mb-8 font-bold">
            {ti({
              en: "You drew an Exploding Kitten! Use a Defuse now!",
              vi: "Bạn đã bốc phải Mèo Nổ! Hãy dùng Gỡ Bom ngay!",
            })}
          </p>
          <div className="flex justify-center">
            <button
              onClick={() => game.requestDefuse()}
              className="px-12 py-4 bg-green-600 hover:bg-green-500 text-white rounded-full font-black text-xl shadow-lg transform hover:scale-105 transition-all"
            >
              {ti({ en: "DEFUSE!", vi: "GỠ BOM!" })}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDiscardHistory = () => {
    if (!showDiscardHistory) return null;
    return createPortal(
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in duration-300">
          <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-6 h-6 text-slate-400" />
              {ti({ en: "Discard History", vi: "Lịch sử đánh bài" })}
              <span className="text-sm font-normal text-slate-500 ml-2">
                ({state.discardPile.length} {ti({ en: "cards", vi: "lá" })})
              </span>
            </h3>
            <button
              onClick={() => setShowDiscardHistory(false)}
              className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-4 @md:p-6 overflow-y-auto custom-scrollbar bg-slate-950/30">
            <div className="flex flex-col gap-2">
              {[...state.discardHistory].reverse().map((entry, i) => {
                const player = state.players.find(
                  (p) => p.id === entry.playerId,
                );
                const targetPlayer = entry.targetPlayerId
                  ? state.players.find((p) => p.id === entry.targetPlayerId)
                  : null;
                const isMe = player?.id === game.userId;
                return (
                  <div
                    key={`${entry.timestamp}-${i}`}
                    className={`flex flex-col gap-3 p-4 bg-slate-800/40 rounded-2xl border ${entry.isNoped ? "border-red-500/30 bg-red-500/5" : "border-slate-700/50"} animate-in fade-in slide-in-from-bottom-2`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-black text-white uppercase">
                          {player?.username?.[0] || "?"}
                        </div>
                        <span className="text-sm font-black text-white leading-tight flex items-center gap-2 flex-wrap">
                          <span>
                            {player?.username || "Unknown"}
                            {isMe && ts({ en: " (You)", vi: " (Bạn)" })}
                          </span>
                          {targetPlayer && (
                            <>
                              <ChevronsRight className="w-4 h-4 text-slate-500" />
                              <span className="text-blue-400">
                                {targetPlayer.username}
                                {targetPlayer.id === game.userId &&
                                  ts({ en: " (You)", vi: " (Bạn)" })}
                              </span>
                            </>
                          )}
                          {entry.cards.length === 0 && (
                            <span className="text-slate-500 text-xs font-medium lowercase">
                              — {ti({ en: "drew a card", vi: "vừa rút bài" })}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                            {new Date(entry.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </span>
                      </div>
                      {entry.isNoped !== undefined && (
                        <div
                          className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-sm border ${entry.isNoped ? "bg-red-600/20 text-red-500 border-red-500/30" : "bg-green-600/40 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.3)]"}`}
                        >
                          {entry.isNoped ? (
                            <>
                              <X className="w-3 h-3" />
                              {ti({ en: "Blocked", vi: "Bị chặn" })}
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              {ti({ en: "Executed", vi: "Thực thi" })}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {entry.cards.length > 0 && (
                      <div className="flex flex-col gap-3">
                        {entry.cards.length > 1 ? (
                          <div className="flex items-start gap-4 p-3 bg-slate-900/50 rounded-xl border border-slate-700/50 shadow-inner">
                            <div className="relative shrink-0">
                              <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${CARD_CONFIG[entry.cards[0][0]].borderColor} ${CARD_CONFIG[entry.cards[0][0]].bgColor} shadow-lg`}
                              >
                                <Layers className="w-4 h-4 text-white" />
                              </div>
                              <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-slate-900 text-[10px] font-black px-1.5 py-0.5 rounded-md border-2 border-slate-900 shadow-sm">
                                x{entry.cards.length}
                              </div>
                            </div>
                            <div className="flex flex-col justify-center">
                              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-1">
                                {ts(COMBO_CONFIG[entry.cards.length]?.name)}{" "}
                                {ts(CARD_CONFIG[entry.cards?.[0]?.[0]]?.name)}
                              </h4>
                              <span className="text-xs text-slate-400 font-medium leading-relaxed">
                                {ts(
                                  COMBO_CONFIG[entry.cards.length]?.description,
                                )}
                              </span>
                            </div>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2 items-center">
                          <div className="flex flex-wrap gap-1.5">
                            {entry.cards.map((card, j) => (
                              <div key={j}>
                                {renderCard(
                                  card,
                                  false,
                                  undefined,
                                  entry.cards.length > 2 ? "small" : "medium",
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Show full chain if expanded or just detailed info */}
                    {entry.nopeChain && entry.nopeChain.length > 1 && (
                      <div className="mt-1 pt-2 border-t border-slate-700/30 flex flex-col gap-1.5">
                        {entry.nopeChain.map((item, idx) => {
                          if (idx === 0) return null; // Original action is already shown
                          const p = state.players.find(
                            (sp) => sp.id === item.playerId,
                          );
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-[10px]"
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${idx % 2 === 1 ? "bg-red-500" : "bg-green-500"}`}
                              />
                              <span className="font-bold text-slate-300">
                                {p?.username || "Unknown"}
                              </span>
                              <span className="text-slate-500 uppercase font-black">
                                {idx % 2 === 1
                                  ? ts({ en: "Noped", vi: "Chặn" })
                                  : ts({ en: "Re-Noped", vi: "Bỏ chặn" })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {state.discardHistory.length === 0 && (
              <div className="text-center py-20 text-slate-600 italic">
                {ti({
                  en: "No cards played yet",
                  vi: "Chưa có lá bài nào được đánh",
                })}
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body,
    );
  };

  const renderComboTargetSelection = () => {
    if (comboPhase !== "target" || !comboTargetingIndices) return null;
    return (
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Swords className="w-6 h-6 text-red-500" />
              {ts({ en: "Choose Target", vi: "Chọn Đối Thủ" })}
            </h3>
            <button
              onClick={() => {
                setComboPhase(null);
                setComboTargetingIndices(null);
              }}
              className="p-1 hover:bg-white/10 rounded-full text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-md text-slate-400 mb-6 italic">
            {ti({
              en: (
                <>
                  Select a player to{" "}
                  <span className="text-green-500 font-black">
                    STEAL A CARD
                  </span>{" "}
                  from using your {comboTargetingIndices.length}-card COMBO
                </>
              ),
              vi: (
                <>
                  Chọn một người chơi để{" "}
                  <span className="text-green-500 font-black">
                    CƯỚP 1 LÁ BÀI
                  </span>{" "}
                  bằng COMBO {comboTargetingIndices.length} LÁ của bạn.
                </>
              ),
            })}
          </p>
          <div className="space-y-3">
            {players
              .filter((p) => p.id && p.id !== game.userId && !p.isExploded)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setComboTargetPlayerId(p.id!);
                    if (comboTargetingIndices.length === 2) {
                      game.requestPlayCombo(comboTargetingIndices, p.id!);
                      setComboPhase(null);
                      setComboTargetingIndices(null);
                    } else {
                      setComboPhase("card_type");
                    }
                  }}
                  className="w-full p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center justify-between transition-all hover:scale-[1.02]"
                >
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-400" />
                    <span className="font-bold text-white">{p.username}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase font-black">
                    <Layers className="w-3 h-3" />
                    {p.hand.length}
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  };

  const renderComboCardTypeSelection = () => {
    if (
      comboPhase !== "card_type" ||
      !comboTargetingIndices ||
      !comboTargetPlayerId
    )
      return null;

    // Most common cards to ask for
    const askableTypes = [
      EKCardType.DEFUSE,
      EKCardType.ATTACK,
      EKCardType.SKIP,
      EKCardType.FAVOR,
      EKCardType.SHUFFLE,
      EKCardType.SEE_THE_FUTURE,
      EKCardType.NOPE,
    ];

    return (
      <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Gift className="w-6 h-6 text-yellow-500" />
              {ts({ en: "Name a Card", vi: "Đọc Tên Lá Bài" })}
            </h3>
            <button
              onClick={() => setComboPhase("target")}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-full text-xs text-slate-400"
            >
              {ts({ en: "Back", vi: "Quay lại" })}
            </button>
          </div>
          <p className="text-md text-slate-400 mb-6 italic">
            {ti({
              en: (
                <>
                  If the target player has this card, you{" "}
                  <span className="text-green-500 font-black">STEAL IT!</span>{" "}
                  {comboTargetingIndices.length}-card COMBO
                </>
              ),
              vi: (
                <>
                  Nếu đối thủ có lá bài này, bạn sẽ{" "}
                  <span className="text-green-500 font-black">LẤY ĐƯỢC</span>{" "}
                  nó! COMBO {comboTargetingIndices.length} LÁ của bạn.
                </>
              ),
            })}
          </p>
          <div className="grid grid-cols-2 @md:grid-cols-3 gap-3">
            {askableTypes.map((type) => {
              const config = CARD_CONFIG[type];
              const Icon = config.icon;
              return (
                <button
                  key={type}
                  onClick={() => {
                    game.requestPlayCombo(
                      comboTargetingIndices,
                      comboTargetPlayerId,
                      type,
                    );
                    setComboPhase(null);
                    setComboTargetingIndices(null);
                    setComboTargetPlayerId(null);
                  }}
                  className={`p-3 rounded-xl border-2 ${config.borderColor} ${config.bgColor} flex flex-col items-center gap-2 transition-all hover:scale-105 shadow-lg group`}
                >
                  <Icon
                    className={`w-8 h-8 ${config.iconColor} group-hover:scale-110 transition-transform`}
                  />
                  <span
                    className={`text-[10px] font-black uppercase text-center ${config.textColor}`}
                  >
                    {ts(config.name)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderGameRules = () => {
    return (
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full shadow-2xl relative">
          <div className="flex justify-between p-4 pr-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-yellow-500" />
              {ti({
                en: "Game Rules: Exploding Kittens",
                vi: "Luật Chơi: Mèo Nổ",
              })}
            </h2>
            <button
              onClick={() => setShowRules(false)}
              className="p-2 hover:bg-white/10 rounded-full text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 pt-0 space-y-4 text-slate-300 leading-relaxed max-h-[80vh] overflow-y-auto">
            <p>
              {ti({
                en: "Exploding Kittens is a highly-strategic, kitty-powered version of Russian Roulette.",
                vi: "Mèo Nổ (Exploding Kittens) là một board game thẻ bài chiến thuật pha lẫn may rủi cực kỳ hài hước.",
              })}
            </p>

            <h3 className="text-lg font-bold text-yellow-400">
              {ti({ en: "1. Goal", vi: "1. Mục tiêu" })}
            </h3>
            <p>
              {ti({
                en: "Be the last player alive by avoiding the Exploding Kittens. If you draw one without a Defuse, you are out!",
                vi: "Sống sót đến cuối cùng bằng cách tránh hoặc vô hiệu hóa các lá bài Mèo Nổ. Nếu bạn rút phải lá Mèo Nổ mà không có lá Gỡ bom (Defuse), bạn sẽ bị loại ngay lập tức.",
              })}
            </p>

            <h3 className="text-lg font-bold text-yellow-400">
              {ti({ en: "2. Setup", vi: "2. Thiết lập" })}
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                {ti({
                  en: "Each player starts with 1 Defuse and 6 random cards.",
                  vi: "Mỗi người nhận 1 lá Gỡ bom và 6 lá bài ngẫu nhiên khác.",
                })}
              </li>
              <li>
                {ti({
                  en: "The deck contains (Players - 1) Exploding Kittens.",
                  vi: "Bỏ số lá Mèo Nổ ít hơn số người chơi 1 lá vào chồng bài rút.",
                })}
              </li>
            </ul>

            <h3 className="text-lg font-bold text-yellow-400">
              {ti({ en: "3. How to Play", vi: "3. Cách chơi" })}
            </h3>
            <p>
              {ti({
                en: "Your turn has two phases:",
                vi: "Mỗi lượt chơi của bạn gồm 2 giai đoạn chính:",
              })}
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>
                  {ti({
                    en: "Action (Optional):",
                    vi: "Hành động (Tùy chọn):",
                  })}
                </strong>{" "}
                {ti({
                  en: "Play as many cards as you want from your hand.",
                  vi: "Bạn có thể đánh xuống bao nhiêu lá bài tùy thích để sử dụng chức năng của chúng, hoặc không đánh lá nào.",
                })}
              </li>
              <li>
                <strong>
                  {ti({
                    en: "End Turn (Mandatory):",
                    vi: "Kết thúc lượt (Bắt buộc):",
                  })}
                </strong>{" "}
                {ti({
                  en: "Draw one card from the deck. If it's not a kitten, you're safe!",
                  vi: "Rút một lá từ chồng bài chung. Nếu đó không phải Mèo Nổ, lượt của bạn kết thúc an toàn.",
                })}
              </li>
            </ul>

            <h3 className="text-lg font-bold text-yellow-400">
              {ti({ en: "4. Combos", vi: "4. Combo" })}
            </h3>
            <p>
              {ti({
                en: "Select multiple cards in your hand and click 'PLAY COMBO'.",
                vi: "Chọn nhiều lá trong tay và nhấn 'DÙNG COMBO'.",
              })}
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>{ti({ en: "Pairs:", vi: "Cặp Đôi:" })}</strong>{" "}
                {ti({
                  en: "Play 2 cards of the same type to steal a random card from another player.",
                  vi: "Đánh 2 lá cùng loại để cướp 1 lá ngẫu nhiên từ người chơi khác.",
                })}
              </li>
              <li>
                <strong>{ti({ en: "Triplets:", vi: "Bộ Ba:" })}</strong>{" "}
                {ti({
                  en: "Play 3 cards of the same type to name a card. If the target has it, you steal it.",
                  vi: "Đánh 3 lá cùng loại và đọc tên 1 lá. Nếu đối thủ có lá đó, bạn sẽ lấy được nó.",
                })}
              </li>
            </ul>

            <h3 className="text-lg font-bold text-yellow-400">
              {ti({ en: "5. Cards", vi: "5. Lá bài" })}
            </h3>
            <div className="space-y-2">
              {Object.entries(CARD_CONFIG).map(([type, card]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className={`${card.bgColor} ${card.borderColor} p-2 rounded-full`}
                  >
                    <card.icon
                      className={`w-6 h-6 ${card.iconColor} ${card.icon}`}
                    />
                  </div>
                  <div>
                    <p className="font-bold text-yellow-400">{ti(card.name)}</p>
                    <p className="text-sm text-slate-300">
                      {ti(card.description)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tips */}
            <h3 className="text-lg font-bold text-yellow-400 mb-4">
              {ti({ en: "6. Tips", vi: "6. Mẹo" })}
            </h3>
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-bold text-white text-lg">
                    {ti({
                      en: "1. Strategic Card Management",
                      vi: "1. Quản lý lá bài chiến lược",
                    })}
                  </h4>
                </div>
                <div className="space-y-4 pl-2 border-l-2 border-slate-700">
                  <p className="text-sm leading-relaxed">
                    <strong className="text-yellow-400">
                      {ti({
                        en: "Keep Defuse until the end:",
                        vi: "Giữ lá Gỡ bom đến cuối:",
                      })}
                    </strong>{" "}
                    {ti({
                      en: "Don't rush to use your",
                      vi: "Đừng vội dùng lá",
                    })}
                    {renderInlineCard(EKCardType.DEFUSE)}
                    {ti({
                      en: "in early turns. It's the most valuable insurance when the deck gets thin.",
                      vi: "ở những lượt đầu nếu không cần thiết, đây là bảo hiểm quý giá nhất về sau khi xấp bài đã mỏng.",
                    })}
                  </p>

                  <p className="text-sm leading-relaxed">
                    <strong className="text-yellow-400">
                      {ti({
                        en: "Use Combos effectively:",
                        vi: "Sử dụng Combo:",
                      })}
                    </strong>{" "}
                    {ti({
                      en: "Collect matching cat cards to steal a",
                      vi: "Gom các lá mèo thường (cùng màu) để cướp lá bài",
                    })}
                    {renderInlineCard(EKCardType.DEFUSE)}
                    {ti({
                      en: "or other important function cards from other players.",
                      vi: "hoặc các lá bài chức năng quan trọng khác từ tay người khác.",
                    })}
                  </p>

                  <p className="text-sm leading-relaxed">
                    <strong className="text-yellow-400">
                      {ti({
                        en: "Master the Nope card:",
                        vi: "Tận dụng lá Không (Nope):",
                      })}
                    </strong>{" "}
                    {ti({
                      en: "Keep your",
                      vi: "Hãy giữ lá",
                    })}
                    {renderInlineCard(EKCardType.NOPE)}
                    {ti({
                      en: "to block incoming attacks or when someone tries to steal from you.",
                      vi: "để chặn các hành động tấn công hoặc khi người khác định cướp bài của bạn.",
                    })}
                  </p>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-bold text-white text-lg">
                    {ti({
                      en: "2. Deck Management",
                      vi: "2. Kiểm soát xấp bài",
                    })}
                  </h4>
                </div>
                <div className="space-y-4 pl-2 border-l-2 border-slate-700">
                  <p className="text-sm leading-relaxed">
                    <strong className="text-yellow-400">
                      {ti({
                        en: "Combine See the Future + Shuffle/Skip:",
                        vi: "Kết hợp Xem trước + Xáo bài/Bỏ lượt:",
                      })}
                    </strong>{" "}
                    {ti({
                      en: "If you use",
                      vi: "Nếu bạn sử dụng",
                    })}
                    {renderInlineCard(EKCardType.SEE_THE_FUTURE)}
                    {ti({
                      en: "and see a Kitten on top, use",
                      vi: "và thấy Mèo nổ ở trên cùng, hãy dùng",
                    })}
                    {renderInlineCard(EKCardType.SHUFFLE)}
                    {ti({
                      en: "to change its position, or",
                      vi: "để đổi vị trí, hoặc",
                    })}
                    {renderInlineCard(EKCardType.SKIP)}
                    {ti({
                      en: "to end your turn safely without drawing.",
                      vi: "để kết thúc lượt an toàn mà không cần rút bài.",
                    })}
                  </p>

                  <p className="text-sm leading-relaxed">
                    <strong className="text-yellow-400">
                      {ti({
                        en: "Mind Games with Defuse:",
                        vi: "Chơi khăm bằng Gỡ bom:",
                      })}
                    </strong>{" "}
                    {ti({
                      en: "When you use a",
                      vi: "Khi bạn sử dụng",
                    })}
                    {renderInlineCard(EKCardType.DEFUSE)}
                    {ti({
                      en: "to put back an Exploding Kitten, do it secretly. Place it on top or in a position where you want your opponent to draw it.",
                      vi: "để đặt lại lá Mèo nổ, hãy thực hiện bí mật, đặt ngay lên đầu hoặc vị trí mà bạn muốn đối thủ rút phải.",
                    })}
                  </p>

                  <p className="text-sm leading-relaxed">
                    <strong className="text-yellow-400">
                      {ti({
                        en: "Track Defuses:",
                        vi: "Theo dõi Gỡ bom:",
                      })}
                    </strong>{" "}
                    {ti({
                      en: "Keep track of how many",
                      vi: "Hãy theo dõi số lượng lá",
                    })}
                    {renderInlineCard(EKCardType.DEFUSE)}
                    {ti({
                      en: "cards have been used to predict when the bomb will reappear in the deck.",
                      vi: "đã được sử dụng để dự đoán khi nào bom sẽ xuất hiện trở lại trong xấp bài.",
                    })}
                  </p>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-bold text-white text-lg">
                    {ti({
                      en: "3. Offense and Defense",
                      vi: "3. Tấn công và phòng thủ",
                    })}
                  </h4>
                </div>
                <div className="space-y-4 pl-2 border-l-2 border-slate-700">
                  <p className="text-sm leading-relaxed">
                    <strong className="text-yellow-400">
                      {ti({
                        en: "Use Attack wisely:",
                        vi: "Sử dụng Tấn công hợp lý:",
                      })}
                    </strong>{" "}
                    {ti({
                      en: "Use an",
                      vi: "Sử dụng lá",
                    })}
                    {renderInlineCard(EKCardType.ATTACK)}
                    {ti({
                      en: "to put pressure on the next player, especially when you suspect or know the top card is an Exploding Kitten.",
                      vi: "để đẩy áp lực cho người tiếp theo, đặc biệt khi bạn biết chắc hoặc nghi ngờ lá trên cùng là Mèo nổ.",
                    })}
                  </p>

                  <p className="text-sm leading-relaxed">
                    <strong className="text-yellow-400">
                      {ti({
                        en: "Shuffle when in doubt:",
                        vi: "Tận dụng Xáo bài khi hoang mang:",
                      })}
                    </strong>{" "}
                    {ti({
                      en: "If you feel endangered and don't have a way to see the deck, use",
                      vi: "Nếu bạn cảm thấy nguy hiểm mà không có cách nào xem trước bài, hãy dùng",
                    })}
                    {renderInlineCard(EKCardType.SHUFFLE)}
                    {ti({
                      en: "to try your luck and escape from a potential Kitten.",
                      vi: "để thử vận may và thoát khỏi nguy cơ bốc phải Mèo nổ.",
                    })}
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  };
  const renderToasts = () => {
    if (toasts.length === 0) return null;
    return (
      <div className="flex flex-col gap-2 pointer-events-none w-full justify-center items-center px-4">
        {toasts.map((toast) => {
          const Icon = toast.icon;
          return (
            <div
              key={toast.id}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-2xl border-2 shadow-2xl transition-all duration-500
                ${
                  toast.isExiting
                    ? "opacity-0 -translate-y-10 scale-95"
                    : "animate-in slide-in-from-top-10 fade-in duration-500"
                }
                ${
                  toast.type === "success"
                    ? "bg-slate-900/90 border-green-500/50 text-green-400 backdrop-blur-md"
                    : "bg-slate-900/90 border-red-500/50 text-red-400 backdrop-blur-md"
                }
              `}
            >
              <div
                className={`p-2 rounded-xl ${toast.type === "success" ? "bg-green-500/20" : "bg-red-500/20"}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-black uppercase tracking-tight leading-tight">
                {toast.message}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col h-full p-2 @md:p-4 gap-2 @md:gap-4 overflow-hidden bg-slate-950 rounded-xl pb-16!"
    >
      {/* Top area */}
      <div className="flex justify-center gap-2 @md:gap-8">
        {/* Mobile: 1, 2, 3, 4 | PC: 2, 3 */}
        <div className="flex @md:hidden flex-wrap justify-center gap-2 max-w-full px-2">
          {renderPlayerSlot(1, mobileSlotRefs)}
          {renderPlayerSlot(2, mobileSlotRefs)}
          {renderPlayerSlot(3, mobileSlotRefs)}
          {renderPlayerSlot(4, mobileSlotRefs)}
        </div>
        <div className="hidden @md:flex gap-8">
          {renderPlayerSlot(2, desktopSlotRefs)}
          {renderPlayerSlot(3, desktopSlotRefs)}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-between gap-4">
        {/* Left: PC only */}
        <div className="hidden @md:block">
          {renderPlayerSlot(1, desktopSlotRefs)}
        </div>

        {/* Center area */}
        <div className="flex-1 flex flex-col items-center gap-6 justify-center">
          <div className="flex gap-4 @md:gap-8 items-center justify-center">
            {/* Draw Pile */}
            <button
              ref={drawPileRef}
              onClick={handleDraw}
              disabled={!isMyTurn || state.gamePhase !== EKGamePhase.PLAYING}
              className="relative w-20 h-28 @md:w-32 @md:h-44 rounded-xl bg-linear-to-br from-slate-800 to-slate-900 border-2 border-slate-700 shadow-2xl flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              <div className="bg-red-600 p-1.5 @md:p-2 rounded-lg mb-2">
                <Layers className="w-6 h-6 @md:w-8 @md:h-8 text-white" />
              </div>
              <span className="text-[10px] @md:text-xs font-bold text-slate-400 uppercase tracking-widest">
                {ti({ en: "DRAW", vi: "RÚT BÀI" })}
              </span>
              <span className="absolute -top-2 -right-2 text-white text-[10px] @md:text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold bg-slate-600">
                {state.drawPile.length}
              </span>
            </button>

            {/* Discard Pile */}
            <div
              ref={discardPileRef}
              onClick={() => setShowDiscardHistory(true)}
              className="relative w-20 h-28 @md:w-32 @md:h-44 rounded-xl bg-slate-900/50 border-2 border-dashed border-slate-700 flex items-center justify-center cursor-pointer hover:border-slate-500 transition-colors group"
            >
              <div className="absolute inset-x-0 -bottom-4 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap">
                  {ti({ en: "CLICK TO VIEW", vi: "BẤM ĐỂ XEM" })}
                </span>
              </div>
              {state.discardPile.length > 0 ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  {state.discardPile.slice(-3).map((card, i) => {
                    const isLast = i === state.discardPile.slice(-3).length - 1;
                    if (isLast && hideTopDiscard) return null;
                    return (
                      <div
                        key={`${card[1]}-${i}`}
                        className="absolute transition-all"
                        style={{ transform: `rotate(${(i - 1) * 8}deg)` }}
                      >
                        {renderCard(card, false, undefined, "medium")}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[10px] text-center text-slate-600 font-bold uppercase tracking-widest">
                  {ti({ en: "DISCARD", vi: "BÀI ĐÃ ĐÁNH" })}
                </span>
              )}
            </div>
          </div>

          {state.attackStack > 1 && (
            <div className="flex items-center gap-2 bg-orange-500/20 text-yellow-400 px-3 py-1 rounded-full border border-orange-500/30 animate-pulse">
              <Swords className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">
                {state.attackStack}{" "}
                {ti({ en: "TURNS REMAINING", vi: "LƯỢT CÒN LẠI" })}
              </span>
            </div>
          )}
        </div>

        {/* Right: PC only */}
        <div className="hidden @md:block">
          {renderPlayerSlot(4, desktopSlotRefs)}
        </div>
      </div>

      {renderToasts()}

      {/* Bottom area: My Slot and Hand */}
      <div className="flex flex-col items-center gap-2 @md:gap-4 bg-slate-900/80 backdrop-blur-md rounded-3xl p-3 @md:p-4 border-t border-slate-800 shadow-2xl z-10">
        {/* Hint Area */}
        <div className="text-xs text-center font-bold text-slate-400 bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-700/50 animate-pulse tracking-wider">
          {getTurnHint()}
        </div>

        <div className="flex items-center gap-4">
          {myIndex >= 0 && (
            <>
              <div className="hidden @md:block">
                {renderPlayerSlot(0, desktopSlotRefs)}
              </div>
              <div className="flex @md:hidden">
                {renderPlayerSlot(0, mobileSlotRefs)}
              </div>
            </>
          )}
        </div>

        {state.gamePhase !== EKGamePhase.WAITING &&
          state.gamePhase !== EKGamePhase.ENDED &&
          renderHand()}

        {state.gamePhase === EKGamePhase.WAITING && isHost && (
          <button
            onClick={() => game.requestStartGame()}
            disabled={players.length < 2}
            className="px-12 py-3 bg-green-600 hover:bg-green-500 text-white rounded-full font-bold flex items-center gap-2 shadow-xl transition-all hover:scale-105 disabled:bg-slate-700 disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5" />
            {players.length < 2
              ? ti({ en: "NEED 2+ PLAYERS/BOTS", vi: "CẦN 2+ NGƯỜI CHƠI/BOT" })
              : ti({ en: "START GAME", vi: "BẮT ĐẦU" })}
          </button>
        )}

        {isHost && state.gamePhase !== EKGamePhase.WAITING && (
          <button
            onClick={async () => {
              if (
                await showConfirm(
                  ts({
                    en: "Current game will be lost. Continue?",
                    vi: "Tiến trình hiện tại sẽ bị mất. Tiếp tục?",
                  }),
                  ts({ vi: "Chơi lại?", en: "New game?" }),
                )
              )
                game.requestNewGame();
            }}
            className="px-4 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-full flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            {ti({ en: "New Game", vi: "Chơi lại" })}
          </button>
        )}
      </div>

      {/* Modals & Overlays */}
      {renderDefusing()}
      {renderKittenInsertion()}
      {renderFavorGiving()}
      {renderFavorTargetSelection()}
      {renderFutureCards()}
      {renderNopeWindow()}
      {renderDiscardHistory()}
      {renderComboTargetSelection()}
      {renderComboCardTypeSelection()}

      {/* Exploded Overlay for Local Player */}
      {mySlot?.isExploded && state.gamePhase !== EKGamePhase.ENDED && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none">
          <div className="bg-red-900/80 border-2 border-red-500 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in duration-300 pointer-events-auto">
            <Bomb className="w-16 h-16 text-white animate-pulse" />
            <div className="text-center">
              <h3 className="text-2xl font-black text-white uppercase italic">
                {ti({ en: "YOU EXPLODED!", vi: "BẠN ĐÃ NỔ TUNG!" })}
              </h3>
              <p className="text-red-200 font-bold">
                {ti({
                  en: "Better luck next time!",
                  vi: "Chúc bạn may mắn lần sau!",
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Winner Overlay */}
      {state.gamePhase === EKGamePhase.ENDED && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="flex flex-col items-center gap-8 animate-in zoom-in duration-500">
            <div className="relative">
              <Sparkle className="w-32 h-32 text-yellow-400 animate-spin-slow" />
              {/* <Crown className="absolute inset-0 m-auto w-16 h-16 text-yellow-400" /> */}
            </div>
            <div className="text-center">
              <h2 className="text-5xl font-black text-white mb-2 italic">
                {state.players.find((p) => p.id === state.winner)?.username}
              </h2>
              <p className="text-2xl text-yellow-400 font-bold tracking-widest uppercase">
                {ti({ en: "VICTORIOUS!", vi: "CHIẾN THẮNG!" })}
              </p>
            </div>
            {game.isHost ? (
              <button
                onClick={() => game.requestNewGame()}
                className="px-8 py-3 bg-white text-slate-900 rounded-full font-black hover:bg-yellow-400 transition-colors cursor-pointer"
              >
                {ti({ en: "PLAY AGAIN", vi: "CHƠI LẠI" })}
              </button>
            ) : (
              <p className="text-md text-slate-400">
                {ti({ en: "Waiting for host..", vi: "Đang chờ chủ phòng.." })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Flying Card Animation */}
      <CommonFlyingCard
        containerRef={containerRef}
        sourceRect={animationElements?.sourceRect}
        targetRect={animationElements?.targetRect}
        isOpen={!!flyingCard}
      >
        <div className="w-20 h-28 relative">
          {flyingCard?.card &&
            renderCard(flyingCard.card, false, undefined, "medium")}
          {flyingCard?.hidden && (
            <div className="absolute inset-0 bg-slate-800 rounded-lg border-2 border-slate-600 flex items-center justify-center">
              <Layers className="w-8 h-8 text-slate-500" />
            </div>
          )}
        </div>
      </CommonFlyingCard>

      {/* Rules Button */}
      <button
        onClick={() => setShowRules(true)}
        className="fixed bottom-4 right-4 p-3 bg-slate-700 hover:bg-slate-600 rounded-full text-yellow-400 transition-colors z-40 shadow-lg border border-slate-500"
        title="Rules"
      >
        <BookOpen size={24} />
      </button>
      {showRules && createPortal(renderGameRules(), document.body)}
    </div>
  );
}
