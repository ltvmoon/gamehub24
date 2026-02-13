export type TileType = number; // 0: empty, 1: wall, 2: box, 3: goal

export interface Pos {
  x: number;
  y: number;
}

export interface LevelData {
  id: string;
  width: number;
  height: number;
  grid: TileType[][];
  boxContents?: Record<string, string>; // Maps grid coordinate "x,y" to levelId
  color: string;
}

export interface PlayerState {
  id: string;
  username: string;
  pos: Pos;
  currentLevelId: string;
  levelStack: { levelId: string; pos: Pos }[];
}

export interface ParaboxState {
  levels: Record<string, LevelData>;
  players: Record<string, PlayerState>;
  winners: string[];
}

export type Direction = "up" | "down" | "left" | "right";

export interface ParaboxAction {
  type: "MOVE" | "RESET";
  direction?: Direction;
  playerId: string;
}
