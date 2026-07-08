import React, { useEffect, useState } from 'react';
import type { GameState } from '../types/GameState';
import { FloatingDice } from './FloatingDice';
import { isMuted, toggleMuted } from '../audio/sound';
import { canBearOff } from '../engine/moveEngine';

interface GameHUDProps {
  state: GameState;
  onRollDice: () => void;
  onUndo: (stepsBack: number) => void;
  onLeaveGame: () => void;
  localPlayer?: string;
  turn?: string;
  autoBearOff?: boolean;
  onToggleAutoBearOff?: () => void;
  /** Resterende beurtseconden (alleen online pvp), null = geen timer */
  turnRemaining?: number | null;
}

export const GameHUD: React.FC<GameHUDProps> = ({ state, onRollDice, onUndo, onLeaveGame, localPlayer, autoBearOff = true, onToggleAutoBearOff, turnRemaining }) => {
  const [muted, setMuted] = useState(isMuted());

  /* Fullscreen-toggle (verborgen waar de browser het niet ondersteunt,
     zoals Safari op iPhone — daar dekt de PWA-installatie dit af) */
  const fullscreenSupported = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* al gesloten */ });
    } else {
      document.documentElement.requestFullscreen?.().catch((e) => {
        console.warn('[Fullscreen] geweigerd door browser:', e?.message);
      });
    }
  };
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
  const isErrorMsg = /moet eerst|geen geldige|geen zetten|verloren|overgeslagen|geblokkeerd|vol\./i.test(state.msg);

  // 'Automatisch uitspelen' is alleen relevant zodra deze speler alle stenen
  // in het thuisvak heeft: pva = de mens (zwart), online = eigen kleur,
  // lokaal gedeeld scherm = wie aan de beurt is.
  const bearOffPerspective = state.mode === 'pva'
    ? 'B' as const
    : ((localPlayer as 'B' | 'W' | undefined) ?? state.turn);
  const showAutoBearOff = !!onToggleAutoBearOff && canBearOff(state, bearOffPerspective);

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
          <span className="hud-turn-label" style={styles.turnLabel}>{turnLabelText}</span>
          {turnRemaining != null && turnRemaining <= 20 && (
            <span
              style={{
                ...styles.timerBadge,
                background: turnRemaining <= 10 ? '#c62828' : '#ef6c00',
              }}
              role="timer"
              aria-label={`Nog ${turnRemaining} seconden`}
            >
              {turnRemaining > 0 ? `${turnRemaining}s` : '…'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
          {fullscreenSupported && (
            <button
              onClick={toggleFullscreen}
              style={styles.muteButton}
              aria-label={isFullscreen ? 'Volledig scherm sluiten' : 'Volledig scherm'}
              title={isFullscreen ? 'Volledig scherm sluiten' : 'Volledig scherm'}
            >
              {isFullscreen ? '🗗' : '⛶'}
            </button>
          )}
          <button
            onClick={() => setMuted(toggleMuted())}
            style={styles.muteButton}
            aria-label={muted ? 'Geluid aanzetten' : 'Geluid uitzetten'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* Feedback uit de engine (state.msg) */}
      <div
        key={state.msg}
        className={`hud-msg${isErrorMsg ? ' hud-msg--error' : ''}`}
        style={styles.message}
        aria-live="polite"
      >
        {state.msg}
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
          <div style={{ color: '#6d4c33', fontStyle: 'italic', fontSize: '14px', margin: '10px 0' }}>
            Wachten op {actualPlayerName}...
          </div>
        )}
        
        {/* Speelbare dobbeltokens (worp-animatie staat op het bord) */}
        <div className="hud-dice-container" style={styles.diceContainer}>
          <FloatingDice state={state} onUndo={onUndo} interactive={!isWaitingForRemote} />
        </div>
      </div>

      {/* Bar info */}
      {(state.barB > 0 || state.barW > 0) && (
        <div style={styles.barInfo}>
          {state.barB > 0 && <span>Bar ⬛: {state.barB}</span>}
          {state.barW > 0 && <span>Bar ⬜: {state.barW}</span>}
        </div>
      )}

      {/* Onderste blok: instelling (alleen in de eindfase) + verlaat-knop */}
      <div style={styles.bottomBlock}>
        {showAutoBearOff && (
          <label className="hud-auto-row" style={styles.autoRow}>
            <input
              type="checkbox"
              checked={autoBearOff}
              onChange={onToggleAutoBearOff}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#8d6e63' }}
            />
            Automatisch uitspelen
          </label>
        )}

        {/* Leave Game Button */}
        <div className="hud-leave" style={styles.leaveContainer}>
        <button
          onClick={onLeaveGame}
          style={styles.leaveButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.08)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          ⏻ Verlaat spel
        </button>
        </div>
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
    gap: '10px',
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
    fontWeight: 600,
    color: '#5d4433',
    textAlign: 'center' as const,
    lineHeight: '1.35',
    minHeight: '32px',
    maxHeight: '32px',
    overflow: 'hidden',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: '48px',
    width: '100%',
  },
  rollButton: {
    minHeight: '44px',
    padding: '10px 28px',
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
  timerBadge: {
    minWidth: '34px',
    padding: '3px 8px',
    borderRadius: '999px',
    color: '#fff',
    fontWeight: 800,
    fontSize: '13px',
    textAlign: 'center',
  },
  muteButton: {
    width: '44px',
    height: '44px',
    border: 'none',
    borderRadius: '10px',
    background: 'rgba(120, 80, 40, 0.1)',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
  },
  bottomBlock: {
    marginTop: 'auto',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  autoRow: {
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#5d4433',
    cursor: 'pointer',
    userSelect: 'none',
  },
  leaveContainer: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '8px',
    borderTop: '1px solid rgba(120, 80, 40, 0.18)'
  },
  leaveButton: {
    minHeight: '44px',
    minWidth: '44px',
    padding: '8px 24px',
    fontSize: '13px',
    fontWeight: 800,
    color: '#fff',
    background: 'linear-gradient(180deg, #ff6b6b 0%, #c92a2a 100%)',
    border: '1.5px solid #861616',
    borderRadius: '999px',
    cursor: 'pointer',
    boxShadow: '0 2px 0 #861616, 0 3px 6px rgba(0,0,0,0.18)',
    textShadow: '0 1px 1px rgba(0,0,0,0.35)',
    transition: 'filter 0.15s ease, transform 0.15s ease',
    letterSpacing: 0
  }
};
