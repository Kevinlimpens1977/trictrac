import type { BoardLayout } from '../types/BoardLayout';

/**
 * Board layout in PIXEL coordinates matching bord.png (5504×3072).
 *
 * MIRRORED numbering:
 *   Bottom-left (1-6) → Bottom-right (7-12) → Top-right (13-18) → Top-left (19-24)
 *
 * Triangle measurements from careful pixel analysis:
 *   Left field:   x 680–2620,  6 triangles, width ≈323px each
 *   Right field:  x 2830–4770, 6 triangles, width ≈323px each
 *   Bottom base:  y ≈ 2900
 *   Bottom tip:   y ≈ 1660
 *   Top base:     y ≈ 170
 *   Top tip:      y ≈ 1410
 */

export const IMG_W = 976;
export const IMG_H = 509;

/** Triangle vertical boundaries */
export const BOTTOM_BASE = 415;
export const BOTTOM_TIP = 264;
export const TOP_BASE = 78; // Moved up to match the green line
export const TOP_TIP = 245;

/** Piece dimensions: 5 pieces span base→tip = (423-255) = 168, radius = 16.8 -> 17 */
export const PIECE_RADIUS = 16;
export const PIECE_DIAMETER = PIECE_RADIUS * 2;

/** Helper to calculate 6 exact centers between startX and endX */
const centers = (startX: number, endX: number, count = 6) => {
  const width = (endX - startX) / count;
  return Array.from({ length: count }, (_, i) => startX + width / 2 + i * width);
};

/** Left field: x 85 to 328 (calculated visually for perfect centering) */
const LF = centers(85, 328);

/** Right field: x 372 to 615 originally, but physical rightmost 4 triangles are painted narrower. 
 *  We use 40.5 step for the first two, and 38.5 step (-2px) for the remaining four.
 */
const startRF = 372 + (243 / 6) / 2; // 392.25
const RF = [
  startRF,
  startRF + 40.5,
  startRF + 40.5 + 38.5,
  startRF + 40.5 + 38.5 * 2,
  startRF + 40.5 + 38.5 * 3,
  startRF + 40.5 + 38.5 * 4,
];

export const BOARD_LAYOUT: BoardLayout = {
  aspectRatio: IMG_W / IMG_H,

  points: [
    // ── Bottom-Left: Points 1-6 (left to right) ──
    { id: 1,  x: LF[0], yBase: BOTTOM_BASE, isTop: false },
    { id: 2,  x: LF[1], yBase: BOTTOM_BASE, isTop: false },
    { id: 3,  x: LF[2], yBase: BOTTOM_BASE, isTop: false },
    { id: 4,  x: LF[3], yBase: BOTTOM_BASE, isTop: false },
    { id: 5,  x: LF[4], yBase: BOTTOM_BASE, isTop: false },
    { id: 6,  x: LF[5], yBase: BOTTOM_BASE, isTop: false },

    // ── Bottom-Right: Points 7-12 (left to right) ──
    { id: 7,  x: RF[0], yBase: BOTTOM_BASE, isTop: false },
    { id: 8,  x: RF[1], yBase: BOTTOM_BASE, isTop: false },
    { id: 9,  x: RF[2], yBase: BOTTOM_BASE, isTop: false },
    { id: 10, x: RF[3], yBase: BOTTOM_BASE, isTop: false },
    { id: 11, x: RF[4], yBase: BOTTOM_BASE, isTop: false },
    { id: 12, x: RF[5], yBase: BOTTOM_BASE, isTop: false },

    // ── Top-Right: Points 13-18 (right to left) ──
    { id: 13, x: RF[5], yBase: TOP_BASE, isTop: true },
    { id: 14, x: RF[4], yBase: TOP_BASE, isTop: true },
    { id: 15, x: RF[3], yBase: TOP_BASE, isTop: true },
    { id: 16, x: RF[2], yBase: TOP_BASE, isTop: true },
    { id: 17, x: RF[1], yBase: TOP_BASE, isTop: true },
    { id: 18, x: RF[0], yBase: TOP_BASE, isTop: true },

    // ── Top-Left: Points 19-24 (right to left) ── White's home
    { id: 19, x: LF[5], yBase: TOP_BASE, isTop: true },
    { id: 20, x: LF[4], yBase: TOP_BASE, isTop: true },
    { id: 21, x: LF[3], yBase: TOP_BASE, isTop: true },
    { id: 22, x: LF[2], yBase: TOP_BASE, isTop: true },
    { id: 23, x: LF[1], yBase: TOP_BASE, isTop: true },
    { id: 24, x: LF[0], yBase: TOP_BASE, isTop: true },
  ],

  bar: {
    x: 344,
    y: 254.5,
    w: 12, // 356 - 344 = 12
    h: 353,
  },

  trayLeft: {
    x: 28,
    y: 254.5,
    w: 56, // 0 to 57 approx
    h: 509,
  },

  trayRight: {
    x: 774, // Center of 643 to 905
    y: 254.5,
    w: 262, // 905 - 643 = 262
    h: 509,
  },
};
