/**
 * Tric-Trac Game Reducer
 * Central state management for the entire game.
 */

import type { GameState, GameAction, Player } from '../types/GameState';
import { rollDice, generateDiceSets, isDouble, isTricTrac } from './diceEngine';
import {
  getSetupTarget,
  resolveSetupTurn,
  placeSetupPiece,
  isSetupComplete,
  isPlayerSetupDone,
  canPlaceOnPoint,
} from './setupEngine';
import {
  switchTurn,
  checkWinner,
  getBarCount,
  resolveBarEntry,
  getValidMoves,
  executeMove,
  executeBarEntry,
  hasAnyValidMove,
} from './moveEngine';

/* ─── Initial state factory ─── */

export function createInitialState(): GameState {
  const points: (GameState['points'][number])[] = new Array(25).fill(null);

  return {
    screen: 'menu',
    mode: 'pvp',
    points,
    barB: 0,
    barW: 0,
    boreB: 0,
    boreW: 0,
    turn: 'B',
    phase: 'setup',
    setupCountB: 0,
    setupCountW: 0,
    rawDice: null,
    diceSets: [],
    selectedSetIndex: -1,
    remainingDice: [],
    selected: null,
    validTos: [],
    winner: null,
    msg: 'Welkom bij Tric-Trac!',
    history: [],
    isRolling: false,
    stats: {
      doubles: { B: 0, W: 0 },
      hits: { B: 0, W: 0 },
      borneOff: { B: 0, W: 0 },
    },
  };
}

/* ─── Helpers ─── */

function playerName(p: Player): string {
  return p === 'B' ? 'Zwart' : 'Wit';
}

/** Create the next-turn partial state. During setup, skips players who already have 15. */
function nextTurn(state: GameState): GameState {
  const next = switchTurn(state.turn);
  const globalPhase = isSetupComplete(state) ? 'move' : 'setup';
  
  return {
    ...state,
    turn: next,
    phase: globalPhase,
    rawDice: null,
    diceSets: [],
    selectedSetIndex: -1,
    remainingDice: [],
    selected: null,
    validTos: [],
    history: [],
    isRolling: false,
    msg: `${playerName(next)} is aan de beurt. Gooi de dobbelstenen.`,
  };
}

function handleEndOfActions(state: GameState): GameState {
  if (state.rawDice) {
    const [d1, d2] = state.rawDice;
    if (isDouble(d1, d2) || isTricTrac(d1, d2)) {
      return {
        ...state,
        rawDice: null,
        diceSets: [],
        selectedSetIndex: -1,
        remainingDice: [],
        selected: null,
        validTos: [],
        msg: `Actie voltooid! ${playerName(state.turn)} mag nogmaals gooien (Dubbel of Tric-Trac).`,
      };
    }
  }

  return nextTurn(state);
}

/* ─── Reducer ─── */

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      const s = createInitialState();
      return {
        ...s,
        screen: 'game',
        mode: action.mode,
        msg: `${playerName('B')} begint. Gooi de dobbelstenen.`,
      };
    }

    case 'ROLL_DICE': {
      const [d1, d2] = rollDice();
      const sets = generateDiceSets(d1, d2);
      const autoSelect = sets.length === 1;
      const selectedSet = autoSelect ? 0 : -1;
      const remaining = autoSelect ? [...sets[0]] : [];

      let msg = `${playerName(state.turn)} gooit: ${d1} en ${d2}.`;
      if (sets.length > 1) {
        msg += ` Kies een dobbelsteenset.`;
      }

      let newState: GameState = {
        ...state,
        rawDice: [d1, d2],
        diceSets: sets,
        selectedSetIndex: selectedSet,
        remainingDice: remaining,
        selected: null,
        validTos: [],
        history: [],
        isRolling: true,
        msg,
      };

      if (isDouble(d1, d2) || isTricTrac(d1, d2)) {
        newState.stats = {
          ...newState.stats,
          doubles: {
            ...newState.stats.doubles,
            [state.turn]: newState.stats.doubles[state.turn] + 1,
          }
        };
      }

      // Do not auto-select or resolve yet, wait for animation to end
      return newState;
    }

    case 'END_ROLL_ANIMATION': {
      const newState = { ...state, isRolling: false };
      const autoSelect = state.diceSets.length === 1;

      if (autoSelect) {
        const isSetup = !isPlayerSetupDone(newState, newState.turn);
        return isSetup ? resolveSetup(newState) : resolveMovePhaseStart(newState);
      }
      return newState;
    }

    case 'SELECT_DICE_SET': {
      const set = state.diceSets[action.index];
      if (!set) return state;

      const remaining = [...set];
      const newState: GameState = {
        ...state,
        selectedSetIndex: action.index,
        remainingDice: remaining,
        msg: `Set gekozen: [${remaining.join(', ')}]`,
      };

      const isSetup = !isPlayerSetupDone(newState, newState.turn);
      return isSetup ? resolveSetup(newState) : resolveMovePhaseStart(newState);
    }

    case 'SETUP_PLACE': {
      if (state.remainingDice.length === 0) return state;

      const player = state.turn;

      // Guard: player already has 15
      if (isPlayerSetupDone(state, player)) {
        return state;
      }

      const nextDie = state.remainingDice[0];
      const expectedTarget = getSetupTarget(player, nextDie);
      if (action.point !== expectedTarget) return state;

      const historyState = { ...state, history: [] }; // Don't nest history infinitely

      // Place the piece
      let newState = placeSetupPiece(state, action.point, player);

      // Remove used die
      const newDice = [...state.remainingDice];
      newDice.shift();
      newState = { ...newState, remainingDice: newDice, history: [...state.history, historyState] };

      // Check if this player just hit 15
      if (isPlayerSetupDone(newState, player)) {
        if (newDice.length > 0) {
          // Transition to move phase immediately for remaining dice
          return resolveMovePhaseStart({
            ...newState,
            msg: `15 stenen geplaatst! ${playerName(player)} mag nu verder met lopen.`,
          });
        }
        return handleEndOfActions(newState);
      }

      // Check if more dice remain
      if (newDice.length > 0) {
        const nextTarget = getSetupTarget(player, newDice[0]);
        const canPlace = canPlaceOnPoint(newState, nextTarget, player);

        if (!canPlace) {
          newState = {
            ...newState,
            remainingDice: [],
            msg: `Punt ${nextTarget} is vol. Resterende dobbelstenen overgeslagen.`,
          };
          // Turn forfeited (did not place all dice)
          return handleEndOfActions(newState);
        } else {
          return {
            ...newState,
            msg: `Geplaatst op punt ${action.point}. Plaats nu op punt ${nextTarget}.`,
            validTos: [nextTarget],
          };
        }
      }

      // End of turn (all dice placed successfully)
      return handleEndOfActions(newState);
    }

    case 'SELECT_POINT': {
      const player = state.turn;

      if (getBarCount(state, player) > 0) {
        return { ...state, msg: 'Je moet eerst je stenen van de bar spelen!' };
      }

      const pt = state.points[action.point];
      if (!pt || pt.owner !== player) {
        return { ...state, selected: null, validTos: [] };
      }

      const moves = getValidMoves(state, action.point, state.remainingDice);
      if (moves.length === 0) {
        return {
          ...state,
          selected: action.point,
          validTos: [],
          msg: `Geen geldige zetten vanaf punt ${action.point}.`,
        };
      }

      return {
        ...state,
        selected: action.point,
        validTos: moves,
        msg: `Punt ${action.point} geselecteerd. Kies een bestemming.`,
      };
    }

    case 'MOVE_PIECE': {
      // Allow bar entries (from === 0) and automatic bear-offs (to === 25) to bypass the selected check
      if (action.from !== 0 && action.to !== 25 && state.selected === null) return state;

      const player = state.turn;
      let dieUsed: number = -1;

      if (action.from === 0) {
        // For bar entry, the required die depends on the entry point
        dieUsed = player === 'B' ? action.to : 25 - action.to;
      } else if (action.to === 25) {
        // Bear-off: find which die authorizes this move to handle inexact matches
        for (const die of state.remainingDice) {
          const valid = getValidMoves(state, action.from, [die]);
          if (valid.includes(25)) {
            dieUsed = die;
            break;
          }
        }
        if (dieUsed === undefined || dieUsed === -1) {
          // Fallback, though getValidMoves should guarantee a match
          dieUsed = player === 'B' ? 25 - action.from : action.from;
        }
      } else {
        dieUsed = Math.abs(action.to - action.from);
      }

      const historyState = { ...state, history: [] };

      let newState;
      if (action.from === 0) {
        newState = executeBarEntry(state, action.to, dieUsed);
      } else {
        newState = executeMove(state, action.from, action.to, dieUsed);
      }

      // Track hits
      const targetPoint = newState.points[action.to];
      if (targetPoint && targetPoint.owner === player && state.points[action.to]?.owner !== player && state.points[action.to] !== null) {
        newState.stats = {
          ...newState.stats,
          hits: {
            ...newState.stats.hits,
            [player]: newState.stats.hits[player] + 1
          }
        };
      }

      // Track bear-offs
      if (action.to === 25) {
        newState.stats = {
          ...newState.stats,
          borneOff: {
            ...newState.stats.borneOff,
            [player]: newState.stats.borneOff[player] + 1
          }
        };
      }
      
      newState = { ...newState, selected: null, validTos: [], history: [...state.history, historyState] };

      const winner = checkWinner(newState);
      if (winner) {
        return {
          ...newState,
          winner,
          screen: 'gameover',
          msg: `${playerName(winner)} wint het spel!`,
        };
      }

      if (newState.remainingDice.length === 0 || !hasAnyValidMove(newState)) {
        if (newState.remainingDice.length === 0) {
          return handleEndOfActions(newState);
        } else {
          return {
            ...newState,
            ...nextTurn(newState),
            msg: 'Geen zetten meer mogelijk met de resterende dobbelstenen. Beurt voorbij.',
          };
        }
      }

      return {
        ...newState,
        msg: `Zet uitgevoerd. Resterende dobbelstenen: [${newState.remainingDice.join(', ')}]`,
      };
    }

    case 'UNDO': {
      if (action.stepsBack < 1 || action.stepsBack > state.history.length) return state;
      const targetState = state.history[state.history.length - action.stepsBack];
      return {
        ...targetState,
        history: state.history.slice(0, state.history.length - action.stepsBack),
      };
    }

    case 'END_TURN': {
      return nextTurn(state);
    }

    case 'FORFEIT_TURN': {
      return { ...nextTurn(state), msg: action.reason };
    }

    case 'RESET': {
      return createInitialState();
    }

    case 'DEV_SETUP_COMPLETE': {
      const newState = createInitialState();
      newState.mode = state.mode;
      newState.screen = 'game';
      newState.setupCountB = 15;
      newState.setupCountW = 15;
      newState.phase = 'move';
      
      // Distribute Black 1-6
      newState.points[1] = { owner: 'B', count: 3 };
      newState.points[2] = { owner: 'B', count: 3 };
      newState.points[3] = { owner: 'B', count: 3 };
      newState.points[4] = { owner: 'B', count: 2 };
      newState.points[5] = { owner: 'B', count: 2 };
      newState.points[6] = { owner: 'B', count: 2 };

      // Distribute White 24-19
      newState.points[24] = { owner: 'W', count: 3 };
      newState.points[23] = { owner: 'W', count: 3 };
      newState.points[22] = { owner: 'W', count: 3 };
      newState.points[21] = { owner: 'W', count: 2 };
      newState.points[20] = { owner: 'W', count: 2 };
      newState.points[19] = { owner: 'W', count: 2 };

      return {
        ...newState,
        msg: 'DEV: Setup voltooid. Je kunt beginnen met lopen.',
      };
    }

    case 'DEV_ENDGAME_SCENARIO': {
      const newState = createInitialState();
      newState.mode = state.mode;
      newState.screen = 'game';
      newState.setupCountB = 15;
      newState.setupCountW = 15;
      newState.phase = 'move';

      // Distribute Black 19-24 (Home board)
      newState.points[19] = { owner: 'B', count: 3 };
      newState.points[20] = { owner: 'B', count: 3 };
      newState.points[21] = { owner: 'B', count: 3 };
      newState.points[22] = { owner: 'B', count: 2 };
      newState.points[23] = { owner: 'B', count: 2 };
      newState.points[24] = { owner: 'B', count: 2 };

      // Distribute White 1-6 (Home board)
      newState.points[1] = { owner: 'W', count: 3 };
      newState.points[2] = { owner: 'W', count: 3 };
      newState.points[3] = { owner: 'W', count: 3 };
      newState.points[4] = { owner: 'W', count: 2 };
      newState.points[5] = { owner: 'W', count: 2 };
      newState.points[6] = { owner: 'W', count: 2 };

      return {
        ...newState,
        msg: 'DEV: Endgame gestart. Stenen aan de overkant.',
      };
    }

    case 'DEV_ENDGAME_3': {
      const newState = createInitialState();
      newState.mode = state.mode;
      newState.screen = 'game';
      newState.setupCountB = 15;
      newState.setupCountW = 15;
      newState.phase = 'move';
      newState.boreB = 12;
      newState.boreW = 12;

      newState.points[24] = { owner: 'B', count: 2 }; // needs 1
      newState.points[23] = { owner: 'B', count: 1 }; // needs 2
      
      newState.points[5] = { owner: 'W', count: 2 }; // needs 2
      newState.points[6] = { owner: 'W', count: 1 }; // needs 1

      return {
        ...newState,
        msg: 'DEV: Endgame (3 stenen).',
      };
    }

    case 'DEV_ENDGAME_1': {
      const newState = createInitialState();
      newState.mode = state.mode;
      newState.screen = 'game';
      newState.setupCountB = 15;
      newState.setupCountW = 15;
      newState.phase = 'move';
      newState.boreB = 14;
      newState.boreW = 14;

      newState.points[24] = { owner: 'B', count: 1 }; // needs 1
      newState.points[6] = { owner: 'W', count: 1 }; // needs 1

      return {
        ...newState,
        msg: 'DEV: Endgame (1 steen).',
      };
    }

    default:
      return state;
  }
}

/* ─── Setup resolution ─── */

function resolveSetup(state: GameState): GameState {
  const player = state.turn;

  // If player already has 15, skip setup and go to move
  if (isPlayerSetupDone(state, player)) {
    return resolveMovePhaseStart(state);
  }

  const result = resolveSetupTurn(state, state.remainingDice);

  if (result.forfeited) {
    return {
      ...nextTurn(state),
      msg: result.forfeitReason || 'Beurt verloren!',
    };
  }

  if (result.placements.length > 0) {
    return {
      ...state,
      validTos: [result.placements[0]],
      msg: `Plaats een steen op punt ${result.placements[0]}.`,
    };
  }

  // No placements possible (shouldn't happen normally)
  return nextTurn(state);
}

/* ─── Move phase start ─── */

function resolveMovePhaseStart(state: GameState): GameState {
  const player = state.turn;

  if (getBarCount(state, player) > 0) {
    const barResult = resolveBarEntry(state, state.remainingDice);

    if (barResult.forfeited) {
      return {
        ...state,
        ...nextTurn(state),
        msg: barResult.forfeitReason || 'Beurt verloren door geblokkeerde bar!',
      };
    }

    return {
      ...state,
      validTos: [barResult.entryPoint],
      msg: `Je hebt stenen op de bar. Speel eerst naar punt ${barResult.entryPoint}.`,
    };
  }

  if (!hasAnyValidMove(state)) {
    return {
      ...state,
      ...nextTurn(state),
      msg: `${playerName(player)} heeft geen geldige zetten. Beurt overgeslagen.`,
    };
  }

  return {
    ...state,
    msg: `${playerName(player)} — selecteer een steen om te verplaatsen.`,
  };
}
