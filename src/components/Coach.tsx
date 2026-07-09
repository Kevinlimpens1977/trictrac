import React, { useEffect, useState } from 'react';
import type { GameState } from '../types/GameState';
import { getBarCount } from '../engine/moveEngine';
import { isPlayerSetupDone } from '../engine/setupEngine';
import { isTricTrac, isDouble } from '../engine/diceEngine';

interface CoachProps {
  state: GameState;
}

type TipKey = 'setup' | 'double' | 'trictrac' | 'bar';

const TIPS: Record<TipKey, string> = {
  setup: 'Plaats eerst je 15 stenen. De gegooide ogen bepalen het punt — de laagste dobbelsteen eerst.',
  double: 'Dubbel! Je speelt je worp én het spiegelbeeld (7 − ogen), en daarna mag je nóg een keer gooien.',
  trictrac: 'Tric-Trac (1+2)! De sterkste worp: je speelt 1,1 → 2,2 → 5,5 → 6,6 — acht zetten in één beurt.',
  bar: 'Je steen is geslagen en staat op de bar. Die moet eerst terug het bord op voordat je iets anders mag.',
};

const OFF_KEY = 'tt-coach-off';
const seenKey = (k: TipKey) => `tt-coach-${k}`;

function isOff(): boolean {
  try { return localStorage.getItem(OFF_KEY) === '1'; } catch { return true; }
}

function seen(k: TipKey): boolean {
  try { return localStorage.getItem(seenKey(k)) === '1'; } catch { return true; }
}

function markSeen(k: TipKey) {
  try { localStorage.setItem(seenKey(k), '1'); } catch { /* private mode */ }
}

/** Bepaal welke tip nu relevant is (of null) */
function activeTip(state: GameState): TipKey | null {
  if (state.screen !== 'game') return null;

  // In pvp alleen tips voor de speler die aan zet is op dit apparaat
  if (state.mode === 'pvp' && state.localPlayer && state.localPlayer !== state.turn) return null;

  if (getBarCount(state, state.turn) > 0) return 'bar';

  if (state.rawDice && !state.isRolling) {
    const [d1, d2] = state.rawDice;
    if (isTricTrac(d1, d2)) return 'trictrac';
    if (isDouble(d1, d2)) return 'double';
  }

  if (!isPlayerSetupDone(state, state.turn)) return 'setup';

  return null;
}

/**
 * Contextuele onboarding: toont elke spelregeltip precies één keer,
 * op het moment dat hij relevant wordt. Uitzetbaar; keuze wordt onthouden.
 */
export const Coach: React.FC<CoachProps> = ({ state }) => {
  const [visible, setVisible] = useState<TipKey | null>(null);
  const [disabled, setDisabled] = useState(isOff);

  const candidate = disabled ? null : activeTip(state);

  useEffect(() => {
    if (!candidate || seen(candidate)) return;
    setVisible(candidate);
  }, [candidate]);

  if (!visible || disabled) return null;

  const dismiss = () => {
    markSeen(visible);
    setVisible(null);
  };

  const turnOff = () => {
    markSeen(visible);
    try { localStorage.setItem(OFF_KEY, '1'); } catch { /* private mode */ }
    setDisabled(true);
    setVisible(null);
  };

  return (
    <div style={styles.card} role="status">
      <span style={styles.icon} aria-hidden="true">💡</span>
      <span style={styles.text}>{TIPS[visible]}</span>
      <div style={styles.actions}>
        <button style={styles.okBtn} onClick={dismiss}>
          Begrepen
        </button>
        <button style={styles.offBtn} onClick={turnOff}>
          Tips uit
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    position: 'absolute',
    left: '50%',
    top: 'max(10px, 2%)',
    transform: 'translateX(-50%)',
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    maxWidth: 'min(520px, 92%)',
    padding: '8px 8px 8px 14px',
    background: 'rgba(255, 248, 225, 0.97)',
    border: '1px solid rgba(96, 58, 22, 0.35)',
    borderRadius: '12px',
    boxShadow: '0 10px 26px rgba(0, 0, 0, 0.3)',
    color: '#3e2723',
  },
  icon: {
    fontSize: '18px',
    flex: '0 0 auto',
  },
  text: {
    fontSize: '13px',
    fontWeight: 600,
    lineHeight: 1.35,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: '0 0 auto',
  },
  okBtn: {
    minHeight: '44px',
    padding: '4px 12px',
    border: 'none',
    borderRadius: '8px',
    background: '#5d4433',
    color: '#fff',
    fontWeight: 700,
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  offBtn: {
    minHeight: '44px',
    padding: '2px 12px',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: '#8d6e63',
    fontWeight: 600,
    fontSize: '11px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
