import type { BaseGame } from "./BaseGame";

export interface GameUIProps {
  game: BaseGame<any>;
  currentUserId?: string;
}
