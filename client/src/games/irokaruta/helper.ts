// ============================================================
// Color utilities — CMYK+W subtractive mixing
// ============================================================

import type { ColorCard, RGB } from "./types";

/** Check if a color is white [255, 255, 255] */
function isWhite(c: RGB): boolean {
  return c[0] === 255 && c[1] === 255 && c[2] === 255;
}

/** Multiply-blend two RGB colors (subtractive ink mixing) */
export function multiplyBlend(c1: RGB, c2: RGB): RGB {
  return [
    Math.round((c1[0] * c2[0]) / 255),
    Math.round((c1[1] * c2[1]) / 255),
    Math.round((c1[2] * c2[2]) / 255),
  ];
}

/** Apply opacity: lerp from white toward the color (transparent ink density) */
export function applyOpacity(c: RGB, opacity: number): RGB {
  return [
    Math.round(255 + (c[0] - 255) * opacity),
    Math.round(255 + (c[1] - 255) * opacity),
    Math.round(255 + (c[2] - 255) * opacity),
  ];
}

/**
 * Blend cards with CMYK+W logic:
 * - CMY+K cards → multiply blend (subtractive, darkens)
 * - White cards → lighten (lerp toward white, creates tints/pastels)
 */
export function blendCardsWithOpacity(cards: ColorCard[]): RGB {
  if (cards.length === 0) return [255, 255, 255];

  const inkCards = cards.filter((c) => !isWhite(c.color));
  const whiteCards = cards.filter((c) => isWhite(c.color));

  // Step 1: Multiply blend ink cards (CMY+K) on white base
  let result: RGB = [255, 255, 255];
  for (const card of inkCards) {
    const effective = applyOpacity(card.color, card.opacity);
    result = multiplyBlend(result, effective);
  }

  // Step 2: White cards lighten toward white (tint effect)
  for (const card of whiteCards) {
    result = [
      Math.round(result[0] + (255 - result[0]) * card.opacity),
      Math.round(result[1] + (255 - result[1]) * card.opacity),
      Math.round(result[2] + (255 - result[2]) * card.opacity),
    ];
  }

  return result;
}

/** Euclidean distance between two RGB colors, normalised to 0–100% similarity */
export function colorSimilarity(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  const dist = Math.sqrt(dr * dr + dg * dg + db * db);
  const maxDist = 441.67; // √(3 × 255²)
  return Math.round(Math.max(0, (1 - dist / maxDist) * 100));
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function rgbStr(c: RGB): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function rgbaStr(c: RGB, a: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const frac = Math.floor((ms % 1000) / 100);
  return m > 0
    ? `${m}:${String(sec).padStart(2, "0")}.${frac}`
    : `${sec}.${frac}s`;
}
