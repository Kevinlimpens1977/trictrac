/**
 * Tric-Trac Move Engine
 *
 * Movement rules:
 * - Black moves 1 → 24, White moves 24 → 1
 * - Legal landing: empty, own stack, opponent blot (hit)
 * - Blocked: 2+ opponent pieces
 * - Bear-off only when all pieces in home board and bar empty
 *
 * BAR RULE (CRITICAL — overrides all other logic):
 * - If player has ≥1 piece on bar: MUST re-enter first
 * - Must use LOWEST die first for re-entry
 * - If lowest die entry is blocked → ENTIRE TURN FORFEITED
 * - Cannot use higher die first, cannot skip bar
 */

import type { GameState, Player, PointState } from '../types/GameState';

/* ─── Constants ─── */
const BEAR_OFF_POINT = 25; // Virtual "off the board" destination

/* ─── Direction helpers ─── */

export function getMoveDirection(player: Player): number {
  return player === 'B' ? 1 : -1;
}

export function getEntryPoint(player: Player, dieValue: number): number {
  return player === 'B' ? dieValue : 25 - dieValue;
}

export function getHomeRange(player: Player): [number, number] {
  return player === 'B' ? [19, 24] : [1, 6];
}

export function getBarCount(state: GameState, player: Player): number {
  return player === 'B' ? state.barB : state.barW;
}

/* ─── Point queries ─── */

export function isOwnPoint(point: PointState | null, player: Player): boolean {
  return point !== null && point.owner === player;
}

export function isBlot(point: PointState | null, player: Player): boolean {
  return point !== null && point.owner !== player && point.count === 1;
}

export function isBlocked(point: PointState | null, player: Player): boolean {
  return point !== null && point.owner !== player && point.count >= 2;
}

export function canLandOn(state: GameState, pointIndex: number, player: Player): boolean {
  if (pointIndex < 1 || pointIndex > 24) return false;
  const pt = state.points[pointIndex];
  if (!pt) return true; // empty
  if (pt.owner === player) return true; // own stack
  if (pt.count === 1) return true; // blot — can hit
  return false; // blocked
}

/* ─── Bar Logic ─── */

export interface BarResult {
  canEnter: boolean;
  entryPoint: number;
  forfeited: boolean;
  forfeitReason?: string;
}

/**
 * Attempt bar re-entry with the lowest die.
 * If blocked → entire turn is forfeited.
 */
export function resolveBarEntry(
  state: GameState,
  dice: number[],
): BarResult {
  const player = state.turn;
  const firstDie = dice[0];
  const entryPoint = getEntryPoint(player, firstDie);

  if (isBlocked(state.points[entryPoint], player)) {
    return {
      canEnter: false,
      entryPoint,
      forfeited: true,
      forfeitReason: `Punt ${entryPoint} is geblokkeerd. Verplichte dobbelsteen ${firstDie} kan niet worden gespeeld — beurt verloren!`,
    };
  }

  return {
    canEnter: true,
    entryPoint,
    forfeited: false,
  };
}

export function executeBarEntry(
  state: GameState,
  entryPoint: number,
  dieUsed: number,
): GameState {
  const player = state.turn;
  const newState = {
    ...state,
    points: [...state.points],
  };

  const diceArr = [...state.remainingDice];
  const idx = diceArr.indexOf(dieUsed);
  if (idx !== -1) {
    diceArr.splice(idx, 1);
  }
  newState.remainingDice = diceArr;

  // Decrease bar count
  if (player === 'B') {
    newState.barB = state.barB - 1;
  } else {
    newState.barW = state.barW - 1;
  }

  // Handle landing
  const targetPt = state.points[entryPoint];
  if (targetPt && isBlot(targetPt, player)) {
    // Hit opponent — send to bar
    if (targetPt.owner === 'B') {
      newState.barB = (newState.barB || 0) + 1;
    } else {
      newState.barW = (newState.barW || 0) + 1;
    }
    newState.points[entryPoint] = { owner: player, count: 1 };
  } else if (!targetPt) {
    newState.points[entryPoint] = { owner: player, count: 1 };
  } else {
    newState.points[entryPoint] = { ...targetPt, count: targetPt.count + 1 };
  }

  return newState;
}

/* ─── Normal movement ─── */

/**
 * Calculate destination point for a move.
 * Returns the point index or BEAR_OFF_POINT if bearing off.
 */
export function getDestination(player: Player, from: number, dieValue: number): number {
  const dir = getMoveDirection(player);
  return from + dir * dieValue;
}

export function getValidMoves(
  state: GameState,
  from: number,
  dice: number[],
): number[] {
  const player = state.turn;

  // If on bar, no normal moves allowed
  if (getBarCount(state, player) > 0) return [];

  const valid: number[] = [];
  if (dice.length === 0) return [];

  const die = dice[0];

  // Check strict Tric-Trac bear-off
  if (canBearOff(state, player)) {
    // Black's home is 19-24. Roll 1 -> 24 (LF[0]), Roll 6 -> 19 (LF[5]). 
    // White's home is 1-6. Roll 6 -> 1 (LF[0]), Roll 1 -> 6 (LF[5]).
    const requiredPoint = player === 'B' ? 25 - die : 7 - die;
    
    if (from === requiredPoint) {
      valid.push(BEAR_OFF_POINT);
    }
    // Strict Tric-Trac rules: NO WALKING in the end board!
    // You can only bear off pieces. If no bear off is possible, the die cannot be used on this piece.
    return valid;
  }

  const dest = getDestination(player, from, die);

  // Normal move
  if (dest >= 1 && dest <= 24 && canLandOn(state, dest, player)) {
    valid.push(dest);
  }

  return valid;
}

/**
 * Execute a normal move from one point to another.
 */
export function executeMove(
  state: GameState,
  from: number,
  to: number,
  dieUsed: number,
): GameState {
  const player = state.turn;
  const newState = {
    ...state,
    points: [...state.points],
  };

  // Remove piece from source
  const srcPt = state.points[from];
  if (srcPt && srcPt.count > 1) {
    newState.points[from] = { ...srcPt, count: srcPt.count - 1 };
  } else {
    newState.points[from] = null;
  }

  // Handle bear-off
  if (to === BEAR_OFF_POINT) {
    if (player === 'B') {
      newState.boreB = state.boreB + 1;
    } else {
      newState.boreW = state.boreW + 1;
    }
  } else {
    // Handle landing
    const destPt = state.points[to];
    if (destPt && isBlot(destPt, player)) {
      // Hit opponent
      if (destPt.owner === 'B') {
        newState.barB = (newState.barB || 0) + 1;
      } else {
        newState.barW = (newState.barW || 0) + 1;
      }
      newState.points[to] = { owner: player, count: 1 };
    } else if (!destPt) {
      newState.points[to] = { owner: player, count: 1 };
    } else {
      newState.points[to] = { ...destPt, count: destPt.count + 1 };
    }
  }

  // Remove used die
  const diceArr = [...state.remainingDice];
  const idx = diceArr.indexOf(dieUsed);
  if (idx !== -1) diceArr.splice(idx, 1);
  newState.remainingDice = diceArr;

  return newState;
}

/* ─── Bear-off ─── */

export function canBearOff(state: GameState, player: Player): boolean {
  // No pieces on bar
  if (getBarCount(state, player) > 0) return false;

  const [homeStart, homeEnd] = getHomeRange(player);

  // All pieces must be in home board
  for (let i = 1; i <= 24; i++) {
    const pt = state.points[i];
    if (pt && pt.owner === player) {
      if (i < homeStart || i > homeEnd) return false;
    }
  }

  return true;
}

/* ─── Win check ─── */

export function checkWinner(state: GameState): Player | null {
  if (state.boreB >= 15) return 'B';
  if (state.boreW >= 15) return 'W';
  return null;
}

/* ─── Turn helpers ─── */

export function switchTurn(player: Player): Player {
  return player === 'B' ? 'W' : 'B';
}

/**
 * Check if the current player has any valid moves at all.
 */
export function hasAnyValidMove(state: GameState): boolean {
  const player = state.turn;
  const dice = state.remainingDice;

  if (dice.length === 0) return false;

  // If on bar, check bar entry
  if (getBarCount(state, player) > 0) {
    const entry = getEntryPoint(player, dice[0]);
    return canLandOn(state, entry, player);
  }

  // Check all own points for valid moves
  for (let i = 1; i <= 24; i++) {
    const pt = state.points[i];
    if (pt && pt.owner === player) {
      const moves = getValidMoves(state, i, dice);
      if (moves.length > 0) return true;
    }
  }

  return false;
}
