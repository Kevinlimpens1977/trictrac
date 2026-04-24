/**
 * Tric-Trac Dice Engine
 *
 * Three cases:
 *
 * 1. Normal roll (d1 ≠ d2, not 1+2):
 *    Single set with 2 values [low, high] — must play low first.
 *
 * 2. Double (d1 == d2):
 *    Two sets to choose from:
 *    - Set A: [d, d]           (the roll itself)
 *    - Set B: [d, d, 7-d, 7-d] (roll + bonus mirror pair, roll FIRST)
 *    Player must play the ROLLED dice first, then the bonus.
 *
 * 3. Tric-Trac (1+2 in any order):
 *    Exactly 5 sets:
 *    - [1, 2]                  (simple)
 *    - [1, 1, 2, 2]            (doubles of both)
 *    - [1, 1, 6, 6]            (1-pair + mirror of 1)
 *    - [2, 2, 5, 5]            (2-pair + mirror of 2)
 *    - [1, 1, 2, 2, 5, 5, 6, 6] (all pairs — order: 1,1,2,2,5,5,6,6)
 *
 *    For Tric-Trac, the STRICT play order is always:
 *    1,1 → 2,2 → 5,5 → 6,6 (within a chosen set)
 */

/** Roll two dice (1-6 each) */
export function rollDice(): [number, number] {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return [d1, d2];
}

export function isTricTrac(d1: number, d2: number): boolean {
  return (d1 === 1 && d2 === 2) || (d1 === 2 && d2 === 1);
}

export function isDouble(d1: number, d2: number): boolean {
  return d1 === d2;
}

/**
 * Generate all dice sets from a roll.
 * Each set is in STRICT play order (lowest first, rolled before bonus).
 */
export function generateDiceSets(d1: number, d2: number): number[][] {
  // Case 3: Tric-Trac (1+2)
  // Trick Track is ALWAYS: [1, 1, 2, 2, 5, 5, 6, 6]
  if (isTricTrac(d1, d2)) {
    return [[1, 1, 2, 2, 5, 5, 6, 6]];
  }

  // Case 2: Double
  // Double is ALWAYS: [d, d, 7-d, 7-d]
  if (isDouble(d1, d2)) {
    const d = d1;
    const mir = 7 - d;
    return [[d, d, mir, mir]];
  }

  // Case 1: Normal — always low first
  const low = Math.min(d1, d2);
  const high = Math.max(d1, d2);
  return [[low, high]];
}

/**
 * Sort dice values low to high (for setup: must resolve lowest first)
 */
export function sortDiceLowToHigh(dice: number[]): number[] {
  return [...dice].sort((a, b) => a - b);
}
