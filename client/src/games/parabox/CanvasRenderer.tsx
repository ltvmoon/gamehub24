import React, { useEffect, useRef } from "react";
import type { LevelData, ParaboxState, Pos } from "./types";
import { TILE_WALL, TILE_GOAL } from "./constants";

// Neighbors check for borders/styling
const isWall = (level: LevelData, r: number, c: number) => {
  if (r < 0 || r >= level.height || c < 0 || c >= level.width) return false;
  return level.grid[r][c] === TILE_WALL;
};

interface CanvasRendererProps {
  state: ParaboxState;
  displayedLevelId: string;
  currentUserId: string;
  tileSize: number;
  width: number;
  height: number;
}

const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  state,
  displayedLevelId,
  currentUserId,
  tileSize,
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  // For FPS
  const lastTime = useRef<number>(performance.now());
  const fps = useRef<number>(0);
  const frameCount = useRef<number>(0);

  // For interpolation
  const prevPlayers = useRef<Record<string, { pos: Pos; levelId: string }>>({});
  const currentPlayers = useRef<Record<string, { pos: Pos; levelId: string }>>(
    {},
  );
  const prevBoxes = useRef<Record<string, { pos: Pos; levelId: string }>>({});
  const currentBoxes = useRef<Record<string, { pos: Pos; levelId: string }>>(
    {},
  );
  const lastUpdate = useRef<number>(performance.now());
  const MOVE_DURATION = 150;

  useEffect(() => {
    prevPlayers.current = { ...currentPlayers.current };
    currentPlayers.current = Object.fromEntries(
      Object.values(state.players).map((p) => [
        p.id,
        { pos: { ...p.pos }, levelId: p.currentLevelId },
      ]),
    );

    // Track boxes
    prevBoxes.current = { ...currentBoxes.current };
    const newBoxes: Record<string, { pos: Pos; levelId: string }> = {};
    Object.entries(state.levels).forEach(([levelId, level]) => {
      if (level.boxContents) {
        Object.entries(level.boxContents).forEach(([coord, instanceId]) => {
          const [x, y] = coord.split(",").map(Number);
          newBoxes[instanceId] = { pos: { x, y }, levelId };
        });
      }
    });
    currentBoxes.current = newBoxes;

    lastUpdate.current = performance.now();
  }, [state]);

  const drawLevel = (
    ctx: CanvasRenderingContext2D,
    levelId: string,
    x: number,
    y: number,
    size: number,
    depth: number,
    time: number,
  ) => {
    const baseLevelId = levelId.split("#")[0];
    const level = state.levels[baseLevelId];
    if (!level || depth > 3) return;

    const cellW = size / level.width;
    const cellH = size / level.height;

    // Background
    ctx.fillStyle = level.color;
    ctx.fillRect(x, y, size, size);

    // Grid (Walls & Goals first)
    level.grid.forEach((row, rowIdx) => {
      row.forEach((tile, colIdx) => {
        const tx = x + colIdx * cellW;
        const ty = y + rowIdx * cellH;

        if (tile === TILE_WALL) {
          ctx.fillStyle = "#1e293b";
          // Draw solid core first
          ctx.fillRect(tx, ty, cellW, cellH);

          const hasU = isWall(level, rowIdx - 1, colIdx);
          const hasD = isWall(level, rowIdx + 1, colIdx);
          const hasL = isWall(level, rowIdx, colIdx - 1);
          const hasR = isWall(level, rowIdx, colIdx + 1);

          ctx.strokeStyle = "rgba(255,255,255,0.1)";
          ctx.lineWidth = 1;

          if (!hasU) {
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + cellW, ty);
            ctx.stroke();
          }
          if (!hasD) {
            ctx.beginPath();
            ctx.moveTo(tx, ty + cellH);
            ctx.lineTo(tx + cellW, ty + cellH);
            ctx.stroke();
          }
          if (!hasL) {
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx, ty + cellH);
            ctx.stroke();
          }
          if (!hasR) {
            ctx.beginPath();
            ctx.moveTo(tx + cellW, ty);
            ctx.lineTo(tx + cellW, ty + cellH);
            ctx.stroke();
          }
        } else if (tile === TILE_GOAL) {
          const pulse = Math.sin(time / 200) * 0.2 + 0.8;
          ctx.fillStyle = `rgba(96, 165, 250, ${0.2 * pulse})`;
          ctx.beginPath();
          ctx.arc(
            tx + cellW / 2,
            ty + cellH / 2,
            (cellW / 4) * pulse,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      });
    });

    // Interpolation factor
    const now = performance.now();
    const t = Math.min(1, (now - lastUpdate.current) / MOVE_DURATION);

    // Boxes (Interpolated)
    Object.entries(currentBoxes.current).forEach(([instanceId, curr]) => {
      if (curr.levelId === baseLevelId) {
        const prev = prevBoxes.current[instanceId];
        let displayX = curr.pos.x;
        let displayY = curr.pos.y;

        if (prev && prev.levelId === curr.levelId) {
          displayX = prev.pos.x + (curr.pos.x - prev.pos.x) * t;
          displayY = prev.pos.y + (curr.pos.y - prev.pos.y) * t;
        }

        const tx = x + displayX * cellW;
        const ty = y + displayY * cellH;
        const innerLevelId = instanceId.split("#")[0];

        if (state.levels[innerLevelId]) {
          drawLevel(ctx, instanceId, tx, ty, cellW, depth + 1, time);
        } else {
          // Solid Box
          ctx.fillStyle = "#475569";
          ctx.fillRect(
            tx + cellW * 0.15,
            ty + cellH * 0.15,
            cellW * 0.7,
            cellH * 0.7,
          );
          // ctx.strokeStyle = "#64748b";
          ctx.strokeRect(
            tx + cellW * 0.15,
            ty + cellH * 0.15,
            cellW * 0.7,
            cellH * 0.7,
          );
        }
      }
    });

    // Players
    Object.values(state.players).forEach((player) => {
      if (player.currentLevelId === baseLevelId) {
        const prev = prevPlayers.current[player.id];
        const curr = currentPlayers.current[player.id];

        let displayX = player.pos.x;
        let displayY = player.pos.y;

        if (prev && curr && prev.levelId === curr.levelId) {
          displayX = prev.pos.x + (curr.pos.x - prev.pos.x) * t;
          displayY = prev.pos.y + (curr.pos.y - prev.pos.y) * t;
        }

        const px = x + displayX * cellW;
        const py = y + displayY * cellH;

        ctx.save();
        ctx.fillStyle = player.id === currentUserId ? "#3b82f6" : "#22c55e";
        ctx.shadowBlur = 15;
        ctx.shadowColor = ctx.fillStyle;

        ctx.beginPath();
        const r = 8;
        const w = cellW * 0.8;
        const h = cellH * 0.8;
        const rx = px + cellW * 0.1;
        const ry = py + cellH * 0.1;

        ctx.moveTo(rx + r, ry);
        ctx.arcTo(rx + w, ry, rx + w, ry + h, r);
        ctx.arcTo(rx + w, ry + h, rx, ry + h, r);
        ctx.arcTo(rx, ry + h, rx, ry, r);
        ctx.arcTo(rx, ry, rx + r, ry, r);
        ctx.fill();
        ctx.restore();

        // Eyes
        const blink = Math.sin(time / 1000) > 0.95 ? 0.1 : 1;
        ctx.fillStyle = "white";
        ctx.fillRect(
          px + cellW * 0.3,
          py + cellH * 0.35,
          cellW * 0.1,
          cellH * 0.15 * blink,
        );
        ctx.fillRect(
          px + cellW * 0.6,
          py + cellH * 0.35,
          cellW * 0.1,
          cellH * 0.15 * blink,
        );
      }
    });
  };

  const render = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    frameCount.current++;
    if (time > lastTime.current + 1000) {
      fps.current = Math.round(
        (frameCount.current * 1000) / (time - lastTime.current),
      );
      lastTime.current = time;
      frameCount.current = 0;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const baseId = displayedLevelId.split("#")[0];
    const level = state.levels[baseId];
    if (!level) return;

    const boardW = level.width * tileSize;
    const boardH = level.height * tileSize;
    const startX = (canvas.width - boardW) / 2;
    const startY = (canvas.height - boardH) / 2;

    drawLevel(ctx, displayedLevelId, startX, startY, boardW, 0, time);

    // FPS Overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.beginPath();
    ctx.roundRect(10, 10, 80, 30, 8);
    ctx.fill();

    ctx.fillStyle =
      fps.current > 55 ? "#4ade80" : fps.current > 30 ? "#fbbf24" : "#f87171";
    ctx.font = "bold 14px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${fps.current} FPS`, 50, 30);

    requestRef.current = requestAnimationFrame(render);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(render);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [state, displayedLevelId, tileSize]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="max-w-full max-h-full rounded-lg shadow-2xl"
      style={{ imageRendering: "auto" }}
    />
  );
};

export default CanvasRenderer;
