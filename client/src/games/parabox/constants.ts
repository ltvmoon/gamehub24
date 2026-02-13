import type { LevelData, TileType } from "./types";

export const TILE_SIZE = 80;
export const ANIMATION_DURATION = 400;
export const MOVE_DURATION = 150;

export const TILE_EMPTY = 0;
export const TILE_WALL = 1;
export const TILE_BOX = 2;
export const TILE_GOAL = 3;

export const parseGrid = (layout: string): TileType[][] => {
  const lines = layout
    .trim()
    .split("\n")
    .map((line) => line.trim());
  const len = Math.max(...lines.map((line) => line.length));

  return lines.map((line) => {
    let chars = line.split("");
    while (chars.length < len) chars.push(" ");

    return chars.map((char) => {
      switch (char) {
        case "#":
        case "*":
          return TILE_WALL;
        case "b":
          return TILE_BOX;
        case "g":
          return TILE_GOAL;
        case "o":
        default:
          return TILE_EMPTY;
      }
    });
  });
};

export const INITIAL_LEVELS: Record<string, LevelData> = {
  root: {
    id: "root",
    width: 7,
    height: 7,
    color: "#0f172a",
    grid: parseGrid(`
      *******
      *     *
      * b b *
      *  g  *
      *  b  *
      *     *
      *******
    `),
    boxContents: {
      "2,2": "inner-1#root-1",
      "4,2": "inner-2#root-1",
      "3,4": "void#root-1",
    },
  },
  "inner-1": {
    id: "inner-1",
    width: 5,
    height: 5,
    color: "#1e293b",
    grid: parseGrid(`
      * ***

      * b *
      *   *
      ** **
    `),
    boxContents: {
      "2,2": "root#inner-1-1", // Paradox loop
    },
  },
  "inner-2": {
    id: "inner-2",
    width: 5,
    height: 5,
    color: "#334155",
    grid: parseGrid(`
      ** **
      *g  *
      0 b 0
      *   *
      ** **
    `),
    boxContents: {
      "2,2": "pocket#inner-2-1",
    },
  },
  pocket: {
    id: "pocket",
    width: 3,
    height: 3,
    color: "#475569",
    grid: parseGrid(`
      ***
      0g0
      ***
    `),
  },
  void: {
    id: "void",
    width: 9,
    height: 9,
    color: "#020617",
    grid: parseGrid(`
      *********
      *       *
      * b   b *
      *   g   *
      0       0
      * b   b *
      *       *
      *       *
      *********
    `),
    boxContents: {
      "2,2": "inner-1#void-1",
      "6,2": "inner-2#void-1",
      "2,5": "pocket#void-1",
      "6,5": "root#void-1",
    },
  },
};
