import React from 'react';
import type { GameState } from '../types/GameState';
import { FloatingDice } from './FloatingDice';
import { DiceRoller } from './DiceRoller';

interface GameHUDProps {
  state: GameState;
  onRollDice: () => void;
  onUndo: (stepsBack: number) => void;
  onLeaveGame: () => void;
  localPlayer?: string;
  turn?: string;
}

export const GameHUD: React.FC<GameHUDProps> = ({ state, onRollDice, onUndo, onLeaveGame, localPlayer }) => {
  const isBlack = state.turn === 'B';
  const colorName = isBlack ? 'Zwart' : 'Wit';
  const actualPlayerName = state.playerNames ? state.playerNames[state.turn] : colorName;
  const isMyTurn = state.mode === 'pvp' && localPlayer === state.turn;
  const turnLabelText = isMyTurn ? 'Jij bent aan zet' : `${actualPlayerName} is aan zet`;

  const turnColor = isBlack ? '#1a1a1a' : '#f5f0e8';
  const turnBorder = isBlack ? '#555' : '#c4b99a';
  const needsRoll = !state.rawDice;
  const isAITurn = state.mode === 'pva' && state.turn === 'W';
  const isWaitingForRemote = state.mode === 'pvp' && localPlayer && localPlayer !== state.turn;

  return (
    <div 
      style={styles.container} 
      className={isWaitingForRemote ? (isBlack ? 'waiting-glow-black' : 'waiting-glow-white') : ''}
    >
      {/* Top bar: turn */}
      <div style={styles.topBar}>
        <div style={styles.turnInfo}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: turnColor, border: `3px solid ${turnBorder}`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }} />
          <span style={styles.turnLabel}>{turnLabelText}</span>
        </div>
      </div>

      {/* Dice area */}
      <div style={styles.diceArea}>
        {needsRoll && !isAITurn && !isWaitingForRemote && (
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
        
        {needsRoll && isWaitingForRemote && (
          <div style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontSize: '14px', margin: '10px 0' }}>
            Wachten op {actualPlayerName}...
          </div>
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

      {/* Leave Game Button */}
      <div style={styles.leaveContainer}>
        <button
          onClick={onLeaveGame}
          style={styles.leaveButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,53,69,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
          }}
        >
          Verlaat Spel
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '16px',
    padding: '8px 12px',
    background: 'transparent',
    borderRadius: '16px',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
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
    fontSize: '20px',
    fontWeight: 800,
    color: '#1a0e00',
    textShadow: '0 1px 2px rgba(255,255,255,0.3)',
    letterSpacing: '0.5px',
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
  leaveContainer: {
    marginTop: 'auto',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255,255,255,0.06)'
  },
  leaveButton: {
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #dc3545, #a71d2a)',
    border: '1px solid #7a151f',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  }
};
