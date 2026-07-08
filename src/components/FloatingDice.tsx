import React from 'react';
import type { GameState } from '../types/GameState';
import { Pips } from './Die';

interface FloatingDiceProps {
  state: GameState;
  onUndo: (stepsBack: number) => void;
  /** false voor de niet-actieve speler in online pvp (undo werkt daar niet) */
  interactive?: boolean;
}

export const FloatingDice: React.FC<FloatingDiceProps> = ({ state, onUndo, interactive = true }) => {
  if (state.selectedSetIndex === -1 || state.diceSets.length === 0) return null;
  if (state.isRolling) return null;

  const originalSet = state.diceSets[state.selectedSetIndex];
  if (!originalSet) return null;

  const usedCount = originalSet.length - state.remainingDice.length;
  const canUndoAny = interactive && usedCount > 0 && state.history.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div style={{
        display: 'flex',
        gap: '10px',
        background: 'transparent',
        padding: '6px 0',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        maxWidth: `${4 * 52 + 3 * 10}px`,
        margin: '0 auto',
      }}>
        {originalSet.map((die, index) => {
          let status = 'pending';
          if (index < usedCount) status = 'used';
          else if (index === usedCount) status = 'active';

          const isClickable = canUndoAny && status === 'used';

          return (
            <div
              key={index}
              onClick={() => {
                if (isClickable) {
                  onUndo(usedCount - index);
                }
              }}
              role={isClickable ? 'button' : undefined}
              aria-label={isClickable ? `Neem zet met steen ${die} terug` : undefined}
              style={{
                width: 52,
                height: 52,
                perspective: '1000px',
                cursor: isClickable ? 'pointer' : 'default',
                userSelect: 'none',
              }}
            >
              <div style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                transition: 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
                transformStyle: 'preserve-3d',
                transform: status === 'used' ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}>
                {/* Front (goud = nog te spelen, groen = actief) */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  borderRadius: '50%',
                  background: status === 'active'
                    ? 'radial-gradient(circle at 30% 30%, #81c784, #388e3c)'
                    : 'radial-gradient(circle at 30% 30%, #ffd700, #b8860b)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  boxShadow: status === 'active'
                    ? '0 0 15px rgba(76,175,80,0.8), 0 4px 8px rgba(0,0,0,0.4)'
                    : '0 4px 8px rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Pips value={die} color="#111" size="55%" />
                </div>
                {/* Back (grijs = gespeeld; toont waarde + undo-pijl) */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 30% 30%, #b5b5b5, #6a6a6a)',
                  border: '1px solid #555',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.4) inset, 0 4px 8px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Pips value={die} color="#3d3d3d" size="55%" />
                  {isClickable && (
                    <span style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#f9efd7',
                      border: '1px solid #8d6e63',
                      color: '#5d4433',
                      fontSize: 13,
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}>
                      ↩
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {canUndoAny && (
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#6d4c33',
          textAlign: 'center',
          lineHeight: 1.3,
        }}>
          Tik op een gespeelde steen om de zet terug te nemen
        </div>
      )}
    </div>
  );
};
