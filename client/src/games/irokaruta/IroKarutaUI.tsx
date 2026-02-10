import { useState, useCallback, useEffect, useMemo, memo } from "react";
import type { GameUIProps } from "../types";
import useGameState from "../../hooks/useGameState";
import useLanguage from "../../stores/languageStore";
import IroKaruta from "./IroKaruta";
import type { IroKarutaState, RGB, ColorCard } from "./types";
import {
  Play,
  RotateCcw,
  ChevronRight,
  Trophy,
  Clock,
  X,
  Loader2,
} from "lucide-react";
import {
  blendCardsWithOpacity,
  colorSimilarity,
  formatTime,
  rgbaStr,
  rgbStr,
} from "./helper";
import { useAlertStore } from "../../stores/alertStore";

// ============================================================
// Elapsed timer — isolated to avoid re-rendering the entire UI
// ============================================================
const ElapsedTimer = memo(function ElapsedTimer({
  startTime,
}: {
  startTime: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(interval);
  }, [startTime]);
  return (
    <span className="text-xs font-mono text-text-muted flex items-center gap-1">
      <Clock className="w-3 h-3" />
      {formatTime(elapsed)}
    </span>
  );
});

// ============================================================
// Main UI
// ============================================================

export default function IroKarutaUI({
  game: baseGame,
  currentUserId,
}: GameUIProps) {
  const game = baseGame as IroKaruta;
  const { confirm: showConfirm } = useAlertStore();
  const [state] = useGameState<IroKarutaState>(game);
  const { ts } = useLanguage();
  const userId = currentUserId || "";
  const isHost = game.isHost;

  // My data
  const myData = state.playerData[userId];

  // Cards in my zone (no useMemo — proxy state mutates arrays in place)
  const cardsInZone: ColorCard[] =
    (myData?.cardsInZone
      ?.map((id) => state.availableCards.find((c) => c.id === id))
      ?.filter(Boolean) as ColorCard[]) || [];

  // Blended preview color (opacity-aware)
  const previewColor: RGB = useMemo(() => {
    if (cardsInZone.length === 0) return [255, 255, 255];
    return blendCardsWithOpacity(cardsInZone);
  }, [cardsInZone]);

  // Similarity computed locally — no need to sync via socket
  const similarity = useMemo(() => {
    if (cardsInZone.length === 0) return 0;
    return colorSimilarity(previewColor, state.targetColor);
  }, [previewColor, state.targetColor]);

  // ──────────── Actions ────────────

  const addCard = useCallback(
    (cardId: number) => {
      game.makeAction({ type: "DROP_CARD", playerId: userId, cardId });
    },
    [game, userId],
  );

  const removeCard = useCallback(
    (cardId: number) => {
      game.makeAction({ type: "REMOVE_CARD", playerId: userId, cardId });
    },
    [game, userId],
  );

  const startGame = useCallback(
    () => game.makeAction({ type: "START_GAME" }),
    [game],
  );
  const nextRound = useCallback(
    () => game.makeAction({ type: "NEXT_ROUND" }),
    [game],
  );
  const resetGame = useCallback(async () => {
    if (
      await showConfirm(
        ts({
          en: "Current progress will be lost",
          vi: "Tiến trình hiện tại sẽ mất",
        }),
        ts({ en: "New Game?", vi: "Game mới?" }),
      )
    )
      game.makeAction({ type: "RESET_GAME" });
  }, [game]);

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────

  // ─── Waiting phase ───
  if (state.phase === "waiting") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold bg-linear-to-r from-cyan-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent mb-2">
            🎨 Iro Karuta
          </h2>
          <p className="text-text-muted text-sm max-w-xs mx-auto">
            {ts({
              en: "Mix CMYK ink cards to match the target color!",
              vi: "Trộn các thẻ mực CMYK để tạo ra màu mục tiêu!",
            })}
          </p>
        </div>

        <div className="flex gap-2">
          {[
            [0, 255, 255],
            [255, 0, 255],
            [255, 255, 0],
          ].map((c, i) => (
            <div
              key={i}
              className="w-12 h-16 rounded-lg animate-pulse"
              style={{
                backgroundColor: rgbaStr(c as RGB, 0.8),
                animationDelay: `${i * 200}ms`,
              }}
            />
          ))}
        </div>

        <div className="text-sm text-text-muted">
          {game.players.length}{" "}
          {ts({ en: "player(s) in room", vi: "người chơi trong phòng" })}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {game.players.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
              style={{
                background: "var(--glass-bg, rgba(255,255,255,0.05))",
                border: "1px solid var(--glass-border, rgba(255,255,255,0.1))",
              }}
            >
              <span className="text-text-primary">
                {p.username || p.id.slice(0, 6)}
              </span>
              {p.id === userId && (
                <span className="text-[9px] text-text-muted">
                  {ts({ en: "(you)", vi: "(bạn)" })}
                </span>
              )}
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            onClick={startGame}
            className="px-6 py-3 rounded-xl bg-linear-to-r from-purple-500 to-pink-500 text-white font-semibold flex items-center gap-2 hover:scale-105 transition-transform"
          >
            <Play className="w-5 h-5" />
            {ts({ en: "Start Game", vi: "Bắt đầu" })}
          </button>
        ) : (
          <div className="px-6 py-3 rounded-xl text-text-muted font-semibold flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            {ts({ en: "Waiting for host...", vi: "Đang chờ chủ phòng..." })}
          </div>
        )}
      </div>
    );
  }

  // ─── Final summary ───
  if (state.phase === "summary" && state.round >= state.maxRounds) {
    const sorted = Object.entries(state.playerData).sort(
      ([, a], [, b]) => b.score - a.score,
    );
    return (
      <div className="flex flex-col items-center gap-4 py-8 px-4 max-w-lg mx-auto">
        <Trophy className="w-10 h-10 text-yellow-400" />
        <h2 className="text-xl font-bold text-text-primary">
          {ts({ en: "Game Over!", vi: "Kết thúc!" })}
        </h2>
        <div className="w-full space-y-3">
          {sorted.map(([pid, pd], rank) => {
            const player = game.players.find((p) => p.id === pid);
            return (
              <div
                key={pid}
                className="flex items-center gap-3 p-3 rounded-xl backdrop-blur-sm border"
                style={{
                  background:
                    rank === 0
                      ? "linear-gradient(135deg, rgba(255,204,0,0.15), rgba(255,149,0,0.1))"
                      : "var(--glass-bg, rgba(255,255,255,0.05))",
                  borderColor:
                    rank === 0
                      ? "rgba(255,204,0,0.3)"
                      : "var(--glass-border, rgba(255,255,255,0.1))",
                }}
              >
                <span className="text-lg font-bold w-8 text-center">
                  {rank === 0
                    ? "🥇"
                    : rank === 1
                      ? "🥈"
                      : rank === 2
                        ? "🥉"
                        : `#${rank + 1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-primary truncate">
                    {player?.username || pid.slice(0, 6)}
                  </div>
                  <div className="text-xs text-text-muted">
                    {pd.finishedAt && state.roundStartTime
                      ? formatTime(pd.finishedAt - state.roundStartTime)
                      : ts({ en: "DNF", vi: "Chưa xong" })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg text-purple-400">
                    {pd.score}
                  </div>
                  <div className="text-xs text-text-muted">pts</div>
                </div>
              </div>
            );
          })}
        </div>
        {isHost && (
          <button
            onClick={resetGame}
            className="mt-4 px-5 py-2.5 rounded-xl bg-linear-to-r from-purple-500 to-pink-500 text-white font-semibold flex items-center gap-2 hover:scale-105 transition-transform"
          >
            <RotateCcw className="w-4 h-4" />
            {ts({ en: "Play Again", vi: "Chơi lại" })}
          </button>
        )}
      </div>
    );
  }

  if (state.phase === "summary") {
    const sorted = Object.entries(state.playerData).sort(
      ([, a], [, b]) => b.score - a.score,
    );
    return (
      <div className="flex flex-col items-center gap-4 py-6 px-4 max-w-lg mx-auto border border-white/10 rounded-xl">
        <h3 className="text-lg font-bold text-text-primary">
          {ts({
            en: `Round ${state.round} Result`,
            vi: `Kết quả vòng ${state.round}`,
          })}
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-muted">
            {ts({ en: "Target:", vi: "Mục tiêu:" })}
          </span>
          <div
            className="w-10 h-10 rounded-lg border border-white/10"
            style={{ backgroundColor: rgbStr(state.targetColor) }}
          />
        </div>
        <div className="w-full space-y-2">
          {sorted.map(([pid, pd]) => {
            const player = game.players.find((p) => p.id === pid);
            const usedCards = pd.cardsInZone
              .map((id) => state.availableCards.find((c) => c.id === id))
              .filter(Boolean);
            const sim =
              usedCards.length > 0
                ? colorSimilarity(
                    blendCardsWithOpacity(usedCards as ColorCard[]),
                    state.targetColor,
                  )
                : 0;
            return (
              <div
                key={pid}
                className="flex items-center gap-3 p-3 rounded-xl backdrop-blur-sm"
                style={{
                  background: "var(--glass-bg, rgba(255,255,255,0.05))",
                  border:
                    "1px solid var(--glass-border, rgba(255,255,255,0.1))",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-primary truncate text-sm">
                    {player?.username || pid.slice(0, 6)}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {usedCards.map((c, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-sm border border-white/20"
                        style={{
                          backgroundColor: rgbaStr(c!.color, c!.opacity),
                        }}
                        title={`${c!.label} (${Math.round(c!.opacity * 100)}%)`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-purple-400">
                    {sim}%
                  </div>
                  {pd.finishedAt && state.roundStartTime && (
                    <div className="text-xs text-text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(pd.finishedAt - state.roundStartTime)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {isHost && (
          <button
            onClick={state.round >= state.maxRounds ? resetGame : nextRound}
            className="mt-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-cyan-500 to-blue-500 text-white font-semibold flex items-center gap-2 hover:scale-105 transition-transform"
          >
            {state.round >= state.maxRounds ? (
              <>
                <Trophy className="w-4 h-4" />
                {ts({ en: "Final Results", vi: "Kết quả cuối" })}
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                {ts({ en: "Next Round", vi: "Vòng tiếp" })}
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  // ─── Playing phase ───

  const isFinished = myData?.finishedAt !== null;

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 max-w-xl mx-auto select-none">
      {/* Header: Round + Timer + Reset */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">
          {ts({
            en: `Round ${state.round}/${state.maxRounds}`,
            vi: `Vòng ${state.round}/${state.maxRounds}`,
          })}
        </span>
        <div className="flex items-center gap-2">
          <ElapsedTimer startTime={state.roundStartTime || 0} />
          {isHost && (
            <button
              onClick={resetGame}
              className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title={ts({ en: "New Game", vi: "Ván mới" })}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Target + Your Mix */}
      <div className="flex items-center justify-center gap-4">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
            {ts({ en: "Target", vi: "Mục tiêu" })}
          </div>
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-white/20"
            style={{ backgroundColor: rgbStr(state.targetColor) }}
          />
        </div>
        <div className="text-2xl text-text-muted">→</div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
            {ts({ en: "Your Mix", vi: "Màu của bạn" })}
          </div>
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 transition-colors"
            style={{
              backgroundColor: rgbStr(previewColor),
              borderColor:
                similarity >= 100
                  ? "rgba(52,199,89,0.8)"
                  : "rgba(255,255,255,0.2)",
            }}
          />
        </div>
      </div>

      {/* Similarity bar */}
      <div className="w-full">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-text-muted">
            {ts({ en: "Similarity", vi: "Độ giống" })}
          </span>
          <span
            className="text-xs font-bold"
            style={{
              color:
                similarity >= 100
                  ? "#34c759"
                  : similarity >= 80
                    ? "#ff9500"
                    : similarity >= 50
                      ? "#ffcc00"
                      : "#ff453a",
            }}
          >
            {similarity}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${similarity}%`,
              background:
                similarity >= 100
                  ? "linear-gradient(90deg, #34c759, #30d158)"
                  : similarity >= 80
                    ? "linear-gradient(90deg, #ff9500, #ffb340)"
                    : similarity >= 50
                      ? "linear-gradient(90deg, #ffcc00, #ffd426)"
                      : "linear-gradient(90deg, #ff453a, #ff6961)",
            }}
          />
        </div>
      </div>

      {isFinished && (
        <div className="text-center py-2 px-4 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-semibold animate-bounce">
          🎉 {ts({ en: "Perfect Match!", vi: "Trùng khớp!" })}
        </div>
      )}

      {/* ═══════════════════════════════════
          DROP ZONE — overlapping translucent cards
          CMY+K → mix-blend-mode: multiply
          White → mix-blend-mode: normal (lightens)
          ═══════════════════════════════════ */}
      <div
        className="relative mx-auto w-full rounded-2xl border-2 border-dashed overflow-hidden"
        style={{
          minHeight: "150px",
          background: "#ffffff",
          borderColor:
            similarity >= 100 ? "rgba(52,199,89,0.6)" : "rgba(0,0,0,0.15)",
        }}
      >
        {cardsInZone.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-gray-400 text-xs text-center pointer-events-none px-4">
              {ts({
                en: "Tap cards below to add",
                vi: "Nhấn các lá bài bên dưới để thêm",
              })}
            </span>
          </div>
        ) : (
          <div
            className="relative w-full flex items-center justify-center"
            style={{ minHeight: "140px" }}
          >
            {/* Sort: ink cards (CMY+K) first with multiply, White cards on top with normal */}
            {[...cardsInZone]
              .sort((a, b) => {
                const aWhite =
                  a.color[0] === 255 &&
                  a.color[1] === 255 &&
                  a.color[2] === 255;
                const bWhite =
                  b.color[0] === 255 &&
                  b.color[1] === 255 &&
                  b.color[2] === 255;
                return aWhite === bWhite ? 0 : aWhite ? 1 : -1;
              })
              .map((card, i) => {
                const total = cardsInZone.length;
                const spread = Math.min(20, 100 / total);
                const offsetX = (i - (total - 1) / 2) * spread;
                const rotation = (i - (total - 1) / 2) * 4;
                const isWhite =
                  card.color[0] === 255 &&
                  card.color[1] === 255 &&
                  card.color[2] === 255;

                return (
                  <div
                    key={card.id}
                    className="absolute rounded-xl group"
                    style={{
                      width: 80,
                      height: 110,
                      left: `calc(50% - 40px + ${offsetX}px)`,
                      top: "calc(50% - 55px)",
                      transform: `rotate(${rotation}deg)`,
                      zIndex: i + 1,
                      backgroundColor: rgbaStr(card.color, card.opacity),
                      mixBlendMode: isWhite ? "normal" : "multiply",
                      cursor: isFinished ? "default" : "pointer",
                    }}
                    onClick={() => !isFinished && removeCard(card.id)}
                  >
                    <div
                      className="absolute inset-0 rounded-xl border border-black/5 flex flex-col items-center justify-end pb-1.5 pointer-events-none gap-0.5"
                      style={{ mixBlendMode: "normal" }}
                    >
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/70 text-gray-600">
                        {card.label}
                      </span>
                      <span className="text-[8px] font-mono px-1 rounded bg-black/10 text-gray-500">
                        {Math.round(card.opacity * 100)}%
                      </span>
                    </div>
                    {!isFinished && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCard(card.id);
                        }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        style={{ mixBlendMode: "normal" }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ═══════════════════════
          HAND — tap to add
          ═══════════════════════ */}
      <div className="mt-1">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 text-center">
          {ts({
            en: "Find 2-3 cards — tap to add/remove",
            vi: "Tìm 2-3 lá bài — nhấn để thêm/bỏ",
          })}
        </div>
        <div className="flex flex-wrap justify-center gap-1 bg-white rounded-xl p-2">
          {state.availableCards.map((card) => {
            const inZone = myData?.cardsInZone?.includes(card.id) ?? false;
            return (
              <div
                key={card.id}
                onClick={() =>
                  inZone ? removeCard(card.id) : addCard(card.id)
                }
                className="relative w-14 h-[76px] sm:w-16 sm:h-[88px] rounded-xl cursor-pointer transition-transform hover:scale-110 active:scale-95"
                style={{
                  backgroundColor: rgbaStr(
                    card.color,
                    inZone ? card.opacity * 0.4 : card.opacity,
                  ),
                  opacity: inZone ? 0.5 : 1,
                  outline: inZone
                    ? "2px solid rgba(175,82,222,0.6)"
                    : "1px solid #0003",
                  outlineOffset: "-2px",
                }}
              >
                <div className="absolute inset-0 rounded-xl border-2 border-white/25" />
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 gap-0.5">
                  <span className="text-[9px] font-bold bg-white/70 text-gray-600 px-1 rounded">
                    {card.label}{" "}
                    {state.answerCardIds.findIndex((id) => id === card.id) +
                      1 || ""}
                  </span>
                  <span className="text-[7px] font-mono px-1 rounded bg-black/20 text-white/80">
                    {Math.round(card.opacity * 100)}%
                  </span>
                </div>
                {inZone && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center text-[8px] font-bold">
                    ✓
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Other players — show their blended color (no similarity %) */}
      {Object.keys(state.playerData).length > 1 && (
        <div className="mt-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-text-muted text-center">
            {ts({ en: "Players", vi: "Người chơi" })}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {Object.entries(state.playerData)
              //   .filter(([pid]) => pid !== userId)
              .map(([pid, pd]) => {
                const player = game.players.find((p) => p.id === pid);
                const theirCards = pd.cardsInZone
                  .map((id) => state.availableCards.find((c) => c.id === id))
                  .filter(Boolean) as ColorCard[];
                const theirColor: RGB =
                  theirCards.length > 0
                    ? blendCardsWithOpacity(theirCards)
                    : [255, 255, 255];
                return (
                  <div
                    key={pid}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                    style={{
                      background: pd.finishedAt
                        ? "rgba(52,199,89,0.1)"
                        : "var(--glass-bg, rgba(255,255,255,0.05))",
                      border: `1px solid ${pd.finishedAt ? "rgba(52,199,89,0.3)" : "var(--glass-border, rgba(255,255,255,0.1))"}`,
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-sm border border-white/20 shrink-0"
                      style={{ backgroundColor: rgbStr(theirColor) }}
                    />
                    <span className="text-text-primary truncate max-w-[80px]">
                      {player?.username || pid.slice(0, 6)}
                    </span>
                    {pd.finishedAt ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-text-muted">
                        {pd.cardsInZone.length} {ts({ en: "cards", vi: "thẻ" })}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
