/**
 * Tric-Trac AI Engine
 *
 * Simple deterministic AI that controls White in PvA mode.
 * - Always picks FIRST available dice set
 * - Moves from lowest index first
 * - No strategy, purely mechanical
 * - Uses small delays for human-like feel
 */

import type { GameState, GameAction } from '../types/GameState';
import {
  getBarCount,
  getValidMoves,
  getEntryPoint,
  canLandOn,
} from './moveEngine';

import { isPlayerSetupDone } from './setupEngine';

const AI_DELAY = 600; // ms between actions

/**
 * Determine the next AI action based on current state.
 * Returns null if no action needed (not AI's turn).
 */
export function getNextAIAction(state: GameState): GameAction | null {
  // Only act when it's White's turn in PvA mode
  if (state.mode !== 'pva' || state.turn !== 'W') return null;
  if (state.screen !== 'game') return null;

  // Step 1: Need to roll dice
  if (!state.rawDice) {
    return { type: 'ROLL_DICE' };
  }

  // Step 2: Need to select dice set
  if (state.diceSets.length > 1 && state.selectedSetIndex === -1) {
    return { type: 'SELECT_DICE_SET', index: 0 }; // Always pick first set
  }

  const isSetup = !isPlayerSetupDone(state, state.turn);

  // Step 3: Setup phase — click the valid target
  if (isSetup && state.validTos.length > 0) {
    return { type: 'SETUP_PLACE', point: state.validTos[0] };
  }

  // Step 4: Move phase
  if (!isSetup && state.remainingDice.length > 0) {
    const player = state.turn;

    // If on bar, handle bar entry
    if (getBarCount(state, player) > 0) {
      const entryPt = getEntryPoint(player, state.remainingDice[0]);
      if (canLandOn(state, entryPt, player)) {
        return { type: 'MOVE_PIECE', from: 0, to: entryPt };
      }
      return { type: 'FORFEIT_TURN', reason: 'Bar is geblokkeerd!' };
    }

    // Normal moves: find first piece with valid move (lowest index)
    for (let i = 1; i <= 24; i++) {
      const pt = state.points[i];
      if (pt && pt.owner === player) {
        const moves = getValidMoves(state, i, state.remainingDice);
        if (moves.length > 0) {
          // If already selected, move
          if (state.selected === i && state.validTos.length > 0) {
            return { type: 'MOVE_PIECE', from: i, to: state.validTos[0] };
          }
          // First select the point
          return { type: 'SELECT_POINT', point: i };
        }
      }
    }

    // No valid moves, end turn
    return { type: 'END_TURN' };
  }

  return null;
}

/**
 * Start the AI loop. Calls dispatch with delays.
 * Returns a cleanup function to cancel.
 */
export function startAILoop(
  getState: () => GameState,
  dispatch: (action: GameAction) => void,
): () => void {
  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout>;

  function tick() {
    if (cancelled) return;

    const state = getState();
    const action = getNextAIAction(state);

    if (action) {
      dispatch(action);
    }

    // Keep ticking while it's AI's turn
    if (!cancelled && state.screen === 'game') {
      timeoutId = setTimeout(tick, AI_DELAY);
    }
  }

  timeoutId = setTimeout(tick, AI_DELAY);

  return () => {
    cancelled = true;
    clearTimeout(timeoutId);
  };
}
