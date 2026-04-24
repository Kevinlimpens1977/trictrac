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
export const BOTTOM_BASE = 423;
export const BOTTOM_TIP = 255;
export const TOP_BASE = 70;
export const TOP_TIP = 238;

/** Piece dimensions: 5 pieces span base→tip = (423-255) = 168, radius = 16.8 -> 17 */
export const PIECE_RADIUS = 16;
export const PIECE_DIAMETER = PIECE_RADIUS * 2;

/** Left field triangle centers (left to right) — exact pixel centers */
const LF = [154, 211.4, 268.7, 326, 383.4, 440.7];
/** Right field triangle centers (left to right) — exact pixel centers */
const RF = [535.3, 592.6, 650, 707.3, 764.7, 822];

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
    x: 353,
    y: 254,
    w: 34,
    h: 360,
  },

  trayLeft: {
    x: 40,
    y: 254,
    w: 40,
    h: 509,
  },

  trayRight: {
    x: 640,
    y: 254,
    w: 40,
    h: 509,
  },
};
