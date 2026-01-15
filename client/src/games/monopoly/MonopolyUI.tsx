import { useEffect, useState, useRef } from "react";
import Monopoly from "./Monopoly";
import {
  type MonopolyState,
  type BoardSpace,
  type PropertyColor,
  type GameLog,
  BOARD_SPACES,
  PROPERTY_COLORS,
} from "./types";
import { Play, RefreshCw, Dices, Home, DollarSign, Lock } from "lucide-react";
import useLanguage from "../../stores/languageStore";
import type { GameUIProps } from "../types";

// Property color display
const getPropertyColorStyle = (color?: PropertyColor): string => {
  if (!color) return "";
  return PROPERTY_COLORS[color] || "";
};

// CSS Animations
const animationStyles = `
@keyframes bounce-dice {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-15px) rotate(90deg); }
  50% { transform: translateY(-8px) rotate(180deg); }
  75% { transform: translateY(-12px) rotate(270deg); }
}

@keyframes pulse-token {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 currentColor; }
  50% { transform: scale(1.3); box-shadow: 0 0 12px 4px currentColor; }
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 5px 2px currentColor; }
  50% { box-shadow: 0 0 15px 5px currentColor; }
}

@keyframes slide-in {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes token-move {
  0% { transform: scale(1); }
  50% { transform: scale(1.5) translateY(-5px); }
  100% { transform: scale(1); }
}
`;

export default function MonopolyUI({
  game: baseGame,
  currentUserId,
}: GameUIProps) {
  const game = baseGame as Monopoly;
  const [state, setState] = useState<MonopolyState>(game.getState());
  const [historyLogs, setHistoryLogs] = useState<GameLog[]>(
    game.getState().logs || []
  );
  const { ti } = useLanguage();
  const [rolling, setRolling] = useState(false);
  const [displayDice, setDisplayDice] = useState<[number, number]>([1, 1]);
  const [selectedProperty, setSelectedProperty] = useState<BoardSpace | null>(
    null
  );
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);

  const isRollingRef = useRef(false);
  const lastDiceRef = useRef<number[] | undefined>(game.getState().diceValues);

  // Cache player positions to handle mutated state delay
  const lastPositionsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    // Init positions cache
    const initialPos: Record<string, number> = {};
    game.getState().players.forEach((p) => {
      if (p.id) initialPos[p.id] = p.position;
    });
    lastPositionsRef.current = initialPos;

    game.onUpdate((newState) => {
      // Detect new dice roll by comparing with last known dice values
      const newDice = newState.diceValues;
      const isNewRoll =
        newDice &&
        (!lastDiceRef.current ||
          newDice[0] !== lastDiceRef.current[0] ||
          newDice[1] !== lastDiceRef.current[1]);

      if (isNewRoll && !isRollingRef.current) {
        // Start animation sequence
        isRollingRef.current = true;
        lastDiceRef.current = newDice;
        setRolling(true);

        let count = 0;
        const interval = setInterval(() => {
          setDisplayDice([
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1,
          ]);
          count++;
          if (count > 8) {
            clearInterval(interval);
            setDisplayDice(newDice);
            setRolling(false);
            isRollingRef.current = false;
            // UPDATE STATE ONLY AFTER ANIMATION FINISHES
            setState(newState);

            // Update cache after animation
            const posMap: Record<string, number> = {};
            newState.players.forEach((p) => {
              if (p.id) posMap[p.id] = p.position;
            });
            lastPositionsRef.current = posMap;
          }
        }, 80);
        return;
      }

      // If not rolling, update immediately
      if (!isRollingRef.current) {
        setState(newState);
        if (newState.diceValues) lastDiceRef.current = newState.diceValues;

        // Update positions cache
        const posMap: Record<string, number> = {};
        newState.players.forEach((p) => {
          if (p.id) posMap[p.id] = p.position;
        });
        lastPositionsRef.current = posMap;
      }

      // Update local history logs (accumulate unique logs)
      setHistoryLogs((prevLogs) => {
        const newLogs = newState.logs || [];
        const existingIds = new Set(prevLogs.map((l) => l.id));
        const uniqueNewLogs = newLogs.filter((l) => !existingIds.has(l.id));
        if (uniqueNewLogs.length === 0) return prevLogs;
        return [...prevLogs, ...uniqueNewLogs];
      });
    });

    setState(game.getState());
    game.requestSync();
  }, [game]);

  const myIndex = game.getMyPlayerIndex();
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === currentUserId;
  const isHost = game.isHostUser;

  const canRoll =
    isMyTurn &&
    (!state.hasRolled || state.canRollAgain) &&
    !state.pendingAction &&
    !rolling;

  // Get board space position for display (11x11 grid)
  const getSpacePosition = (
    index: number
  ): { row: number; col: number; rotation: number } => {
    if (index >= 0 && index <= 10) {
      // Bottom row (left to right)
      return { row: 10, col: 10 - index, rotation: 0 };
    } else if (index >= 11 && index <= 19) {
      // Left column (bottom to top)
      return { row: 10 - (index - 10), col: 0, rotation: 90 };
    } else if (index >= 20 && index <= 30) {
      // Top row (left to right)
      return { row: 0, col: index - 20, rotation: 180 };
    } else {
      // Right column (top to bottom)
      return { row: index - 30, col: 10, rotation: 270 };
    }
  };

  const renderDice = (value: number, size: string = "w-12 h-12") => {
    const dots: Record<number, string[]> = {
      1: ["center"],
      2: ["top-right", "bottom-left"],
      3: ["top-right", "center", "bottom-left"],
      4: ["top-left", "top-right", "bottom-left", "bottom-right"],
      5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
      6: [
        "top-left",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-right",
      ],
    };

    const dotPositions: Record<string, string> = {
      "top-left": "top-1 left-1",
      "top-right": "top-1 right-1",
      "middle-left": "top-1/2 left-1 -translate-y-1/2",
      "middle-right": "top-1/2 right-1 -translate-y-1/2",
      center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
      "bottom-left": "bottom-1 left-1",
      "bottom-right": "bottom-1 right-1",
    };

    return (
      <div
        className={`relative ${size} bg-white rounded-lg shadow-lg border-2 border-gray-300`}
        style={{
          animation: rolling
            ? "bounce-dice 0.3s ease-in-out infinite"
            : undefined,
        }}
      >
        {(dots[value] || []).map((pos, i) => (
          <div
            key={i}
            className={`absolute w-2 h-2 bg-gray-800 rounded-full ${dotPositions[pos]}`}
          />
        ))}
      </div>
    );
  };

  const renderBoardSpace = (space: BoardSpace) => {
    const pos = getSpacePosition(space.id);
    // const isCorner = [0, 10, 20, 30].includes(space.id);
    const ownership = state.properties.find((p) => p.spaceId === space.id);
    const owner = ownership
      ? state.players.find((p) => p.id === ownership.ownerId)
      : null;

    return (
      <div
        key={space.id}
        className="bg-slate-700 border border-slate-600 relative flex flex-col overflow-hidden cursor-pointer hover:bg-slate-600 transition-colors"
        style={{
          gridRow: pos.row + 1,
          gridColumn: pos.col + 1,
          aspectRatio: 1,
          //  isCorner
          //   ? "1"
          //   : pos.rotation === 0 || pos.rotation === 180
          //   ? "0.75"
          //   : "1.33",
        }}
        onClick={() => setSelectedProperty(space)}
      >
        {/* Property color bar */}
        {space.color && (
          <div
            className="w-full h-[15%] min-h-[2px] flex-shrink-0"
            style={{ backgroundColor: getPropertyColorStyle(space.color) }}
          />
        )}

        {/* Space name */}
        <div className="flex-1 flex items-center justify-center p-0.5 overflow-hidden">
          <span className="text-[5px] sm:text-[6px] md:text-[8px] text-white text-center leading-tight line-clamp-2 font-medium">
            {ti({ en: space.name, vi: space.nameVi || space.name })}
          </span>
        </div>

        {/* Houses/Hotel indicator */}
        {ownership && ownership.houses > 0 && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-[1px] sm:gap-0.5 p-[1px] sm:p-0.5">
            {ownership.houses === 5 ? (
              <div
                className="w-2 h-1.5 sm:w-3 sm:h-2 bg-red-500 rounded-sm"
                title="Hotel"
              />
            ) : (
              Array.from({ length: ownership.houses }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-green-500 rounded-sm"
                  title="House"
                />
              ))
            )}
          </div>
        )}

        {/* Owner indicator */}
        {owner && (
          <div
            className="absolute top-0 right-0 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border border-white"
            style={{ backgroundColor: owner.color }}
            title={owner.username}
          />
        )}

        {/* Mortgaged indicator */}
        {ownership?.mortgaged && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Lock className="w-2 h-2 sm:w-3 sm:h-3 text-white" />
          </div>
        )}
      </div>
    );
  };

  const renderPlayerPanel = () => (
    <div className="bg-slate-800 rounded-lg p-3 w-full">
      <h3 className="text-white font-bold mb-2 text-sm">
        {ti({ en: "Players", vi: "Người chơi" })}
      </h3>
      <div className="space-y-2">
        {state.players.map((player, index) => {
          if (!player.id) return null;
          const isActive = state.currentPlayerIndex === index;
          const myProps = state.properties.filter(
            (p) => p.ownerId === player.id
          );

          return (
            <div
              key={index}
              className={`p-2 rounded-lg ${
                isActive
                  ? "bg-slate-600 ring-2 ring-yellow-400"
                  : "bg-slate-700"
              }
                ${player.isBankrupt ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-4 h-4 rounded-full border-2 border-white"
                  style={{ backgroundColor: player.color }}
                />
                <span className="text-white text-sm font-medium flex-1 truncate text-left">
                  {player.username}
                  {player.isBot && " 🤖"}
                  {player.id === currentUserId &&
                    ti({ en: " (You)", vi: " (Bạn)" })}
                </span>
                {player.inJail && (
                  <span className="text-xs">
                    🔒 {ti({ en: "in jail", vi: "trong tù" })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <DollarSign className="w-3 h-3" />
                <span className="font-mono">
                  {player.money.toLocaleString()}
                </span>
                <Home className="w-3 h-3 ml-2" />
                <span>{myProps.length}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderGameControls = () => {
    if (state.gamePhase === "waiting") {
      return (
        <div className="flex flex-col items-center gap-4 p-4 bg-slate-800 rounded-lg">
          <h3 className="text-white font-bold">
            {ti({ en: "Waiting for players...", vi: "Đang chờ người chơi..." })}
          </h3>
          <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
            {state.players.map((player, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded bg-slate-700"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="text-white text-sm">
                    {player.id
                      ? player.username
                      : ti({ en: "(empty)", vi: "(trống)" })}
                    {player.isBot && " 🤖"}
                  </span>
                </div>
                {isHost &&
                  (player.isBot ? (
                    <button
                      onClick={() => game.requestRemoveBot(index)}
                      className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded"
                    >
                      ✕
                    </button>
                  ) : (
                    !player.id && (
                      <button
                        onClick={() => game.requestAddBot(index)}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded"
                      >
                        +Bot
                      </button>
                    )
                  ))}
              </div>
            ))}
          </div>
          {isHost && game.canStartGame() && (
            <button
              onClick={() => game.requestStartGame()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />{" "}
              {ti({ en: "Start Game", vi: "Bắt đầu" })}
            </button>
          )}
        </div>
      );
    }

    if (state.gamePhase === "ended") {
      const winner = state.players.find((p) => p.id === state.winner);
      return (
        <div className="flex flex-col items-center gap-4 p-4 bg-slate-800 rounded-lg">
          <h3 className="text-2xl font-bold text-yellow-400">
            🎉 {ti({ en: "Game Over!", vi: "Kết thúc!" })}
          </h3>
          <p className="text-white">
            {winner?.id === currentUserId
              ? ti({ en: "You won!", vi: "Bạn thắng!" })
              : `${winner?.username} ${ti({ en: "wins!", vi: "thắng!" })}`}
          </p>
          {isHost && (
            <button
              onClick={() => game.reset()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg"
            >
              <RefreshCw className="w-4 h-4" /> Play Again
            </button>
          )}
        </div>
      );
    }

    // Playing phase
    return (
      <div className="flex flex-col items-center gap-3 p-4 bg-slate-800 rounded-lg w-full max-w-md">
        {/* Turn indicator */}
        <div className="text-white text-center">
          {isMyTurn ? (
            <span className="text-green-400 font-bold text-lg">
              {ti({ en: "Your turn!", vi: "Lượt của bạn!" })}
            </span>
          ) : (
            <span className="text-gray-300">
              {ti({ en: "Waiting for", vi: "Đang chờ" })}{" "}
              <span style={{ color: currentPlayer?.color }}>
                {currentPlayer?.username}
              </span>
              ...
            </span>
          )}
        </div>

        {/* Dice display */}
        {state.diceValues && (
          <div className="flex items-center gap-3">
            {renderDice(displayDice[0])}
            {renderDice(displayDice[1])}
            <span className="text-white text-xl font-bold ml-2">
              = {displayDice[0] + displayDice[1]}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 justify-center">
          {canRoll && (
            <button
              onClick={() => game.requestRollDice()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors font-semibold"
            >
              <Dices className="w-5 h-5" />
              {state.canRollAgain
                ? ti({ en: "Roll Again! 🎉", vi: "Đổ tiếp! 🎉" })
                : ti({ en: "Roll Dice", vi: "Đổ xí ngầu" })}
            </button>
          )}

          {isMyTurn && currentPlayer?.inJail && !state.hasRolled && (
            <button
              onClick={() => game.requestPayJailFine()}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors"
            >
              {ti({
                en: `Pay ${500}đ to Leave Jail`,
                vi: `Trả ${500}đ để ra tù`,
              })}
            </button>
          )}

          {isMyTurn &&
            state.hasRolled &&
            !state.canRollAgain &&
            !state.pendingAction && (
              <button
                onClick={() => game.requestEndTurn()}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                {ti({ en: "End Turn", vi: "Kết thúc lượt" })}
              </button>
            )}
        </div>

        {/* Pending action modal */}
        {state.pendingAction && isMyTurn && (
          <div className="w-full p-3 bg-slate-700 rounded-lg animate-slide-in">
            {state.pendingAction.type === "BUY_DECISION" && (
              <div className="flex flex-col gap-2">
                <p className="text-white text-center">
                  {ti({ en: "Buy", vi: "Mua" })}{" "}
                  {ti({
                    en: BOARD_SPACES[state.pendingAction.spaceId]?.name,
                    vi: BOARD_SPACES[state.pendingAction.spaceId]?.nameVi,
                  })}{" "}
                  {ti({ en: "for", vi: "giá" })}{" "}
                  {BOARD_SPACES[
                    state.pendingAction.spaceId
                  ]?.price?.toLocaleString()}
                  đ?
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      if (state.pendingAction?.type === "BUY_DECISION") {
                        game.requestBuyProperty(state.pendingAction.spaceId);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg"
                  >
                    {ti({ en: "Buy", vi: "Mua" })}
                  </button>
                  <button
                    onClick={() => game.requestDeclineProperty()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
                  >
                    {ti({ en: "Decline", vi: "Bỏ qua" })}
                  </button>
                </div>
              </div>
            )}

            {state.pendingAction.type === "PAY_RENT" && (
              <div className="flex flex-col gap-2">
                <p className="text-white text-center">
                  {ti({ en: "Pay", vi: "Trả" })}{" "}
                  {state.pendingAction.amount.toLocaleString()}đ{" "}
                  {ti({ en: "rent", vi: "tiền thuê" })}
                </p>
                <button
                  onClick={() => game.requestPayRent()}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg mx-auto"
                >
                  {ti({ en: "Pay Rent", vi: "Trả tiền thuê" })}
                </button>
              </div>
            )}

            {state.pendingAction.type === "PAY_TAX" && (
              <div className="flex flex-col gap-2">
                <p className="text-white text-center">
                  {ti({ en: "Pay", vi: "Trả" })}{" "}
                  {state.pendingAction.amount.toLocaleString()}đ{" "}
                  {ti({ en: "tax", vi: "thuế" })}
                </p>
                <button
                  onClick={() => game.requestPayTax()}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg mx-auto"
                >
                  {ti({ en: "Pay Tax", vi: "Trả thuế" })}
                </button>
              </div>
            )}

            {state.pendingAction.type === "CARD" && (
              <div className="flex flex-col gap-2">
                <p className="text-white text-center font-medium">
                  {ti({
                    en: state.pendingAction.card.text,
                    vi: state.pendingAction.card.textVi,
                  })}
                </p>
                <button
                  onClick={() => game.requestUseCard()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg mx-auto"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        )}

        {/* Last action */}
        {state.lastAction && (
          <p className="text-gray-400 text-sm text-center">
            {ti(state.lastAction)}
          </p>
        )}
      </div>
    );
  };

  const renderPropertyDetail = () => {
    if (!selectedProperty) return null;

    const ownership = state.properties.find(
      (p) => p.spaceId === selectedProperty.id
    );
    const owner = ownership
      ? state.players.find((p) => p.id === ownership.ownerId)
      : null;
    const isMyProperty = ownership?.ownerId === currentUserId;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={() => setSelectedProperty(null)}
      >
        <div
          className="bg-slate-800 rounded-xl p-4 max-w-sm w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Color header */}
          {selectedProperty.color && (
            <div
              className="h-8 rounded-t-lg -mx-4 -mt-4 mb-3"
              style={{
                backgroundColor: getPropertyColorStyle(selectedProperty.color),
              }}
            />
          )}

          <h3 className="text-white font-bold text-xl mb-2">
            {ti({ en: selectedProperty.name, vi: selectedProperty.nameVi })}
          </h3>
          <p className="text-gray-400 text-sm mb-3">
            {ti({ en: selectedProperty.name, vi: selectedProperty.nameVi })}
          </p>

          {selectedProperty.price && (
            <div className="text-gray-300 space-y-1 text-sm">
              <p>
                💰 {ti({ en: "Price", vi: "Giá" })}:{" "}
                {selectedProperty.price.toLocaleString()}đ
              </p>
              {selectedProperty.rent && (
                <>
                  <p>
                    🏠 {ti({ en: "Rent", vi: "Thuê" })}:{" "}
                    {selectedProperty.rent[0].toLocaleString()}đ
                  </p>
                  <p>
                    {ti({ en: "With houses:", vi: "Với nhà:" })}{" "}
                    {selectedProperty.rent
                      .slice(1, 5)
                      .map((r) => r.toLocaleString())
                      .join(" / ")}
                    đ
                  </p>
                  <p>
                    🏨 {ti({ en: "Hotel", vi: "Khách sạn" })}:{" "}
                    {selectedProperty.rent[5]?.toLocaleString()}đ
                  </p>
                </>
              )}
              {selectedProperty.houseCost && (
                <p>
                  🔨 {ti({ en: "House cost", vi: "Giá nhà" })}:{" "}
                  {selectedProperty.houseCost.toLocaleString()}đ
                </p>
              )}
            </div>
          )}

          {owner && (
            <div className="mt-3 pt-3 border-t border-slate-600">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: owner.color }}
                />
                <span className="text-white">
                  {ti({ en: "Owned by", vi: "Sở hữu bởi" })}: {owner.username}
                </span>
              </div>
              {ownership && ownership.houses > 0 && (
                <p className="text-gray-300 text-sm mt-1">
                  🏠{" "}
                  {ownership.houses === 5
                    ? ti({ en: "Hotel", vi: "Khách sạn" })
                    : `${ownership.houses} ${ti({
                        en: "house(s)",
                        vi: "nhà",
                      })}`}
                </p>
              )}
            </div>
          )}

          {/* Economy Actions */}
          {isMyProperty && (
            <div className="mt-4 pt-3 border-t border-slate-600 flex flex-col gap-2">
              <h4 className="text-white text-xs font-bold uppercase mb-1">
                {ti({ en: "Manage Property", vi: "Quản lý tài sản" })}
              </h4>

              {/* Sell House */}
              {ownership &&
                ownership.houses > 0 &&
                selectedProperty.houseCost && (
                  <button
                    onClick={() => game.requestSellHouse(selectedProperty.id)}
                    className="w-full px-3 py-1.5 bg-orange-700 hover:bg-orange-600 text-white rounded text-xs"
                  >
                    {ti({ en: "Sell House", vi: "Bán nhà" })} (+
                    {(selectedProperty.houseCost / 2).toLocaleString()}đ)
                  </button>
                )}

              {/* Mortgage / Unmortgage */}
              {ownership &&
                !ownership.mortgaged &&
                ownership.houses === 0 &&
                selectedProperty.price && (
                  <button
                    onClick={() => game.requestMortgage(selectedProperty.id)}
                    className="w-full px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded text-xs"
                  >
                    {ti({ en: "Mortgage", vi: "Thế chấp" })} (+
                    {(selectedProperty.price / 2).toLocaleString()}đ)
                  </button>
                )}

              {ownership && ownership.mortgaged && selectedProperty.price && (
                <button
                  onClick={() => game.requestUnmortgage(selectedProperty.id)}
                  className="w-full px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs"
                >
                  {ti({ en: "Unmortgage", vi: "Chuộc lại" })} (-
                  {((selectedProperty.price / 2) * 1.1).toLocaleString()}đ)
                </button>
              )}

              {/* Trade With Player */}
              <div className="pt-2">
                <p className="text-gray-400 text-xs mb-1">
                  {ti({ en: "Sell to Player", vi: "Bán cho người khác" })}
                </p>
                <div className="flex gap-1">
                  <select
                    className="flex-1 bg-slate-700 text-white text-xs rounded p-1 outline-none"
                    id="trade-player-select"
                  >
                    {state.players
                      .filter((p) => p.id && p.id !== currentUserId)
                      .map((p) => (
                        <option key={p.id} value={p.id!}>
                          {p.username}
                        </option>
                      ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Price"
                    className="w-16 bg-slate-700 text-white text-xs rounded p-1 outline-none"
                    id="trade-price-input"
                  />
                  <button
                    onClick={() => {
                      const select = document.getElementById(
                        "trade-player-select"
                      ) as HTMLSelectElement;
                      const input = document.getElementById(
                        "trade-price-input"
                      ) as HTMLInputElement;
                      const targetId = select.value;
                      const price = parseInt(input.value);
                      if (targetId && !isNaN(price) && price > 0) {
                        game.requestOfferTrade(
                          targetId,
                          selectedProperty.id,
                          price
                        );
                        setSelectedProperty(null);
                      }
                    }}
                    className="px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-xs"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Buy From Player (If owned by someone else) */}
          {!isMyProperty && ownership && ownership.ownerId !== "bank" && (
            <div className="mt-4 pt-3 border-t border-slate-600 flex flex-col gap-2">
              <p className="text-gray-400 text-xs mb-1">
                {ti({ en: "Offer to Buy", vi: "Đề nghị mua lại" })}
              </p>
              <div className="flex gap-1">
                <input
                  type="number"
                  placeholder="Price"
                  className="flex-1 bg-slate-700 text-white text-xs rounded p-1 outline-none"
                  id="buy-price-input"
                />
                <button
                  onClick={() => {
                    const input = document.getElementById(
                      "buy-price-input"
                    ) as HTMLInputElement;
                    const price = parseInt(input.value);
                    if (!isNaN(price) && price > 0) {
                      // Target is the current owner
                      game.requestOfferTrade(
                        ownership.ownerId,
                        selectedProperty.id,
                        price
                      );
                      setSelectedProperty(null);
                    }
                  }}
                  className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs"
                >
                  {ti({ en: "Send Offer", vi: "Gửi đề nghị" })}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            {isMyProperty &&
              selectedProperty.color &&
              selectedProperty.houseCost && (
                <div className="flex-1">
                  {(() => {
                    const validation = game.canBuildHouse(
                      currentUserId!,
                      selectedProperty.id
                    );
                    return (
                      <div className="flex flex-col gap-1">
                        <button
                          disabled={!validation.allowed || !isMyTurn}
                          onClick={() => {
                            if (validation.allowed && isMyTurn) {
                              game.requestBuildHouse(selectedProperty.id);
                              setSelectedProperty(null);
                            }
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                            validation.allowed && isMyTurn
                              ? "bg-green-600 hover:bg-green-500 text-white"
                              : "bg-green-900/50 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {ti({ en: "Build House", vi: "Xây nhà" })} (
                          {selectedProperty.houseCost?.toLocaleString()}đ)
                        </button>
                        {!validation.allowed && (
                          <p className="text-[10px] text-red-400 text-center leading-tight">
                            {ti(validation.reason)}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            <button
              onClick={() => setSelectedProperty(null)}
              className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm"
            >
              {ti({ en: "Close", vi: "Đóng" })}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMyProperties = () => {
    return (
      state.gamePhase === "playing" &&
      myIndex >= 0 &&
      currentUserId && (
        <div className="bg-slate-800 rounded-lg p-3">
          <h3 className="text-white font-bold mb-2 text-sm">
            {ti({ en: "My Properties", vi: "Tài sản của tôi" })}
          </h3>
          <div className="flex flex-wrap gap-1">
            {game.getPlayerProperties(currentUserId).map((prop) => {
              const space = BOARD_SPACES[prop.spaceId];
              return (
                <div
                  key={prop.spaceId}
                  className="px-2 py-1 rounded text-xs text-white cursor-pointer hover:brightness-110 transition-all"
                  style={{
                    backgroundColor: space?.color
                      ? getPropertyColorStyle(space.color)
                      : "#4B5563",
                  }}
                  onClick={() => setSelectedProperty(space || null)}
                  title={
                    (ti({
                      en: space?.name || "",
                      vi: space?.nameVi || "",
                    }) as string) || ""
                  }
                >
                  {(
                    (ti({
                      en: space?.name || "",
                      vi: space?.nameVi || "",
                    }) as string) || ""
                  ).substring(0, 8)}
                  {prop.houses > 0 && (
                    <span className="ml-1">
                      {prop.houses === 5 ? "🏨" : "🏠".repeat(prop.houses)}
                    </span>
                  )}
                </div>
              );
            })}
            {game.getPlayerProperties(currentUserId).length === 0 && (
              <p className="text-gray-400 text-xs">
                {ti({
                  en: "No properties yet",
                  vi: "Chưa có tài sản nào",
                })}
              </p>
            )}
          </div>
        </div>
      )
    );
  };

  const renderHistoryLog = () => {
    return (
      <div
        className={`bg-slate-800 rounded-lg p-2 w-full flex flex-col transition-all duration-300 ${
          isHistoryExpanded ? "h-40 lg:h-56" : "h-auto"
        }`}
      >
        <h3
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          className="text-white font-bold text-xs sticky top-0 bg-slate-800 z-10 flex items-center justify-between cursor-pointer hover:text-gray-200"
        >
          <div className="flex items-center gap-1">
            <span>{isHistoryExpanded ? "▼" : "▶"}</span>
            <span>{ti({ en: "History", vi: "Lịch sử" })}</span>
          </div>
          <span className="text-[10px] font-normal text-gray-400">
            {historyLogs?.length || 0}
          </span>
        </h3>
        {isHistoryExpanded && (
          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 font-mono custom-scrollbar mt-1">
            {(historyLogs || [])
              .slice()
              .reverse()
              .map((log) => (
                <div
                  key={log.id}
                  className={`px-1.5 py-0.5 rounded-sm border-l-2 text-[10px] leading-tight flex items-baseline ${
                    log.type === "alert"
                      ? "bg-red-900/20 border-red-500 text-red-200"
                      : log.type === "action"
                      ? "bg-blue-900/20 border-blue-500 text-blue-200"
                      : "bg-slate-700/30 border-gray-500 text-gray-400"
                  }`}
                >
                  <span className="opacity-40 mr-1.5 min-w-[38px] flex-shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })}
                  </span>
                  <span className="break-words text-left">
                    {ti(log.message)}
                  </span>
                </div>
              ))}
            {(!historyLogs || historyLogs.length === 0) && (
              <p className="text-gray-600 text-[10px] text-center italic mt-2">
                {ti({ en: "No history yet", vi: "Chưa có lịch sử" })}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTradeOffers = () => {
    // Show offers TO me or FROM me (pending)
    const myOffers = state.tradeOffers?.filter(
      (o) => o.toPlayerId === currentUserId || o.fromPlayerId === currentUserId
    );

    if (!myOffers || myOffers.length === 0) return null;

    return (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
        {myOffers.map((offer) => {
          const fromMe = offer.fromPlayerId === currentUserId;
          const otherPlayer = state.players.find(
            (p) => p.id === (fromMe ? offer.toPlayerId : offer.fromPlayerId)
          );
          const space = BOARD_SPACES[offer.propertyId];

          // Determine if it was a Buy or Sell offer
          // We need state to know who owns it, but we can infer from "fromMyself" and intent?
          // Actually, we can check property ownership in state
          const property = state.properties.find(
            (p) => p.spaceId === offer.propertyId
          );
          const isSellOffer = property?.ownerId === offer.fromPlayerId;
          const isBuyOffer = property?.ownerId === offer.toPlayerId;

          let title = ti({ en: "TRADE OFFER", vi: "LỜI MỜI GIAO DỊCH" });
          let description = "";

          if (fromMe) {
            if (isSellOffer) {
              description = `${ti({
                en: "You offered to sell",
                vi: "Bạn đề nghị bán",
              })} ${ti({ en: space?.name, vi: space?.nameVi })} ${ti({
                en: "to",
                vi: "cho",
              })} ${otherPlayer?.username}`;
            } else {
              description = `${ti({
                en: "You offered to buy",
                vi: "Bạn đề nghị mua",
              })} ${ti({ en: space?.name, vi: space?.nameVi })} ${ti({
                en: "from",
                vi: "từ",
              })} ${otherPlayer?.username}`;
            }
          } else {
            if (isSellOffer) {
              description = `${otherPlayer?.username} ${ti({
                en: "offers to sell",
                vi: "muốn bán",
              })} ${ti({ en: space?.name, vi: space?.nameVi })} ${ti({
                en: "to you",
                vi: "cho bạn",
              })}`;
            } else {
              description = `${otherPlayer?.username} ${ti({
                en: "offers to buy",
                vi: "muốn mua",
              })} ${ti({ en: space?.name, vi: space?.nameVi })} ${ti({
                en: "from you",
                vi: "từ bạn",
              })}`;
            }
          }

          return (
            <div
              key={offer.id}
              className="bg-slate-800 border-2 border-yellow-500 rounded-lg p-3 shadow-xl animate-in slide-in-from-top duration-300"
            >
              <h4 className="text-yellow-400 font-bold text-sm text-center mb-1">
                {title}
              </h4>
              <p className="text-white text-xs text-center mb-2">
                {description}
              </p>
              <p className="text-center text-green-400 font-mono font-bold mb-3">
                {offer.price.toLocaleString()}đ
              </p>

              <div className="flex gap-2 justify-center">
                {!fromMe && (
                  <button
                    onClick={() => game.requestRespondTrade(offer.id, true)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold shadow-md hover:scale-105 transition-transform"
                  >
                    {ti({ en: "ACCEPT", vi: "ĐỒNG Ý" })}
                  </button>
                )}
                <button
                  onClick={() =>
                    fromMe
                      ? game.requestCancelTrade(offer.id)
                      : game.requestRespondTrade(offer.id, false)
                  }
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium shadow-sm hover:opacity-90 transition-opacity"
                >
                  {fromMe
                    ? ti({ en: "Cancel", vi: "Hủy" })
                    : ti({ en: "DECLINE", vi: "TỪ CHỐI" })}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-2 p-0 w-full max-w-6xl mx-auto">
      {renderTradeOffers()}
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      {/* Main Board */}
      <div className="flex flex-col items-center gap-2 flex-1">
        <div className="relative bg-slate-900 rounded-lg sm:rounded-xl p-0.5 sm:p-1 shadow-2xl border-2 sm:border-4 border-slate-700 overflow-hidden w-full max-w-[95vw]">
          {/* Grid board */}
          <div
            className="grid gap-[1px] sm:gap-0.5 w-full"
            style={{
              gridTemplateColumns: "repeat(11, 1fr)",
              gridTemplateRows: "repeat(11, 1fr)",
            }}
          >
            {BOARD_SPACES.map(renderBoardSpace)}

            {/* Center area - game controls go here */}
            <div
              className="bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center overflow-auto"
              style={{
                gridRow: "2 / 11",
                gridColumn: "2 / 11",
              }}
            >
              {/* Title */}
              <h2 className="text-xs sm:text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500 mb-1 sm:mb-2">
                CỜ TỶ PHÚ
              </h2>

              {/* Game Controls */}
              {renderGameControls()}
            </div>
          </div>

          {/* Token Overlay - Smooth Movement Animation */}
          <div className="absolute inset-0 pointer-events-none z-20">
            {state.players.map((player, index) => {
              if (!player.id || player.isBankrupt) return null;
              const isCurrentPlayer = player.id === currentPlayer?.id;

              // Use cached position if rolling (prevent premature jump)
              let position = player.position;
              if (
                rolling &&
                isCurrentPlayer &&
                lastPositionsRef.current[player.id] !== undefined
              ) {
                position = lastPositionsRef.current[player.id];
              }

              const pos = getSpacePosition(position);

              // Calculate position percentage
              // Grid is 11x11. Each cell is ~9.09%
              // Center of cell is ~4.54%
              // We add small offsets based on player index to prevent overlap

              // Base center position
              let topPct = (pos.row / 11) * 100 + 4.54;
              let leftPct = (pos.col / 11) * 100 + 4.54;

              // Offset based on player index (2x2 grid within cell)
              // 0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right
              const offsetX = ((index % 2) - 0.5) * 3;
              const offsetY = (Math.floor(index / 2) - 0.5) * 3;

              return (
                <div
                  key={player.id}
                  className={`absolute w-3 h-3 sm:w-5 sm:h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${
                    isCurrentPlayer
                      ? "z-50 ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-700"
                      : "z-30"
                  }`}
                  style={{
                    top: `${topPct + offsetY}%`,
                    left: `${leftPct + offsetX}%`,
                    backgroundColor: player.color,
                  }}
                  title={player.username}
                >
                  {/* Helper avatar icon */}
                  <span className="text-[6px] sm:text-[9px] font-bold text-white drop-shadow-md select-none">
                    {player.username.charAt(0).toUpperCase()}
                  </span>

                  {/* Active Player Glow Effect */}
                  {isCurrentPlayer && (
                    <div className="absolute inset-0 rounded-full animate-ping opacity-75 bg-white" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Side Panel */}
      <div className="flex flex-col gap-4 flex-shrink-0 lg:w-64 w-full">
        {renderPlayerPanel()}
        {renderMyProperties()}
        {renderHistoryLog()}
      </div>

      {/* Property Detail Modal */}
      {renderPropertyDetail()}
    </div>
  );
}
