import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  BookOpen,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import useLanguage from "../../stores/languageStore";
import type { GameUIProps } from "../types";
import ParaboxGame from "./ParaboxGame";
import useGameState from "../../hooks/useGameState";
import CanvasRenderer from "./CanvasRenderer";
import {
  MOVE_DURATION,
  TILE_BOX,
  TILE_GOAL,
  TILE_SIZE,
  TILE_WALL,
} from "./constants";
import type {
  Direction,
  Pos,
  ParaboxState,
  LevelData,
  TileType,
} from "./types";

// Sub-component for the static elements of the level (walls, goals, floors)
const StaticGrid = React.memo(({ level }: { level: LevelData }) => {
  const isEdge = (x: number, y: number) => {
    return (
      x === 0 || y === 0 || x === level.width - 1 || y === level.height - 1
    );
  };

  const isExit = (x: number, y: number) => {
    return isEdge(x, y) && level.grid[y][x] !== TILE_WALL;
  };

  const getExitGradient = (x: number, y: number) => {
    if (x === 0)
      return "linear-gradient(to right, rgba(255,255,255,0.15), transparent)";
    if (x === level.width - 1)
      return "linear-gradient(to left, rgba(255,255,255,0.15), transparent)";
    if (y === 0)
      return "linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)";
    if (y === level.height - 1)
      return "linear-gradient(to top, rgba(255,255,255,0.15), transparent)";
    return "none";
  };

  return (
    <>
      {level.grid.map((row: TileType[], y: number) =>
        row.map((tile: TileType, x: number) => {
          const hasU = y > 0 && level.grid[y - 1][x] === TILE_WALL;
          const hasD =
            y < level.height - 1 && level.grid[y + 1][x] === TILE_WALL;
          const hasL = x > 0 && level.grid[y][x - 1] === TILE_WALL;
          const hasR =
            x < level.width - 1 && level.grid[y][x + 1] === TILE_WALL;

          return (
            <div
              key={`static-${x}-${y}`}
              className="absolute flex items-center justify-center"
              style={{
                width: "var(--tile-size)",
                height: "var(--tile-size)",
                left: "calc(var(--tile-size) * " + x + ")",
                top: "calc(var(--tile-size) * " + y + ")",
                zIndex: 1,
              }}
            >
              {tile === TILE_WALL && (
                <div
                  className="w-full h-full bg-background-primary shadow-inner"
                  style={{
                    borderTop: hasU ? "none" : "1px solid rgb(15, 23, 42)",
                    borderBottom: hasD ? "none" : "1px solid rgb(15, 23, 42)",
                    borderLeft: hasL ? "none" : "1px solid rgb(15, 23, 42)",
                    borderRight: hasR ? "none" : "1px solid rgb(15, 23, 42)",
                  }}
                />
              )}
              {isExit(x, y) && (
                <div
                  className="absolute inset-0 z-0"
                  style={{ background: getExitGradient(x, y) }}
                />
              )}
              {tile === TILE_GOAL && (
                <div className="relative w-8 h-8 flex items-center justify-center">
                  <div className="absolute inset-0 bg-blue-400 rounded-sm rotate-45 animate-pulse opacity-40 blur-[2px]" />
                  <div className="w-4 h-4 rounded-sm bg-blue-300 rotate-45 border border-white/50" />
                </div>
              )}
            </div>
          );
        }),
      )}
    </>
  );
});

// Memoized Player Component
const PlayerEntity = React.memo(
  ({
    pos,
    color,
    isMe,
    shakeDirection,
  }: {
    pos: Pos;
    color: string;
    isMe: boolean;
    shakeDirection?: Direction | null;
  }) => {
    const shakeX =
      shakeDirection === "left" ? -15 : shakeDirection === "right" ? 15 : 0;
    const shakeY =
      shakeDirection === "up" ? -15 : shakeDirection === "down" ? 15 : 0;

    return (
      <motion.div
        className="absolute flex items-center justify-center z-50 pointer-events-none"
        initial={false}
        animate={{
          left: `calc(var(--tile-size) * ${pos.x})`,
          top: `calc(var(--tile-size) * ${pos.y})`,
          x: shakeDirection ? [0, shakeX, 0, shakeX / 2, 0] : 0,
          y: shakeDirection ? [0, shakeY, 0, shakeY / 2, 0] : 0,
        }}
        transition={{
          duration: MOVE_DURATION / 1000,
          ease: [0.16, 1, 0.3, 1],
          x: shakeDirection
            ? { duration: 0.2, times: [0, 0.2, 0.4, 0.6, 1] }
            : { duration: MOVE_DURATION / 1000 },
          y: shakeDirection
            ? { duration: 0.2, times: [0, 0.2, 0.4, 0.6, 1] }
            : { duration: MOVE_DURATION / 1000 },
        }}
        style={{
          width: "var(--tile-size)",
          height: "var(--tile-size)",
        }}
      >
        <div
          className="w-[85%] h-[85%] rounded-lg border-2 shadow-[0_0_30px_rgba(59,130,246,0.6)] flex flex-col items-center justify-center relative group"
          style={{
            backgroundColor: color,
            borderColor: isMe ? "#93c5fd" : "#86efac",
            boxShadow: `0 0 30px ${color}66`,
          }}
        >
          <div className="flex gap-2 mb-1">
            <div
              className="w-2.5 h-3.5 bg-white rounded-full shadow-sm animate-bounce"
              style={{ animationDelay: "0s" }}
            />
            <div
              className="w-2.5 h-3.5 bg-white rounded-full shadow-sm animate-bounce"
              style={{ animationDelay: "0.1s" }}
            />
          </div>
          <div className="w-full h-2 bg-black/20 absolute bottom-0 rounded-b-lg" />
          <div className="absolute inset-0 bg-linear-to-t from-transparent via-white/5 to-white/10" />
        </div>
      </motion.div>
    );
  },
);

// Memoized Board Renderer for performance
const BoardRenderer = React.memo(
  ({
    levelId,
    state,
    currentUserId,
    depth = 0,
    blockedInfo = null,
  }: {
    levelId: string;
    state: ParaboxState;
    currentUserId: string;
    depth?: number;
    blockedInfo?: { direction: Direction; time: number } | null;
  }) => {
    const level = state.levels[levelId];
    if (!level) return null;

    if (depth > 1)
      return (
        <div
          className="w-full h-full"
          style={{ backgroundColor: level.color }}
        />
      );

    const borderSize = depth === 0 ? 8 : 2;

    const boxEntities = useMemo(() => {
      const entities: {
        x: number;
        y: number;
        id: string;
        innerLevelId?: string;
      }[] = [];
      level.grid.forEach((row, y) =>
        row.forEach((tile, x) => {
          if (tile === TILE_BOX) {
            const innerId = level.boxContents?.[`${x},${y}`];
            entities.push({
              x,
              y,
              id: innerId || `solid-${x}-${y}`,
              innerLevelId: innerId,
            });
          }
        }),
      );
      return entities;
    }, [level.grid, level.boxContents]);

    return (
      <div className="relative flex items-center justify-center pointer-events-none select-none">
        {/* CURRENT LEVEL GRID CONTAINER */}
        <div
          className="relative overflow-hidden"
          style={{
            width: `calc(var(--tile-size) * ${level.width})`,
            height: `calc(var(--tile-size) * ${level.height})`,
            backgroundColor: level.color,
            boxSizing: "content-box",
            border: `${borderSize}px solid ${depth === 0 ? "#1e293b" : "rgba(255,255,255,0.3)"}`,
            boxShadow:
              depth === 0 ? "0 25px 50px -12px rgba(0, 0, 0, 0.8)" : "none",
          }}
        >
          <StaticGrid level={level} />

          {/* BOX LAYER */}
          {boxEntities.map((box) => {
            const baseInnerLevelId = box.innerLevelId
              ? box.innerLevelId.split("#")[0]
              : null;
            const innerLevel = baseInnerLevelId
              ? state.levels[baseInnerLevelId]
              : null;
            return (
              <div
                key={box.id}
                className="absolute flex items-center justify-center p-[2px] transition-all"
                style={{
                  width: "var(--tile-size)",
                  height: "var(--tile-size)",
                  left: `calc(var(--tile-size) * ${box.x})`,
                  top: `calc(var(--tile-size) * ${box.y})`,
                  zIndex: 10,
                }}
              >
                <div className="w-full h-full transition-transform duration-150 ease-out transform active:scale-95">
                  {innerLevel ? (
                    <div
                      className="w-full h-full border-4 border-slate-400/50 shadow-lg overflow-hidden flex items-center justify-center bg-black/20"
                      style={{ borderRadius: "4px" }}
                    >
                      <div
                        style={{
                          width: `calc(var(--tile-size) * ${innerLevel.width})`,
                          height: `calc(var(--tile-size) * ${innerLevel.height})`,
                          transform: `scale(${0.9 / Math.max(innerLevel.width, innerLevel.height)})`,
                          transformOrigin: "center center",
                        }}
                      >
                        <BoardRenderer
                          levelId={baseInnerLevelId!}
                          state={state}
                          currentUserId={currentUserId}
                          depth={depth + 1}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="w-[85%] h-[85%] bg-slate-600 rounded-md border-2 border-slate-500 shadow-lg flex items-center justify-center overflow-hidden">
                      <div className="w-[70%] h-[70%] border-2 border-slate-700/50 rounded-sm bg-slate-700/30" />
                      <div className="absolute inset-0 bg-linear-to-br from-white/10 to-transparent pointer-events-none" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* PLAYER LAYER */}
          {Object.values(state.players).map((player) => {
            if (player.currentLevelId !== levelId) return null;
            return (
              <PlayerEntity
                key={player.id}
                pos={player.pos}
                color={player.id === currentUserId ? "#3b82f6" : "#22c55e"}
                isMe={player.id === currentUserId}
                shakeDirection={
                  player.id === currentUserId ? blockedInfo?.direction : null
                }
              />
            );
          })}
        </div>
      </div>
    );
  },
);

const ParaboxUI: React.FC<GameUIProps> = ({ game: baseGame }) => {
  const game = baseGame as ParaboxGame;
  const [state] = useGameState(game);
  const currentUserId = game.userId;
  const myState = currentUserId ? state.players[currentUserId] : null;

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [lastBlocked, setLastBlocked] = useState<{
    direction: Direction;
    time: number;
  } | null>(null);
  const [viewLevelId, setViewLevelId] = useState<string | null>(null);
  const [renderMode, setRenderMode] = useState<"dom" | "canvas">("dom");
  const [showRules, setShowRules] = useState(false);
  const { ti, ts } = useLanguage();

  const activeLevelId = myState?.currentLevelId || "root";

  // Reset viewLevelId when player moves to a different level
  useEffect(() => {
    setViewLevelId(null);
  }, [activeLevelId]);

  const displayedLevelId = viewLevelId || activeLevelId;

  const handleZoom = (type: "in" | "out") => {
    if (!myState) return;
    const stack = myState.levelStack;
    if (type === "out") {
      // Find the index of the level currently being viewed in the stack
      // or start from the current level
      const currentIdx = stack.findIndex((s) => s.levelId === displayedLevelId);
      if (displayedLevelId === activeLevelId) {
        if (stack.length > 0) {
          setViewLevelId(stack[stack.length - 1].levelId);
        }
      } else if (currentIdx > 0) {
        setViewLevelId(stack[currentIdx - 1].levelId);
      }
    } else {
      // Zoom In
      const currentIdx = stack.findIndex((s) => s.levelId === displayedLevelId);
      if (currentIdx !== -1 && currentIdx < stack.length - 1) {
        setViewLevelId(stack[currentIdx + 1].levelId);
      } else if (currentIdx === stack.length - 1) {
        setViewLevelId(null); // Back to active level
      }
    }
  };

  const handleMove = (dir: Direction) => {
    if (!currentUserId) return;

    if (game.checkBlockedMove(currentUserId, dir)) {
      setLastBlocked({ direction: dir, time: Date.now() });
      // Reset after a short delay to allow re-triggering same direction
      setTimeout(() => setLastBlocked(null), 200);
    }

    game.makeAction({
      type: "MOVE",
      direction: dir,
      playerId: currentUserId,
    });
  };

  // Handle Keyboard Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let dir: Direction | null = null;
      if (e.key === "ArrowUp" || e.key === "w") dir = "up";
      if (e.key === "ArrowDown" || e.key === "s") dir = "down";
      if (e.key === "ArrowLeft" || e.key === "a") dir = "left";
      if (e.key === "ArrowRight" || e.key === "d") dir = "right";

      if (dir) {
        handleMove(dir);
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentUserId, game, handleMove]);

  // Track stack length to determine transition direction
  const prevStackLengthRef = useRef(0);
  const currentStackLength = myState?.levelStack.length || 0;

  const transitionDirection = useMemo(() => {
    if (currentStackLength > prevStackLengthRef.current) return "enter";
    if (currentStackLength < prevStackLengthRef.current) return "exit";
    return "none";
  }, [currentStackLength]);

  useEffect(() => {
    prevStackLengthRef.current = currentStackLength;
  }, [currentStackLength]);

  const activeLevel = state.levels[displayedLevelId];

  const tileSize = useMemo(() => {
    if (!activeLevel) return TILE_SIZE;
    const boardW = activeLevel.width;
    const boardH = activeLevel.height;
    const availableW = windowSize.width * 0.9;
    const availableH = windowSize.height * 0.6;

    const maxTileW = availableW / boardW;
    const maxTileH = availableH / boardH;

    return Math.min(maxTileW, maxTileH, TILE_SIZE);
  }, [activeLevel, windowSize]);

  if (!state.levels["root"]) {
    return (
      <div className="w-full h-full bg-background-primary flex flex-col items-center justify-center font-sans text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-xl font-bold tracking-widest uppercase opacity-50">
          Syncing with Host...
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full bg-background-primary flex flex-col font-sans overflow-hidden text-white"
      style={{ "--tile-size": `${tileSize}px` } as React.CSSProperties}
    >
      {/* Header Section */}
      <div className="flex-none p-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase drop-shadow-lg">
            <span className="text-blue-500">
              Para<span className="text-white">b</span>ox
            </span>
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {myState ? (
              <>
                <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg text-[10px] text-slate-300 border border-slate-700 font-bold uppercase tracking-widest shadow-lg hidden md:inline-block">
                  WASD to Move
                </span>
                <span className="bg-slate-800/80 px-2.5 py-1 rounded-lg text-[10px] text-slate-300 border border-slate-700 font-bold uppercase tracking-widest shadow-lg">
                  Co-op Mode
                </span>
              </>
            ) : (
              <span className="bg-blue-600/80 px-2.5 py-1 rounded-lg text-[10px] text-white border border-blue-500 font-bold uppercase tracking-widest shadow-lg">
                Spectator Mode
              </span>
            )}
            <button
              onClick={() =>
                setRenderMode(renderMode === "dom" ? "canvas" : "dom")
              }
              className="bg-purple-600/80 hover:bg-purple-500 px-2.5 py-1 rounded-lg text-[10px] text-white border border-purple-500 font-bold uppercase tracking-widest shadow-lg transition-colors"
            >
              {renderMode === "dom" ? "Switch to Canvas" : "Switch to DOM"}
            </button>
          </div>
        </div>

        {/* Description - Hidden on small mobile to save space */}
        <div className="hidden sm:block text-slate-500 text-[10px] md:text-xs italic max-w-xs opacity-50">
          Push boxes into goals. Boxes can contain other boxes... or even
          themselves! Paradoxes are encouraged.
        </div>
      </div>

      {/* Game World Wrapper - Takes remaining space and centers */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Transitioning Level */}
        {renderMode === "dom" ? (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={displayedLevelId}
              initial={
                transitionDirection === "enter"
                  ? { opacity: 0, scale: 0.5 }
                  : transitionDirection === "exit"
                    ? { opacity: 0, scale: 1.5 }
                    : { opacity: 0, scale: 1 }
              }
              animate={{ opacity: 1, scale: 1 }}
              exit={
                transitionDirection === "enter"
                  ? { opacity: 0, scale: 1.5 }
                  : { opacity: 0, scale: 0.5 }
              }
              transition={{ duration: 0.45, ease: [0.15, 0, 0, 1] }}
              style={{ willChange: "transform, opacity" }}
            >
              <BoardRenderer
                levelId={displayedLevelId}
                state={state}
                currentUserId={currentUserId!}
                depth={0}
                blockedInfo={lastBlocked}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <CanvasRenderer
            state={state}
            displayedLevelId={displayedLevelId}
            currentUserId={currentUserId!}
            tileSize={tileSize}
            width={windowSize.width}
            height={windowSize.height * 0.7}
          />
        )}
      </div>

      {/* Footer Section - Controls */}
      <div className="p-4 flex flex-col md:flex-row items-center justify-center gap-6">
        {/* Zoom Controls */}
        {myState && myState.levelStack.length > 0 && (
          <div className="flex gap-2 p-2 bg-slate-900/40 rounded-2xl border border-white/5 backdrop-blur-sm shadow-2xl">
            <button
              onClick={() => handleZoom("out")}
              disabled={
                displayedLevelId === (myState.levelStack[0]?.levelId || "root")
              }
              className="w-12 h-12 bg-slate-800/90 rounded-xl flex items-center justify-center border border-slate-700 active:bg-blue-600 active:scale-90 transition-all shadow-lg text-slate-300 disabled:opacity-30 disabled:pointer-events-none"
              title="Zoom Out"
            >
              <ZoomOut size={22} />
            </button>
            <button
              onClick={() => handleZoom("in")}
              disabled={displayedLevelId === activeLevelId}
              className="w-12 h-12 bg-slate-800/90 rounded-xl flex items-center justify-center border border-slate-700 active:bg-blue-600 active:scale-90 transition-all shadow-lg text-slate-300 disabled:opacity-30 disabled:pointer-events-none"
              title="Zoom In"
            >
              <ZoomIn size={22} />
            </button>
          </div>
        )}

        {/* Movement Controls */}
        {myState && (
          <div className="flex flex-col items-start">
            <div className="grid grid-cols-3 gap-1 p-2 bg-slate-900/40 rounded-2xl border border-white/5 backdrop-blur-sm shadow-2xl origin-bottom-left">
              <div />
              <button
                onClick={() => handleMove("up")}
                className="w-12 h-12 bg-slate-800/90 rounded-xl flex items-center justify-center border border-slate-700 active:bg-blue-600 active:scale-90 transition-all shadow-lg text-slate-300"
              >
                <ChevronUp size={24} />
              </button>
              <div />
              <button
                onClick={() => handleMove("left")}
                className="w-12 h-12 bg-slate-800/90 rounded-xl flex items-center justify-center border border-slate-700 active:bg-blue-600 active:scale-90 transition-all shadow-lg text-slate-300"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={() => handleMove("down")}
                className="w-12 h-12 bg-slate-800/90 rounded-xl flex items-center justify-center border border-slate-700 active:bg-blue-600 active:scale-90 transition-all shadow-lg text-slate-300"
              >
                <ChevronDown size={24} />
              </button>
              <button
                onClick={() => handleMove("right")}
                className="w-12 h-12 bg-slate-800/90 rounded-xl flex items-center justify-center border border-slate-700 active:bg-blue-600 active:scale-90 transition-all shadow-lg text-slate-300"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        )}

        {/* Global Reset Button */}
        {game.isHost && (
          <button
            onClick={() =>
              game.makeAction({ type: "RESET", playerId: currentUserId! })
            }
            className="group relative px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all"
          >
            <span className="text-xs font-black tracking-widest uppercase">
              Reset
            </span>
          </button>
        )}
      </div>

      {/* Rules Modal */}
      {showRules &&
        createPortal(
          <div className="fixed inset-0 bg-black/80 glass-blur z-100 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full shadow-2xl relative">
              <div className="flex justify-between p-4 pr-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-yellow-500" />
                  {ti({ en: "Game Rules: Parabox", vi: "Luật Chơi: Parabox" })}
                </h2>
                <button
                  onClick={() => setShowRules(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4 text-slate-300 leading-relaxed max-h-[80vh] overflow-y-auto">
                <div className="space-y-4 text-slate-300 leading-relaxed">
                  <section>
                    <h3 className="text-lg font-bold text-yellow-400">
                      {ti({ en: "Objective", vi: "Mục tiêu" })}
                    </h3>
                    <p>
                      {ti({
                        en: "Push all boxes into the blue goal squares to win.",
                        vi: "Đẩy tất cả các khối vào các ô mục tiêu màu xanh để giành chiến thắng.",
                      })}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-yellow-400 mt-4">
                      {ti({ en: "Recursive World", vi: "Thế Giới Đệ Quy" })}
                    </h3>
                    <p>
                      {ti({
                        en: "Boxes are not just obstacles—they are worlds! Pushing a box into another box enters it.",
                        vi: "Các khối không chỉ là vật cản—chúng là cả một thế giới! Đẩy một khối vào khối khác để đi vào trong.",
                      })}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-yellow-400 mt-4">
                      {ti({ en: "Paradoxes", vi: "Nghịch Lý" })}
                    </h3>
                    <p>
                      {ti({
                        en: "You can even push a level into itself to create infinite recursive loops. Paradoxes are highly encouraged!",
                        vi: "Bạn thậm chí có thể đẩy một màn chơi vào chính nó để tạo ra các vòng lặp đệ quy vô tận. Sự nghịch lý luôn được khuyến khích!",
                      })}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-yellow-400 mt-4">
                      {ti({ en: "Controls", vi: "Điều Khiển" })}
                    </h3>
                    <ul className="list-disc pl-4">
                      <li>
                        {ti({
                          en: "WASD or Arrow keys to move.",
                          vi: "Các phím WASD hoặc Mũi tên để di chuyển.",
                        })}
                      </li>
                      <li>
                        {ti({
                          en: "Zoom In/Out buttons to control the camera.",
                          vi: "Nút Phóng to/Thu nhỏ để điều khiển camera.",
                        })}
                      </li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-yellow-400 mt-4">
                      {ti({ en: "Co-op", vi: "Phối hợp" })}
                    </h3>
                    <ul className="list-disc pl-4">
                      <li>
                        {ti({
                          en: "The more players, the more fun.",
                          vi: "Càng nhiều người chơi, game càng vui.",
                        })}
                      </li>
                      <li>
                        {ti({
                          en: "Players can push boxes together.",
                          vi: "Người chơi có thể đẩy các khối cùng nhau.",
                        })}
                      </li>
                    </ul>
                  </section>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Rules Button */}
      <button
        onClick={() => setShowRules(true)}
        className="fixed bottom-4 right-4 p-3 bg-slate-700 hover:bg-slate-600 rounded-full text-yellow-500 transition-colors z-40 shadow-lg border border-slate-500"
        title={ts({ en: "Rules", vi: "Luật chơi" })}
      >
        <BookOpen size={24} />
      </button>
    </div>
  );
};

export default ParaboxUI;
