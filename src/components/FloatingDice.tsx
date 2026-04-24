import React from 'react';
import type { GameState } from '../types/GameState';

interface FloatingDiceProps {
  state: GameState;
  onUndo: (stepsBack: number) => void;
}

const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export const FloatingDice: React.FC<FloatingDiceProps> = ({ state, onUndo }) => {
  if (state.selectedSetIndex === -1 || state.diceSets.length === 0) return null;
  if (state.isRolling) return null; // Verberg tijdens roll animatie

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
      flexWrap: 'wrap',
    }}>
      {originalSet.map((die, index) => {
        let status = 'pending'; // wit (nog te zetten)
        if (index < usedCount) status = 'used'; // grijs (al gezet)
        else if (index === usedCount) status = 'active'; // groen (nu aan de beurt)

        const isClickable = status === 'used';

        return (
          <div
            key={index}
            onClick={() => {
              if (isClickable) {
                // Ga het aantal stappen terug om bij deze steen te komen
                onUndo(usedCount - index);
              }
            }}
            style={{
              width: 44,
              height: 44,
              backgroundColor: status === 'active' ? '#4caf50' : status === 'used' ? '#555' : '#f5f0e8',
              color: status === 'used' ? '#222' : '#111',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              cursor: isClickable ? 'pointer' : 'default',
              boxShadow: status === 'active' ? '0 0 12px rgba(76,175,80,0.8)' : '0 2px 4px rgba(0,0,0,0.5)',
              opacity: status === 'used' ? 0.6 : 1,
              transition: 'all 0.2s ease',
              userSelect: 'none',
            }}
          >
            {DIE_FACES[die]}
          </div>
        );
      })}
    </div>
  );
};
