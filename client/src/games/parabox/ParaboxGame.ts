import { BaseGame } from "../BaseGame";
import type { GameAction } from "../BaseGame";
import type {
  ParaboxState,
  ParaboxAction,
  Direction,
  Pos,
  TileType,
} from "./types";
import {
  INITIAL_LEVELS,
  TILE_BOX,
  TILE_EMPTY,
  TILE_GOAL,
  TILE_WALL,
} from "./constants";

export default class ParaboxGame extends BaseGame<ParaboxState> {
  protected gameName = "parabox";

  getInitState(): ParaboxState {
    return {
      levels: JSON.parse(JSON.stringify(INITIAL_LEVELS)),
      players: {},
      winners: [],
    };
  }

  init() {
    // Initialize current player state if not exists
    this.ensurePlayerState(this.userId);
  }

  updatePlayers(players: any[]) {
    super.updatePlayers(players);
    // Ensure current player state exists even on guest
    this.ensurePlayerState(this.userId);

    if (this.isHost) {
      players.forEach((p) => this.ensurePlayerState(p.id));

      // Cleanup stale players who left the room
      const currentIds = new Set(players.map((p) => p.id));
      Object.keys(this.state.players).forEach((id) => {
        if (!currentIds.has(id)) {
          delete this.state.players[id];
        }
      });
    }
  }

  onSocketGameState(data: any) {
    super.onSocketGameState(data);
    // After receiving state from host, guest must ensure their own state still exists
    // (In case host state didn't include them yet, BUT only if they are in the player list)
    if (this.players.some((p) => p.id === this.userId)) {
      this.ensurePlayerState(this.userId);
    }
  }

  private resolveLevelId(id: string): string {
    return id.split("#")[0];
  }

  private isPlayerAt(
    levelId: string,
    x: number,
    y: number,
    excludeUserId?: string,
  ): boolean {
    return Object.values(this.state.players).some(
      (p) =>
        p.currentLevelId === levelId &&
        p.pos.x === x &&
        p.pos.y === y &&
        p.id !== excludeUserId,
    );
  }

  private ensurePlayerState(userId: string) {
    const playerRecord = this.players.find((p) => p.id === userId);
    // Only ensure state if the user is actually a player in the room
    if (!playerRecord) return;

    if (!this.state.players[userId]) {
      this.state.players[userId] = {
        id: userId,
        username: playerRecord.username || "Unknown",
        pos: { x: 3, y: 5 }, // Default start pos in root
        currentLevelId: "root",
        levelStack: [],
      };
    }
  }

  onSocketGameAction({ action }: { action: GameAction }) {
    if (!this.isHost) return;

    const pbAction = action as ParaboxAction;
    const userId = pbAction.playerId;
    this.ensurePlayerState(userId);

    if (pbAction.type === "MOVE" && pbAction.direction) {
      this.handleMove(userId, pbAction.direction);
    } else if (pbAction.type === "RESET") {
      this.handleReset(userId);
    }
  }

  private handleReset(_userId: string) {
    // Collect new player objects for the fresh state based on current room players
    const newPlayers: Record<string, any> = {};
    this.players.forEach((p) => {
      newPlayers[p.id] = {
        id: p.id,
        username: p.username || "Unknown",
        pos: { x: 3, y: 5 },
        currentLevelId: "root",
        levelStack: [],
      };
    });

    this.setState({
      levels: JSON.parse(JSON.stringify(INITIAL_LEVELS)),
      players: newPlayers,
      winners: [],
    });
  }

  public checkBlockedMove(userId: string, dir: Direction): boolean {
    return !this.handleMove(userId, dir, true);
  }

  private handleMove(userId: string, dir: Direction, dryRun = false): boolean {
    const player = this.state.players[userId];
    const level = this.state.levels[player.currentLevelId];
    if (!level) return false;

    let dx = 0,
      dy = 0;
    if (dir === "up") dy = -1;
    if (dir === "down") dy = 1;
    if (dir === "left") dx = -1;
    if (dir === "right") dx = 1;

    const nx = player.pos.x + dx;
    const ny = player.pos.y + dy;

    // Player collision check
    if (this.isPlayerAt(player.currentLevelId, nx, ny, userId)) {
      return false;
    }

    // EXIT logic
    if (nx < 0 || nx >= level.width || ny < 0 || ny >= level.height) {
      if (player.levelStack.length > 0) {
        const parent = player.levelStack[player.levelStack.length - 1];
        const parentLevel = this.state.levels[parent.levelId];
        const tx = parent.pos.x + dx;
        const ty = parent.pos.y + dy;

        // Collision check in parent level during exit
        if (this.isPlayerAt(parent.levelId, tx, ty, userId)) {
          return false;
        }

        if (
          tx < 0 ||
          tx >= parentLevel.width ||
          ty < 0 ||
          ty >= parentLevel.height ||
          parentLevel.grid[ty][tx] === TILE_WALL
        )
          return false;

        if (parentLevel.grid[ty][tx] === TILE_BOX) {
          const pushResult = this.tryPerformPush(
            parent.levelId,
            { x: tx, y: ty },
            dir,
            player.levelStack.slice(0, -1),
            dryRun,
          );
          if (!pushResult) return false;
        }

        if (!dryRun) {
          player.currentLevelId = parent.levelId;
          player.levelStack.pop();
          player.pos = { x: tx, y: ty };
        }
        return true;
      }
      return false;
    }

    const targetTile = level.grid[ny][nx];
    if (targetTile === TILE_WALL) return false;

    if (targetTile === TILE_BOX) {
      const boxId = level.boxContents?.[`${nx},${ny}`];
      const pushResult = this.tryPerformPush(
        player.currentLevelId,
        { x: nx, y: ny },
        dir,
        player.levelStack,
        dryRun,
      );
      if (pushResult) {
        if (!dryRun) player.pos = { x: nx, y: ny };
        return true;
      }

      // ENTER logic
      if (boxId && this.isEdgeEnterable(this.resolveLevelId(boxId), dir)) {
        const innerLevelId = this.resolveLevelId(boxId);
        const innerLevel = this.state.levels[innerLevelId];
        const entryPos = this.getEntryPos(innerLevelId, dir);

        const innerTargetTile = innerLevel.grid[entryPos.y][entryPos.x];
        let canEnter = false;

        if (this.isWalkableForBox(innerTargetTile)) {
          canEnter = true;
        } else if (innerTargetTile === TILE_BOX) {
          const innerPush = this.tryPerformPush(
            innerLevelId,
            entryPos,
            dir,
            [
              { levelId: player.currentLevelId, pos: { x: nx, y: ny } },
              ...player.levelStack,
            ],
            dryRun,
          );
          if (innerPush) canEnter = true;
        }

        if (canEnter) {
          if (!dryRun) {
            player.levelStack.push({
              levelId: player.currentLevelId,
              pos: { x: nx, y: ny },
            });
            player.currentLevelId = innerLevelId;
            player.pos = entryPos;
          }
          return true;
        }
      }
      return false;
    }

    // Normal move
    if (!dryRun) {
      player.pos = { x: nx, y: ny };
      this.checkWinCondition();
    }

    return true;
  }

  private checkWinCondition() {
    let allGoalsFilled = true;
    for (const level of Object.values(this.state.levels)) {
      for (let y = 0; y < level.height; y++) {
        for (let x = 0; x < level.width; x++) {
          if (level.grid[y][x] === TILE_GOAL) {
            allGoalsFilled = false;
            break;
          }
        }
        if (!allGoalsFilled) break;
      }
      if (!allGoalsFilled) break;
    }

    if (allGoalsFilled && this.state.winners.length === 0) {
      // All players win together in coop!
      this.state.winners = this.players.map((p) => p.id);
    }
  }

  private isWalkableForBox(tile: TileType) {
    return tile === TILE_EMPTY || tile === TILE_GOAL;
  }

  private getBaseTile(levelId: string, x: number, y: number): TileType {
    const baseLevelId = this.resolveLevelId(levelId);
    const original = INITIAL_LEVELS[baseLevelId].grid[y][x];
    return original === TILE_GOAL ? TILE_GOAL : TILE_EMPTY;
  }

  private isEdgeEnterable(levelId: string, dir: Direction): boolean {
    const level = this.state.levels[levelId];
    if (dir === "up")
      return level.grid[level.height - 1].some((tile) => tile !== TILE_WALL);
    if (dir === "down") return level.grid[0].some((tile) => tile !== TILE_WALL);
    if (dir === "left")
      return level.grid.some((row) => row[level.width - 1] !== TILE_WALL);
    if (dir === "right") return level.grid.some((row) => row[0] !== TILE_WALL);
    return false;
  }

  private getEntryPos(levelId: string, dir: Direction): Pos {
    const level = this.state.levels[levelId];
    let x = 0,
      y = 0;
    const midX = Math.floor(level.width / 2);
    const midY = Math.floor(level.height / 2);

    if (dir === "up") {
      x = midX;
      y = level.height - 1;
    } else if (dir === "down") {
      x = midX;
      y = 0;
    } else if (dir === "left") {
      x = level.width - 1;
      y = midY;
    } else if (dir === "right") {
      x = 0;
      y = midY;
    }

    if (level.grid[y][x] === TILE_WALL) {
      let bestX = x,
        bestY = y;
      let minBoardDist = Infinity;
      const range = dir === "up" || dir === "down" ? level.width : level.height;
      for (let i = 0; i < range; i++) {
        const checkX = dir === "up" || dir === "down" ? i : x;
        const checkY = dir === "left" || dir === "right" ? i : y;
        if (level.grid[checkY][checkX] !== TILE_WALL) {
          const dist = Math.abs(checkX - x) + Math.abs(checkY - y);
          if (dist < minBoardDist) {
            minBoardDist = dist;
            bestX = checkX;
            bestY = checkY;
          }
        }
      }
      return { x: bestX, y: bestY };
    }
    return { x, y };
  }

  private tryPerformPush(
    levelId: string,
    pos: Pos,
    dir: Direction,
    levelStack: { levelId: string; pos: Pos }[],
    dryRun = false,
  ): boolean {
    const level = this.state.levels[this.resolveLevelId(levelId)];
    if (!level) return false;
    let dx = 0,
      dy = 0;
    if (dir === "up") dy = -1;
    if (dir === "down") dy = 1;
    if (dir === "left") dx = -1;
    if (dir === "right") dx = 1;

    const nx = pos.x + dx;
    const ny = pos.y + dy;
    const currentBoxInnerId = level.boxContents?.[`${pos.x},${pos.y}`];

    // EXIT push
    if (nx < 0 || nx >= level.width || ny < 0 || ny >= level.height) {
      if (levelStack.length === 0) return false;
      const parent = levelStack[levelStack.length - 1];
      const pnx = parent.pos.x + dx;
      const pny = parent.pos.y + dy;
      const parentLevel = this.state.levels[parent.levelId];

      // Box exit collision with player
      if (this.isPlayerAt(parent.levelId, pnx, pny)) {
        return false;
      }

      if (
        pnx < 0 ||
        pnx >= parentLevel.width ||
        pny < 0 ||
        pny >= parentLevel.height
      ) {
        const result = this.tryPerformPush(
          levelId,
          pos,
          dir,
          levelStack.slice(0, -1),
          dryRun,
        );
        if (result && !dryRun) {
          level.grid[pos.y][pos.x] = this.getBaseTile(levelId, pos.x, pos.y);
          if (currentBoxInnerId) delete level.boxContents![`${pos.x},${pos.y}`];
        }
        return result;
      }

      const parentTargetTile = parentLevel.grid[pny][pnx];
      if (this.isWalkableForBox(parentTargetTile)) {
        if (!dryRun) {
          level.grid[pos.y][pos.x] = this.getBaseTile(levelId, pos.x, pos.y);
          if (currentBoxInnerId) delete level.boxContents![`${pos.x},${pos.y}`];

          parentLevel.grid[pny][pnx] = TILE_BOX;
          if (currentBoxInnerId) {
            if (!parentLevel.boxContents) parentLevel.boxContents = {};
            parentLevel.boxContents[`${pnx},${pny}`] = currentBoxInnerId;
          }
        }
        return true;
      } else if (parentTargetTile === TILE_BOX) {
        if (
          this.tryPerformPush(
            parent.levelId,
            { x: pnx, y: pny },
            dir,
            levelStack.slice(0, -1),
            dryRun,
          )
        ) {
          if (!dryRun) {
            level.grid[pos.y][pos.x] = this.getBaseTile(levelId, pos.x, pos.y);
            if (currentBoxInnerId)
              delete level.boxContents![`${pos.x},${pos.y}`];

            parentLevel.grid[pny][pnx] = TILE_BOX;
            if (currentBoxInnerId) {
              if (!parentLevel.boxContents) parentLevel.boxContents = {};
              parentLevel.boxContents[`${pnx},${pny}`] = currentBoxInnerId;
            }
          }
          return true;
        }
      }
      return false;
    }

    const targetTile = level.grid[ny][nx];
    // Box push collision with player
    if (this.isPlayerAt(levelId, nx, ny)) {
      return false;
    }

    if (this.isWalkableForBox(targetTile)) {
      if (!dryRun) {
        level.grid[ny][nx] = TILE_BOX;
        level.grid[pos.y][pos.x] = this.getBaseTile(levelId, pos.x, pos.y);
        if (currentBoxInnerId) {
          if (!level.boxContents) level.boxContents = {};
          delete level.boxContents[`${pos.x},${pos.y}`];
          level.boxContents[`${nx},${ny}`] = currentBoxInnerId;
        }
      }
      return true;
    }

    if (targetTile === TILE_BOX) {
      if (
        this.tryPerformPush(levelId, { x: nx, y: ny }, dir, levelStack, dryRun)
      ) {
        if (!dryRun) {
          level.grid[ny][nx] = TILE_BOX;
          level.grid[pos.y][pos.x] = this.getBaseTile(levelId, pos.x, pos.y);
          if (currentBoxInnerId) {
            if (!level.boxContents) level.boxContents = {};
            delete level.boxContents[`${pos.x},${pos.y}`];
            level.boxContents[`${nx},${ny}`] = currentBoxInnerId;
          }
        }
        return true;
      }

      // ENTER push
      const targetBoxInstanceId = level.boxContents?.[`${nx},${ny}`];
      if (
        targetBoxInstanceId &&
        this.isEdgeEnterable(this.resolveLevelId(targetBoxInstanceId), dir)
      ) {
        const targetBoxLevelId = this.resolveLevelId(targetBoxInstanceId);
        const innerLevel = this.state.levels[targetBoxLevelId];
        const entryPos = this.getEntryPos(targetBoxLevelId, dir);

        let canEnterPush = false;

        // Check for player collision inside the target box
        if (this.isPlayerAt(targetBoxLevelId, entryPos.x, entryPos.y)) {
          canEnterPush = false;
        } else if (
          this.isWalkableForBox(innerLevel.grid[entryPos.y][entryPos.x])
        ) {
          canEnterPush = true;
        } else if (innerLevel.grid[entryPos.y][entryPos.x] === TILE_BOX) {
          canEnterPush = this.tryPerformPush(
            targetBoxLevelId,
            entryPos,
            dir,
            [{ levelId, pos: { x: nx, y: ny } }, ...levelStack],
            dryRun,
          );
        }

        if (canEnterPush) {
          if (!dryRun) {
            level.grid[pos.y][pos.x] = this.getBaseTile(levelId, pos.x, pos.y);
            if (currentBoxInnerId)
              delete level.boxContents![`${pos.x},${pos.y}`];

            innerLevel.grid[entryPos.y][entryPos.x] = TILE_BOX;
            if (currentBoxInnerId) {
              if (!innerLevel.boxContents) innerLevel.boxContents = {};
              innerLevel.boxContents[`${entryPos.x},${entryPos.y}`] =
                currentBoxInnerId;
            }
          }
          return true;
        }
      }
    }

    return false;
  }
}
