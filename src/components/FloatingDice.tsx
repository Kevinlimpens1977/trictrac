import React from 'react';
import type { GameState } from '../types/GameState';

interface FloatingDiceProps {
  state: GameState;
  onUndo: (stepsBack: number) => void;
}

export const FloatingDice: React.FC<FloatingDiceProps> = ({ state, onUndo }) => {
  if (state.selectedSetIndex === -1 || state.diceSets.length === 0) return null;
  if (state.isRolling) return null;

  const originalSet = state.diceSets[state.selectedSetIndex];
  if (!originalSet) return null;

  const usedCount = originalSet.length - state.remainingDice.length;

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      background: 'transparent',
      padding: '10px 0',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      maxWidth: `${4 * 60 + 3 * 12}px`,
      margin: '0 auto',
    }}>
      {originalSet.map((die, index) => {
        let status = 'pending';
        if (index < usedCount) status = 'used';
        else if (index === usedCount) status = 'active';

        const isClickable = status === 'used';

        return (
          <div
            key={index}
            onClick={() => {
              if (isClickable) {
                onUndo(usedCount - index);
              }
            }}
            style={{
              width: 60,
              height: 60,
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
              {/* Front (Gold / Green) */}
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
                <TokenPips value={die} />
              </div>
              {/* Back (Gray, Empty) */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, #aaa, #555)',
                border: '1px solid #444',
                boxShadow: '0 2px 4px rgba(0,0,0,0.4) inset, 0 4px 8px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TokenPips: React.FC<{ value: number }> = ({ value }) => {
  const positions: Record<number, {cx: number, cy: number}[]> = {
    1: [{cx: 50, cy: 50}],
    2: [{cx: 25, cy: 25}, {cx: 75, cy: 75}],
    3: [{cx: 25, cy: 25}, {cx: 50, cy: 50}, {cx: 75, cy: 75}],
    4: [{cx: 25, cy: 25}, {cx: 75, cy: 25}, {cx: 25, cy: 75}, {cx: 75, cy: 75}],
    5: [{cx: 25, cy: 25}, {cx: 75, cy: 25}, {cx: 50, cy: 50}, {cx: 25, cy: 75}, {cx: 75, cy: 75}],
    6: [{cx: 25, cy: 22}, {cx: 75, cy: 22}, {cx: 25, cy: 50}, {cx: 75, cy: 50}, {cx: 25, cy: 78}, {cx: 75, cy: 78}],
  };
  
  const dots = positions[value] || [];
  return (
    <svg viewBox="0 0 100 100" style={{ width: '55%', height: '55%', filter: 'drop-shadow(0px 1px 1px rgba(255,255,255,0.4))' }}>
      {dots.map((dot, i) => (
        <circle key={i} cx={dot.cx} cy={dot.cy} r="11" fill="#111" />
      ))}
    </svg>
  );
};
