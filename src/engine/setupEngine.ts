/**
 * Tric-Trac Setup Engine
 *
 * HARD RULES:
 * - Dice resolved from LOWEST to HIGHEST
 * - Placement is deterministic: Black → points 1-6, White → 25-roll
 * - If lowest die target has 5 pieces → entire turn forfeited
 * - If first placement works but next die blocked → second die skipped
 * - Double → 4 placements
 * - MAX 15 pieces per player — once 15 reached, that player's setup is done
 * - Setup ends when both players have placed 15 stones
 */

import type { GameState, Player } from '../types/GameState';

const MAX_PIECES_PER_POINT = 5;
const TOTAL_PIECES = 15;

/** Get the target point for a setup die roll */
export function getSetupTarget(player: Player, dieValue: number): number {
  if (player === 'B') {
    return dieValue; // Black places on points 1-6
  } else {
    return 25 - dieValue; // White places on points 24-19
  }
}

/** Check if a point can accept another piece during setup */
export function canPlaceOnPoint(
  state: GameState,
  point: number,
  player: Player
): boolean {
  const slot = state.points[point];
  if (!slot) return true; // Empty point
  if (slot.owner !== player) {
    // Opponent point: can only place if it's a blot (1 piece)
    return slot.count === 1;
  }
  // Own point: can place up to MAX_PIECES_PER_POINT
  return slot.count < MAX_PIECES_PER_POINT;
}

/** How many pieces has this player placed? */
export function getSetupCount(state: GameState, player: Player): number {
  return player === 'B' ? state.setupCountB : state.setupCountW;
}

/** Check if a specific player has finished setup (15 pieces placed) */
export function isPlayerSetupDone(state: GameState, player: Player): boolean {
  return getSetupCount(state, player) >= TOTAL_PIECES;
}

/** Place a piece on a point during setup. Returns new state. */
export function placeSetupPiece(
  state: GameState,
  point: number,
  player: Player,
): GameState {
  const newState = { ...state, points: [...state.points] };
  const current = newState.points[point];

  if (!current) {
    newState.points[point] = { owner: player, count: 1 };
  } else if (current.owner !== player) {
    // HIT opponent's blot!
    if (current.owner === 'B') {
      newState.barB = (newState.barB || 0) + 1;
    } else {
      newState.barW = (newState.barW || 0) + 1;
    }
    newState.points[point] = { owner: player, count: 1 };
  } else {
    // Add to own stack
    newState.points[point] = { ...current, count: current.count + 1 };
  }

  if (player === 'B') {
    newState.setupCountB = newState.setupCountB + 1;
  } else {
    newState.setupCountW = newState.setupCountW + 1;
  }

  return newState;
}

/**
 * Resolve the full setup turn for the current player.
 * Returns the sequence of placements that should happen,
 * or signals forfeiture.
 */
export interface SetupResult {
  placements: number[];
  forfeited: boolean;
  forfeitReason?: string;
  remainingDice: number[];
}

export function resolveSetupTurn(
  state: GameState,
  dice: number[],
): SetupResult {
  const player = state.turn;
  const placements: number[] = [];
  const remainingDice: number[] = [];

  // If this player already has 15, skip entirely
  if (isPlayerSetupDone(state, player)) {
    return {
      placements: [],
      forfeited: false,
      remainingDice: dice,
    };
  }

  let simState = { ...state, points: [...state.points] };
  let piecesPlaced = getSetupCount(state, player);

  for (let i = 0; i < dice.length; i++) {
    // Stop if we've reached 15
    if (piecesPlaced >= TOTAL_PIECES) break;

    const dieValue = dice[i];
    const target = getSetupTarget(player, dieValue);

    if (canPlaceOnPoint(simState, target, player)) {
      placements.push(target);
      simState = placeSetupPiece(simState, target, player);
      piecesPlaced++;
    } else {
      if (i === 0) {
        // Lowest die blocked → entire turn forfeited
        return {
          placements: [],
          forfeited: true,
          forfeitReason: `Punt ${target} is vol (5 stenen). Beurt verloren!`,
          remainingDice: dice,
        };
      } else {
        // Higher die blocked → skip it
        remainingDice.push(dieValue);
      }
    }
  }

  return {
    placements,
    forfeited: false,
    remainingDice,
  };
}

/** Check if setup phase is complete (both players at 15) */
export function isSetupComplete(state: GameState): boolean {
  return state.setupCountB >= TOTAL_PIECES && state.setupCountW >= TOTAL_PIECES;
}
