import React from 'react';
import type { GameState } from '../types/GameState';
import { FloatingDice } from './FloatingDice';
import { DiceRoller } from './DiceRoller';

interface GameHUDProps {
  state: GameState;
  onRollDice: () => void;
  onUndo: (stepsBack: number) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({ state, onRollDice, onUndo }) => {
  const isBlack = state.turn === 'B';
  const turnName = isBlack ? 'Zwart' : 'Wit';
  const turnColor = isBlack ? '#1a1a1a' : '#f5f0e8';
  const turnBorder = isBlack ? '#555' : '#c4b99a';
  const needsRoll = !state.rawDice;
  const isAITurn = state.mode === 'pva' && state.turn === 'W';

  return (
    <div style={styles.container}>
      {/* Top bar: turn */}
      <div style={styles.topBar}>
        <div style={styles.turnInfo}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: turnColor, border: `2px solid ${turnBorder}`,
          }} />
          <span style={styles.turnLabel}>{turnName}</span>
        </div>
      </div>

      {/* Dice area */}
      <div style={styles.diceArea}>
        {needsRoll && !isAITurn && (
          <button
            onClick={onRollDice}
            style={styles.rollButton}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(212,175,55,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.3)';
            }}
          >
            🎲 Gooi Dobbelstenen
          </button>
        )}
        
        {/* Playable dice and Roll animation */}
        <div style={styles.diceContainer}>
          <FloatingDice state={state} onUndo={onUndo} />
          <DiceRoller isRolling={state.isRolling} dice={state.rawDice} />
        </div>
      </div>

      {/* Bar info */}
      {(state.barB > 0 || state.barW > 0) && (
        <div style={styles.barInfo}>
          {state.barB > 0 && <span>Bar ⬛: {state.barB}</span>}
          {state.barW > 0 && <span>Bar ⬜: {state.barW}</span>}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    background: 'linear-gradient(180deg, rgba(20,20,31,0.95), rgba(10,10,15,0.95))',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.06)',
    minWidth: '260px',
    maxWidth: '300px',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  turnInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  turnLabel: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#fff',
  },
  phaseTag: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#d4af37',
    background: 'rgba(212,175,55,0.1)',
    padding: '2px 8px',
    borderRadius: '4px',
    letterSpacing: '1px',
  },
  scores: {
    display: 'flex',
    gap: '10px',
  },
  score: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
  },
  message: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center' as const,
    lineHeight: '1.4',
    minHeight: '36px',
    display: 'flex',
    alignItems: 'center',
  },
  diceArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
  },
  diceContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60px',
    width: '100%',
  },
  rollButton: {
    padding: '12px 28px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#1a1a2e',
    background: 'linear-gradient(135deg, #d4af37, #c4a030)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 3px 12px rgba(0,0,0,0.3)',
  },
  barInfo: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#e57373',
  },
  setupProgress: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
  },
  progressTrack: {
    flex: 1,
    height: '6px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
};
