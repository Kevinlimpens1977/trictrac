/* ─── Core Game State Types ─── */

export type Player = 'B' | 'W';
export type Screen = 'menu' | 'game' | 'gameover';
export type Phase = 'setup' | 'move';
export type GameMode = 'pvp' | 'pva';

/** A single point on the board. null = empty, otherwise owner + count */
export interface PointState {
  owner: Player;
  count: number;
}

export interface GameState {
  screen: Screen;
  mode: GameMode;

  /** 25 slots: index 0 unused, 1-24 are points */
  points: (PointState | null)[];

  barB: number;
  barW: number;
  boreB: number;
  boreW: number;

  turn: Player;
  phase: Phase;

  /** Number of pieces placed by each player during setup */
  setupCountB: number;
  setupCountW: number;

  /** Raw dice roll [d1, d2] before expansion */
  rawDice: [number, number] | null;

  /** Generated dice sets to choose from */
  diceSets: number[][];

  /** Index of chosen dice set (-1 = not yet chosen) */
  selectedSetIndex: number;

  /** Remaining dice values in the active set */
  remainingDice: number[];

  /** Currently selected point (for move phase) */
  selected: number | null;

  /** Valid destination points for current selection */
  validTos: number[];

  winner: Player | null;
  msg: string;

  /** History of states during the current turn, used for undoing moves. */
  history: GameState[];
  /** Flag to indicate if dice are currently rolling (animation state) */
  isRolling: boolean;

  /** Stats for the gameover screen */
  stats: {
    doubles: { B: number; W: number };
    hits: { B: number; W: number };
    borneOff: { B: number; W: number };
  };
}

/* ─── Actions ─── */

export type GameAction =
  | { type: 'START_GAME'; mode: GameMode }
  | { type: 'ROLL_DICE' }
  | { type: 'END_ROLL_ANIMATION' }
  | { type: 'SELECT_DICE_SET'; index: number }
  | { type: 'SETUP_PLACE'; point: number }
  | { type: 'SELECT_POINT'; point: number }
  | { type: 'MOVE_PIECE'; from: number; to: number }
  | { type: 'BEAR_OFF'; from: number }
  | { type: 'UNDO'; stepsBack: number }
  | { type: 'END_TURN' }
  | { type: 'FORFEIT_TURN'; reason: string }
  | { type: 'RESET' }
  | { type: 'DEV_SETUP_COMPLETE' }
  | { type: 'DEV_ENDGAME_SCENARIO' }
  | { type: 'DEV_ENDGAME_3' }
  | { type: 'DEV_ENDGAME_1' };
