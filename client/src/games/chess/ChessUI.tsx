import { useEffect, useRef, useState } from "react";
import ChessGame from "./Chess";
import type { ChessState } from "./types";
import { Chess } from "chess.js";
import { Chessground as ChessgroundApi } from "chessground";
import type { Api } from "chessground/api";
import type { Key } from "chessground/types";
import { RotateCcw, Bot, BookOpen, X } from "lucide-react";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";
import { useUserStore } from "../../stores/userStore";
import useLanguage from "../../stores/languageStore";
import type { GameUIProps } from "../types";

export default function ChessUI({ game: baseGame }: GameUIProps) {
  const game = baseGame as ChessGame;
  const [state, setState] = useState<ChessState>(game.getState());
  const { userId } = useUserStore();
  const { ti, ts } = useLanguage();
  const [showRules, setShowRules] = useState(false);
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
          // Check for promotion
          const chess = new Chess(state.fen);
          const piece = chess.get(orig as any);
          const isPromotion =
            piece?.type === "p" &&
            ((piece.color === "w" && dest[1] === "8") ||
              (piece.color === "b" && dest[1] === "1"));

          game.requestMove(orig, dest, isPromotion ? "q" : undefined);
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

  const renderGameRules = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl relative">
        <button
          onClick={() => setShowRules(false)}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-yellow-500" />
            {ti({ en: "Game Rules", vi: "Luật Chơi" })}
          </h2>

          <div className="space-y-4 text-slate-300 leading-relaxed">
            <section>
              <h3 className="text-lg font-bold text-yellow-400 mt-4">
                {ti({ en: "Objective", vi: "Mục tiêu" })}
              </h3>
              <p>
                {ti({
                  en: "Checkmate the opponent's king. White moves first.",
                  vi: "Chiếu bí vua của đối phương. Trắng đi trước.",
                })}
              </p>
            </section>

            <section>
              <h3 className="text-lg font-bold text-yellow-400 mt-4">
                {ti({ en: "Basic Rules", vi: "Quy Tắc Cơ Bản" })}
              </h3>
              <ul className="space-y-2 list-disc pl-4 text-sm">
                <li>
                  <strong>{ti({ en: "King", vi: "Vua" })}</strong>:{" "}
                  {ti({
                    en: "Moves one square in any direction.",
                    vi: "Di chuyển 1 ô theo mọi hướng.",
                  })}
                </li>
                <li>
                  <strong>{ti({ en: "Queen", vi: "Hậu" })}</strong>:{" "}
                  {ti({
                    en: "Moves diagonally, horizontally, or vertically any number of squares.",
                    vi: "Di chuyển ngang, dọc, chéo bao nhiêu ô tùy ý.",
                  })}
                </li>
                <li>
                  <strong>{ti({ en: "Rook", vi: "Xe" })}</strong>:{" "}
                  {ti({
                    en: "Moves horizontally or vertically any number of squares.",
                    vi: "Di chuyển ngang hoặc dọc bao nhiêu ô tùy ý.",
                  })}
                </li>
                <li>
                  <strong>{ti({ en: "Bishop", vi: "Tượng" })}</strong>:{" "}
                  {ti({
                    en: "Moves diagonally any number of squares.",
                    vi: "Di chuyển chéo bao nhiêu ô tùy ý.",
                  })}
                </li>
                <li>
                  <strong>{ti({ en: "Knight", vi: "Mã" })}</strong>:{" "}
                  {ti({
                    en: "Moves in an 'L' shape: two squares in one direction and then one square perpendicular to that direction.",
                    vi: "Di chuyển theo hình chữ L.",
                  })}
                </li>
                <li>
                  <strong>{ti({ en: "Pawn", vi: "Tốt" })}</strong>:{" "}
                  {ti({
                    en: "Moves forward one square (or two on the first move). Captures diagonally.",
                    vi: "Di chuyển thẳng 1 ô (hoặc 2 ở nước đầu). Ăn chéo.",
                  })}
                </li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-bold text-yellow-400 mt-4">
                {ti({ en: "Special Moves", vi: "Nước Đi Đặc Biệt" })}
              </h3>
              <ul className="space-y-2 list-disc pl-4 text-sm">
                <li>
                  {ti({
                    en: "Castling: Move the King two squares towards a Rook.",
                    vi: "Nhập thành: Di chuyển Vua 2 ô về phía Xe.",
                  })}
                </li>
                <li>
                  {ti({
                    en: "En Passant: Special pawn capture.",
                    vi: "Bắt tốt qua đường.",
                  })}
                </li>
                <li>
                  {ti({
                    en: "Promotion: Pawn reaching the other side becomes a Queen, Rook, Bishop, or Knight.",
                    vi: "Phong cấp: Tốt đi đến cuối bàn cờ được phong làm Hậu, Xe, Tượng hoặc Mã.",
                  })}
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full max-w-2xl mx-auto">
      {showRules && renderGameRules()}

      {/* Rules Button */}
      <button
        onClick={() => setShowRules(true)}
        className="fixed bottom-4 right-4 p-3 bg-slate-700 hover:bg-slate-600 rounded-full text-yellow-500 transition-colors z-40 shadow-lg border border-slate-500"
        title={ts({ en: "Rules", vi: "Luật chơi" })}
      >
        <BookOpen size={24} />
      </button>
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
                    ? ti({ en: "You Won!", vi: "Bạn thắng!" })
                    : ti({ en: "Opponent Won!", vi: "Đối thủ thắng!" })}
                </span>
              ) : (
                <span className="text-yellow-400">
                  {ti({ en: "Draw!", vi: "Hòa!" })}
                </span>
              )}
            </div>
          ) : (
            <>
              <div
                className={`text-lg font-bold ${
                  isMyTurn ? "text-primary-400" : "text-slate-400"
                }`}
              >
                {isMyTurn
                  ? ti({ en: "Your Turn", vi: "Lượt của bạn" })
                  : ti({ en: "Opponent's Turn", vi: "Lượt đối thủ" })}
              </div>
              {inCheck && state.turn === (myColor === "white" ? "w" : "b") && (
                <div className="text-sm text-red-400 font-semibold">
                  {ti({ en: "You are in check!", vi: "Bạn bị chiếu!" })}
                </div>
              )}
            </>
          )}
          <div className="text-xs text-slate-500">
            {ti({ en: "Playing as", vi: "Đang chơi với quân" })}{" "}
            {myColor === "white"
              ? ti({ en: "White", vi: "Trắng" })
              : ti({ en: "Black", vi: "Đen" })}
          </div>
        </div>

        <div className="flex gap-2">
          {!state.gameOver && !state.pendingNewGameRequest && (
            <button
              onClick={() => game.requestReset()}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {ti({ en: "New Game", vi: "Ván mới" })}
            </button>
          )}

          {state.gameOver && (
            <button
              onClick={() => game.requestReset()}
              className="px-3 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {ti({ en: "Play Again", vi: "Chơi lại" })}
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
              {state.isBotLoading
                ? ti({ en: "Loading Bot...", vi: "Đang tải Bot..." })
                : ti({ en: "Play vs Bot", vi: "Chơi với Bot" })}
            </button>
          )}
        </div>

        {/* New Game Request Handling */}
        {state.pendingNewGameRequest &&
          state.pendingNewGameRequest !== userId && (
            <div className="flex flex-col gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 absolute top-20 left-1/2 -translate-x-1/2 z-10 shadow-xl">
              <div className="text-sm text-white font-medium whitespace-nowrap">
                {ti({
                  en: "Opponent wants New Game",
                  vi: "Đối thủ muốn chơi ván mới",
                })}
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
                  {ti({ en: "Accept", vi: "Đồng ý" })}
                </button>
                <button
                  onClick={() =>
                    game.handleAction({
                      action: { type: "NEW_GAME_RESPONSE", accepted: false },
                    })
                  }
                  className="flex-1 bg-red-600 hover:bg-red-500 text-xs py-1 px-2 rounded text-white"
                >
                  {ti({ en: "Decline", vi: "Từ chối" })}
                </button>
              </div>
            </div>
          )}

        {state.pendingNewGameRequest &&
          state.pendingNewGameRequest === userId && (
            <div className="text-sm text-yellow-400 animate-pulse flex items-center">
              {ti({
                en: "Requesting New Game...",
                vi: "Đang yêu cầu ván mới...",
              })}
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
          <div className="text-xs text-slate-400 mb-1">
            {ti({ en: "White captured:", vi: "Trắng bắt:" })}{" "}
          </div>
          <div className="flex flex-wrap gap-1">
            {state.capturedPieces.white.map((p, i) => (
              <img
                key={i}
                src={`https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/b${p.toUpperCase()}.svg`}
                alt={p}
                className="w-5 h-5 object-contain"
              />
            ))}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-2 flex-1">
          <div className="text-xs text-slate-400 mb-1">
            {ti({ en: "Black captured:", vi: "Đen bắt:" })}
          </div>
          <div className="flex flex-wrap gap-1">
            {state.capturedPieces.black.map((p, i) => (
              <img
                key={i}
                src={`https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/w${p.toUpperCase()}.svg`}
                alt={p}
                className="w-5 h-5 object-contain"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
