import React from 'react';
import type { GameState } from '../types/GameState';
import { Pips } from './Die';

/**
 * Dobbelsteenweergave in het HUD-paneel (ontwerp "optie 11"):
 * 3D mini-kubusjes in warme outline-stijl op het geschilderde papier.
 * - wachtend: outline-kubus
 * - actief:  groene lijnen + zachte gloed
 * - gespeeld: vervaagd met gestippelde rand en ↩-badge (tik = terugnemen)
 * Daaronder voortgangs-dots en een "laatste zet terugnemen"-tekstknop.
 */

type CubeState = 'used' | 'active' | 'pending';

const CUBE = 38; // px, front-face
const HALF = CUBE / 2;

const FACE_BASE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 6,
  border: '1.5px solid #6d4c33',
  background: '#fbf6e8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backfaceVisibility: 'hidden',
};

const MiniCube: React.FC<{
  value: number;
  state: CubeState;
  onClick?: () => void;
  label?: string;
}> = ({ value, state, onClick, label }) => {
  const isActive = state === 'active';
  const isUsed = state === 'used';
  const border = isActive ? '1.5px solid #2e7d32' : FACE_BASE.border;
  const pipColor = isActive ? '#2e7d32' : '#6d4c33';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={label}
      style={{
        position: 'relative',
        width: CUBE + 8,
        height: CUBE + 12,
        paddingTop: 8,
        perspective: 500,
        cursor: onClick ? 'pointer' : 'default',
        opacity: isUsed ? 0.38 : 1,
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        transform: isActive ? 'scale(1.06)' : 'scale(1)',
        userSelect: 'none',
        flex: '0 0 auto',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: CUBE,
          height: CUBE,
          margin: '0 auto',
          transformStyle: 'preserve-3d',
          transform: 'rotateX(-18deg) rotateY(24deg)',
        }}
      >
        {/* front */}
        <div
          style={{
            ...FACE_BASE,
            border,
            borderStyle: isUsed ? 'dashed' : 'solid',
            transform: `translateZ(${HALF}px)`,
            background: isActive ? 'rgba(76, 175, 80, 0.12)' : FACE_BASE.background,
            boxShadow: isActive ? '0 0 12px rgba(76, 175, 80, 0.55)' : undefined,
          }}
        >
          <Pips value={value} color={pipColor} size="62%" />
        </div>
        {/* top */}
        <div
          style={{
            ...FACE_BASE,
            border,
            borderStyle: isUsed ? 'dashed' : 'solid',
            background: '#f3ecd8',
            transform: `rotateX(90deg) translateZ(${HALF}px)`,
          }}
        />
        {/* side */}
        <div
          style={{
            ...FACE_BASE,
            border,
            borderStyle: isUsed ? 'dashed' : 'solid',
            background: '#e6dcc0',
            transform: `rotateY(90deg) translateZ(${HALF}px)`,
          }}
        />
      </div>
      {isUsed && onClick && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            right: -2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#f9efd7',
            border: '1px solid #8d6e63',
            color: '#5d4433',
            fontSize: 12,
            fontWeight: 900,
            lineHeight: '16px',
            textAlign: 'center',
            opacity: 1,
          }}
        >
          ↩
        </span>
      )}
    </div>
  );
};

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
      <div
        style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          maxWidth: 4 * (CUBE + 8) + 3 * 12,
          margin: '0 auto',
        }}
      >
        {originalSet.map((die, index) => {
          const cubeState: CubeState = index < usedCount ? 'used' : index === usedCount ? 'active' : 'pending';
          const clickable = canUndoAny && cubeState === 'used';
          // Tik op een eerdere steen = alle zetten t/m die steen terugnemen
          const stepsBack = usedCount - index;
          return (
            <MiniCube
              key={index}
              value={die}
              state={cubeState}
              onClick={clickable ? () => onUndo(stepsBack) : undefined}
              label={clickable
                ? (stepsBack === 1
                  ? `Neem de zet met steen ${die} terug`
                  : `Neem ${stepsBack} zetten terug, tot en met steen ${die}`)
                : undefined}
            />
          );
        })}
      </div>

      {/* Voortgangs-dots: groen = gespeeld */}
      <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 6 }} aria-hidden="true">
        {originalSet.map((_, i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: i < usedCount ? '#2e7d32' : 'rgba(109, 76, 51, 0.3)',
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>

      {canUndoAny && (
        <button
          onClick={() => onUndo(1)}
          style={{
            minHeight: 44,
            minWidth: 44,
            marginTop: 6,
            padding: '8px 16px',
            borderRadius: 10,
            border: '1.5px solid #8d6e63',
            background: 'linear-gradient(180deg, #fbf6e8, #eee1c2)',
            boxShadow: '0 2px 0 #a08055, 0 3px 6px rgba(0,0,0,0.15)',
            color: '#5d4433',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'transform 0.1s ease, box-shadow 0.1s ease',
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.transform = 'translateY(1px)';
            e.currentTarget.style.boxShadow = '0 1px 0 #a08055, 0 2px 4px rgba(0,0,0,0.12)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 0 #a08055, 0 3px 6px rgba(0,0,0,0.15)';
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 0 #a08055, 0 3px 6px rgba(0,0,0,0.15)';
          }}
        >
          ↩ Laatste zet terugnemen
        </button>
      )}
    </div>
  );
};
