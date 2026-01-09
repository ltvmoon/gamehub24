import { Socket } from "socket.io-client";
import { BaseGame } from "./BaseGame";
import { TicTacToe } from "./tictactoe/TicTacToe";
import { Caro } from "./caro/Caro";
import { Grid3x3, Crown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ChessGame } from "./chess/Chess";

export interface GameModule {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon; // Lucide icon component
  minPlayers: number;
  maxPlayers: number;
  isAvailable: boolean;
  createGame: (
    roomId: string,
    socket: Socket,
    isHost: boolean,
    userId: string,
    players: { id: string; username: string }[]
  ) => BaseGame;
}

// Game Registry
const games: Map<string, GameModule> = new Map();

// Register Tic Tac Toe
games.set("tictactoe", {
  id: "tictactoe",
  name: "Tic Tac Toe",
  description: "Classic 3x3 grid game. Get three in a row to win!",
  icon: Grid3x3, // Changed from Circle to Grid3x3 as Circle was not imported
  minPlayers: 1,
  maxPlayers: 2,
  isAvailable: true,
  createGame: (roomId, socket, isHost, userId, players) => {
    return new TicTacToe(roomId, socket, isHost, userId, players);
  },
});

// Register Caro (Gomoku)
games.set("caro", {
  id: "caro",
  name: "Caro (Gomoku)",
  description: "Get 5 in a row on a larger board. More strategic!",
  icon: Grid3x3,
  minPlayers: 1,
  maxPlayers: 2,
  isAvailable: true,
  createGame: (roomId, socket, isHost, userId, players) => {
    return new Caro(roomId, socket, isHost, userId, players);
  },
});

// Register Chess
games.set("chess", {
  id: "chess",
  name: "Chess",
  description: "Strategic board game. Checkmate your opponent!",
  icon: Crown,
  minPlayers: 1,
  maxPlayers: 2,
  isAvailable: true,
  createGame: (roomId, socket, isHost, userId, players) => {
    return new ChessGame(roomId, socket, isHost, userId, players);
  },
});

// Registry functions
export const getGame = (gameType: string): GameModule | undefined => {
  return games.get(gameType);
};

export const getAllGames = (): GameModule[] => {
  return Array.from(games.values());
};

export const registerGame = (module: GameModule): void => {
  games.set(module.id, module);
};
