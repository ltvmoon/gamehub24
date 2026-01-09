import { useEffect, useState } from "react";
import { TicTacToe } from "./TicTacToe";
import { type TicTacToeState } from "./types";
import { RefreshCcw, X, Circle, LogOut, Bot } from "lucide-react";
import { useRoomStore } from "../../stores/roomStore";
import { useChatStore } from "../../stores/chatStore";
import { getSocket } from "../../services/socket";
import { useNavigate, useParams } from "react-router-dom";

interface TicTacToeUIProps {
  game: TicTacToe;
}

export default function TicTacToeUI({ game }: TicTacToeUIProps) {
  const [state, setState] = useState<TicTacToeState>(game.getState());
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  // Use stores needed for leave game logic
  const { setCurrentRoom } = useRoomStore();
  const { clearMessages } = useChatStore();

  const mySymbol = game.getPlayerSymbol();
  const isMyTurn = state.currentTurn === mySymbol;
  const board = state.board;
  const winningLine = state.winningLine;
  const lastMoveIndex = state.lastMoveIndex;
  // Wait, state.winner stores "X" or "O".
  // The prompt said: state.winner === myId ? "You Won!"
  // This implies state.winner might be storing IDs in the prompt's mind, OR I need to adjust the check.
  // interacting with existing code: state.winner is "X" | "O" | null.
  // So I should check: state.winner === mySymbol

  // Prompt logic vs My Logic:
  // Prompt: state.winner === myId
  // My Logic: state.winner is symbol.
  // Correction: state.winner === mySymbol ? "You Won!" : "Opponent Won!"

  useEffect(() => {
    // Subscribe to game state updates
    game.onUpdate((state) => {
      setState(state);
    });
  }, [game]);

  const handleCellClick = (index: number) => {
    if (state.gameOver) return;
    if (state.board[index] !== null) return;
    if (!isMyTurn) return;

    game.requestMove(index);
  };

  const onSwitchTurn = () => {
    game.switchTurn();
  };

  const leaveGame = () => {
    if (roomId) {
      getSocket().emit("room:leave", { roomId });
    }
    setCurrentRoom(null);
    clearMessages();
    navigate("/");
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4 w-full max-w-sm mx-auto">
      {/* Status Header */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-xl font-bold flex items-center gap-2">
          {state.gameOver ? (
            state.winner ? (
              <span
                className={
                  state.winner === mySymbol ? "text-green-400" : "text-red-400"
                }
              >
                {state.winner === mySymbol ? "You Won!" : "Opponent Won!"}
              </span>
            ) : (
              <span className="text-yellow-400">Draw!</span>
            )
          ) : (
            <span className={isMyTurn ? "text-primary-400" : "text-slate-400"}>
              {isMyTurn ? "Your Turn" : "Opponent's Turn"}
            </span>
          )}
        </div>
        <div className="text-sm text-slate-500 flex items-center gap-4">
          <span className="flex items-center gap-1">
            <X className="w-4 h-4 text-blue-400" /> You: {mySymbol}
          </span>
          <span className="flex items-center gap-1">
            <Circle className="w-4 h-4 text-red-400" /> Opponent:{" "}
            {mySymbol === "X" ? "O" : "X"}
          </span>
        </div>

        {/* Switch Turn button - only show when board is empty */}
        {!state.gameOver &&
          state.players.O &&
          board.every((cell) => cell === null) &&
          isMyTurn && (
            <button
              onClick={onSwitchTurn}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-sm font-medium transition-colors flex items-center gap-2"
              title="Give first move to opponent"
            >
              <RefreshCcw className="w-4 h-4" />
              Give First Move
            </button>
          )}
      </div>

      {/* Bot Controls */}
      {game.isHostUser && !state.players.O && !state.gameOver && (
        <button
          onClick={() => game.addBot()}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Bot className="w-4 h-4" />
          Play vs Bot
        </button>
      )}

      {/* Game Board */}
      <div className="grid grid-cols-3 gap-2 bg-slate-800 p-3 rounded-xl relative">
        {board.map((cell, index) => {
          const isWinningCell = winningLine?.includes(index);
          const isLastMove = lastMoveIndex === index;
          const canInteract = isMyTurn && !cell && !state.gameOver;

          return (
            <button
              key={index}
              onClick={() => handleCellClick(index)}
              disabled={!canInteract}
              className={`
                w-20 h-20 sm:w-24 sm:h-24 rounded-lg flex items-center justify-center text-4xl transition-all
                border border-slate-700
                ${
                  cell
                    ? "bg-slate-700 shadow-inner"
                    : "bg-slate-750 hover:bg-slate-700"
                }
                ${isWinningCell ? "bg-green-500/20 ring-2 ring-green-500" : ""}
                ${
                  isLastMove && !isWinningCell
                    ? "bg-amber-500/20 ring-2 ring-amber-500/50"
                    : ""
                }
                ${
                  canInteract
                    ? "cursor-pointer hover:ring-2 hover:ring-primary-500/50"
                    : "cursor-default"
                }
              `}
            >
              {cell === "X" && (
                <X
                  className={`w-12 h-12 ${
                    isWinningCell ? "text-green-400" : "text-blue-400"
                  }`}
                  strokeWidth={2.5}
                />
              )}
              {cell === "O" && (
                <Circle
                  className={`w-10 h-10 ${
                    isWinningCell ? "text-green-400" : "text-red-400"
                  }`}
                  strokeWidth={2.5}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Game Over Actions */}
      {state.gameOver && (
        <div className="flex gap-3 w-full">
          <button
            onClick={() => game.requestReset()}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium transition-colors flex items-center justify-center gap-2"
          >
            Play Again
          </button>
          <button
            onClick={leaveGame}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-medium transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Close Game
          </button>
        </div>
      )}
    </div>
  );
}
