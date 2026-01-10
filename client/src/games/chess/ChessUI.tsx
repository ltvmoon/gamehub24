import { useEffect, useRef, useState } from "react";
import ChessGame from "./Chess";
import type { ChessState } from "./types";
import { Chess } from "chess.js";
import { Chessground as ChessgroundApi } from "chessground";
import type { Api } from "chessground/api";
import type { Key } from "chessground/types";
import { RotateCcw, Bot } from "lucide-react";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import { useUserStore } from "../../stores/userStore";

interface ChessUIProps {
  game: ChessGame;
}

export default function ChessUI({ game }: ChessUIProps) {
  const [state, setState] = useState<ChessState>(game.getState());
  const { userId } = useUserStore();
  const boardRef = useRef<HTMLDivElement>(null);
  const chessgroundRef = useRef<Api | null>(null);

  // Sync state
  useEffect(() => {
    game.onUpdate((newState) => setState(newState));
  }, [game]);

  const myColor = game.getPlayerColor() === "w" ? "white" : "black";
  const isMyTurn = state.turn === (myColor === "white" ? "w" : "b");
  const inCheck = state.check;

  // Initialize/Update Chessground
  useEffect(() => {
    if (!boardRef.current) return;

    const config = {
      fen: state.fen,
      orientation: myColor as "white" | "black",
      turnColor: state.turn === "w" ? "white" : "black",
      movable: {
        free: false,
        color: isMyTurn ? myColor : undefined,
        dests: getValidMoves(state.fen),
      },
      events: {
        move: (orig: Key, dest: Key) => {
          game.requestMove(orig, dest);
        },
      },
      draggable: {
        enabled: true,
        showGhost: true,
      },
      highlight: {
        lastMove: true,
        check: true,
      },
      animation: {
        enabled: true,
        duration: 200,
      },
    };

    if (!chessgroundRef.current) {
      // @ts-ignore
      chessgroundRef.current = ChessgroundApi(boardRef.current, config);
    } else {
      chessgroundRef.current.set({
        fen: state.fen,
        turnColor: state.turn === "w" ? "white" : "black",
        movable: {
          free: false,
          color: isMyTurn && !state.gameOver ? myColor : undefined,
          dests: isMyTurn ? getValidMoves(state.fen) : new Map(),
        },
        check: inCheck ? (state.turn === "w" ? "white" : "black") : undefined,
        lastMove: state.lastMove
          ? [state.lastMove.from as Key, state.lastMove.to as Key]
          : undefined,
      });
    }

    return () => {
      // cleanup if needed
    };
  }, [state.fen, isMyTurn, state.gameOver, myColor]);

  // Helper to get valid moves using a temp chess instance
  const getValidMoves = (fen: string): Map<Key, Key[]> => {
    const dests = new Map<Key, Key[]>();
    if (!isMyTurn || state.gameOver) return dests;

    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });

    for (const move of moves) {
      const from = move.from as Key;
      const to = move.to as Key;
      if (!dests.has(from)) dests.set(from, []);
      dests.get(from)?.push(to);
    }
    return dests;
  };

  // PIECE SVGS Helper
  const PIECE_SVGS: Record<string, string> = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king",
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full max-w-2xl mx-auto">
      {/* Status Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex flex-col gap-1">
          {state.gameOver ? (
            <div className="text-lg font-bold">
              {state.winner ? (
                <span
                  className={
                    state.winner === (myColor === "white" ? "white" : "black")
                      ? "text-green-400"
                      : "text-red-400"
                  }
                >
                  {/* Adjust winner logic carefully. winner is 'white' or 'black' string */}
                  {state.winner ===
                  (userId === state.players.white ? "white" : "black")
                    ? "You Won!"
                    : "Opponent Won!"}
                </span>
              ) : (
                <span className="text-yellow-400">Draw!</span>
              )}
            </div>
          ) : (
            <>
              <div
                className={`text-lg font-bold ${
                  isMyTurn ? "text-primary-400" : "text-slate-400"
                }`}
              >
                {isMyTurn ? "Your Turn" : "Opponent's Turn"}
              </div>
              {inCheck && state.turn === (myColor === "white" ? "w" : "b") && (
                <div className="text-sm text-red-400 font-semibold">
                  You are in check!
                </div>
              )}
            </>
          )}
          <div className="text-xs text-slate-500">
            Playing as {myColor === "white" ? "White" : "Black"}
          </div>
        </div>

        <div className="flex gap-2">
          {!state.gameOver && !state.pendingNewGameRequest && (
            <button
              onClick={() => game.requestReset()}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              New Game
            </button>
          )}

          {state.gameOver && (
            <button
              onClick={() => game.requestReset()}
              className="px-3 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
          )}

          {!state.gameOver && !state.players.black && game.isHostUser && (
            <button
              onClick={() => game.addBot()}
              disabled={state.isBotLoading}
              className={`px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium transition-colors flex items-center gap-2 ${
                state.isBotLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {state.isBotLoading ? (
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
              {state.isBotLoading ? "Loading Bot..." : "Play vs Bot"}
            </button>
          )}
        </div>

        {/* New Game Request Handling */}
        {state.pendingNewGameRequest &&
          state.pendingNewGameRequest !== userId && (
            <div className="flex flex-col gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 absolute top-20 left-1/2 -translate-x-1/2 z-10 shadow-xl">
              <div className="text-sm text-white font-medium whitespace-nowrap">
                Opponent wants New Game
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    game.handleAction({
                      action: { type: "NEW_GAME_RESPONSE", accepted: true },
                    })
                  }
                  className="flex-1 bg-green-600 hover:bg-green-500 text-xs py-1 px-2 rounded text-white"
                >
                  Accept
                </button>
                <button
                  onClick={() =>
                    game.handleAction({
                      action: { type: "NEW_GAME_RESPONSE", accepted: false },
                    })
                  }
                  className="flex-1 bg-red-600 hover:bg-red-500 text-xs py-1 px-2 rounded text-white"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

        {state.pendingNewGameRequest &&
          state.pendingNewGameRequest === userId && (
            <div className="text-sm text-yellow-400 animate-pulse flex items-center">
              Requesting New Game...
            </div>
          )}
      </div>

      {/* Chessboard */}
      <div className="w-full max-w-xl">
        <div
          ref={boardRef}
          className="w-full aspect-square rounded-lg overflow-hidden"
          style={{ maxHeight: "min(80vh, 600px)" }}
        />
      </div>

      {/* Captured Pieces */}
      <div className="w-full flex justify-between gap-4 text-sm">
        <div className="bg-slate-800 rounded-lg p-2 flex-1">
          <div className="text-xs text-slate-400 mb-1">White captured:</div>
          <div className="flex flex-wrap gap-1">
            {state.capturedPieces.white.map((p, i) => (
              <div
                key={i}
                className={`cg-icon ${PIECE_SVGS[p.toLowerCase()]} black`}
                style={{
                  width: 20,
                  height: 20,
                  display: "inline-block",
                  backgroundSize: "contain",
                }}
              ></div>
            ))}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-2 flex-1">
          <div className="text-xs text-slate-400 mb-1">Black captured:</div>
          <div className="flex flex-wrap gap-1">
            {state.capturedPieces.black.map((p, i) => (
              <div
                key={i}
                className={`cg-icon ${PIECE_SVGS[p.toLowerCase()]} white`}
                style={{
                  width: 20,
                  height: 20,
                  display: "inline-block",
                  backgroundSize: "contain",
                }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
