/**
 * Spelersstatistieken, gepersisteerd per gebruiker (localStorage).
 * Bewust simpel: geen server, wél per-uid zodat meerdere accounts op
 * één apparaat elkaars cijfers niet vervuilen.
 */

export interface PlayerStats {
  played: number;
  won: number;
  lost: number;
  doubles: number;
  hits: number;
  fastestWinMs: number | null;
}

const EMPTY: PlayerStats = {
  played: 0,
  won: 0,
  lost: 0,
  doubles: 0,
  hits: 0,
  fastestWinMs: null,
};

const key = (uid: string) => `tt-stats-${uid}`;

export function loadStats(uid: string): PlayerStats {
  try {
    const raw = localStorage.getItem(key(uid));
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

export interface GameResult {
  /** true = gewonnen, false = verloren, null = lokaal potje zonder perspectief */
  won: boolean | null;
  doubles: number;
  hits: number;
  durationMs: number;
}

export function recordGame(uid: string, result: GameResult): PlayerStats {
  const stats = loadStats(uid);
  stats.played += 1;
  stats.doubles += result.doubles;
  stats.hits += result.hits;
  if (result.won === true) {
    stats.won += 1;
    if (stats.fastestWinMs === null || result.durationMs < stats.fastestWinMs) {
      stats.fastestWinMs = result.durationMs;
    }
  } else if (result.won === false) {
    stats.lost += 1;
  }
  try {
    localStorage.setItem(key(uid), JSON.stringify(stats));
  } catch { /* private mode */ }
  return stats;
}
