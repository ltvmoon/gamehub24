export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Linear Congruential Generator
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export interface Cell {
  x: number;
  y: number;
  walls: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
  visited: boolean;
}

export class MazeGenerator {
  private random: SeededRandom;
  private rows: number;
  private cols: number;
  public grid: Cell[][];

  constructor(rows: number, cols: number, seed: number) {
    this.rows = rows;
    this.cols = cols;
    this.random = new SeededRandom(seed);
    this.grid = this.initGrid();
  }

  private initGrid(): Cell[][] {
    const grid: Cell[][] = [];
    for (let y = 0; y < this.rows; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < this.cols; x++) {
        row.push({
          x,
          y,
          walls: { top: true, right: true, bottom: true, left: true },
          visited: false,
        });
      }
      grid.push(row);
    }
    return grid;
  }

  generate(): Cell[][] {
    const startCell = this.grid[0][0];
    this.visit(startCell);
    return this.grid;
  }

  private visit(cell: Cell) {
    cell.visited = true;

    const neighbors = this.getUnvisitedNeighbors(cell);
    while (neighbors.length > 0) {
      // Pick random neighbor
      const randomIndex = this.random.nextInt(0, neighbors.length - 1);
      const next = neighbors[randomIndex];

      // Remove walls between cell and next
      this.removeWalls(cell, next);

      // Recursive visit
      this.visit(next);

      // Refresh neighbors list (backtracking logic implicitly handled by recursion stack,
      // but we need to check if there are any *other* unvisited neighbors to continue)
      // Actually, standard recursive backtracker simply recurses.
      // The `while` loop here implements the "hunt" part locally or backtracking.
      // Wait, standard algorithm is:
      // 1. Mark current as visited
      // 2. While there are unvisited neighbors:
      //    a. Choose random unvisited neighbor
      //    b. Remove walls
      //    c. Recursively call visit(neighbor)

      // My `neighbors` array is static for this stack frame.
      // If I recurse `visit(next)`, `next` will be fully explored.
      // After return, I should check internal state again?
      // `getUnvisitedNeighbors` checks global visited state, so it's fine to call it again.
      // BUT for efficiency and correct implementation structure:

      // Refetch neighbors is safer because `visit(next)` might have visited some of *my* neighbors
      neighbors.splice(
        0,
        neighbors.length,
        ...this.getUnvisitedNeighbors(cell),
      );
    }
  }

  private getUnvisitedNeighbors(cell: Cell): Cell[] {
    const neighbors: Cell[] = [];
    const { x, y } = cell;

    // Top
    if (y > 0 && !this.grid[y - 1][x].visited)
      neighbors.push(this.grid[y - 1][x]);
    // Right
    if (x < this.cols - 1 && !this.grid[y][x + 1].visited)
      neighbors.push(this.grid[y][x + 1]);
    // Bottom
    if (y < this.rows - 1 && !this.grid[y + 1][x].visited)
      neighbors.push(this.grid[y + 1][x]);
    // Left
    if (x > 0 && !this.grid[y][x - 1].visited)
      neighbors.push(this.grid[y][x - 1]);

    return neighbors;
  }

  private removeWalls(a: Cell, b: Cell) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;

    if (dx === 1) {
      // a is right of b
      a.walls.left = false;
      b.walls.right = false;
    } else if (dx === -1) {
      // a is left of b
      a.walls.right = false;
      b.walls.left = false;
    }

    if (dy === 1) {
      // a is below b
      a.walls.top = false;
      b.walls.bottom = false;
    } else if (dy === -1) {
      // a is above b
      a.walls.bottom = false;
      b.walls.top = false;
    }
  }
}
