import React, { useMemo } from 'react';

/**
 * Eén bron voor pip-posities (voorheen 4x gedupliceerd in DiceRoller,
 * FloatingDice, DiceDisplay en Gameroom).
 */
const PIP_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[26, 26], [74, 74]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[26, 26], [74, 26], [26, 74], [74, 74]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[26, 24], [74, 24], [26, 50], [74, 50], [26, 76], [74, 76]],
};

export const Pips: React.FC<{ value: number; color?: string; size?: string }> = ({
  value,
  color = '#141414',
  size = '58%',
}) => (
  <svg viewBox="0 0 100 100" style={{ width: size, height: size, display: 'block' }} aria-hidden="true">
    {(PIP_POSITIONS[value] || []).map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r={11} fill={color} />
    ))}
  </svg>
);

/* Kubusvlak-oriëntatie: tegenoverliggende vlakken tellen op tot 7 */
const FACE_TRANSFORMS: Record<number, string> = {
  1: 'rotateY(0deg)',
  6: 'rotateY(180deg)',
  3: 'rotateY(90deg)',
  4: 'rotateY(-90deg)',
  2: 'rotateX(90deg)',
  5: 'rotateX(-90deg)',
};

/* Kubus-rotatie die vlak `value` naar de kijker draait */
const SHOW_ROTATION: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  2: [-90, 0],
  5: [90, 0],
};

export interface DieProps {
  value: number;
  size?: number;
  color?: 'white' | 'black';
  /** Tijdens rollen tuimelt de kubus; daarna settelt hij op `value`. */
  rolling?: boolean;
}

/**
 * Herbruikbare 3D-dobbelsteen (CSS 3D-kubus met 6 echte vlakken).
 * Gebruikt door de worp op het bord én de toss in de gameroom.
 */
export const Die: React.FC<DieProps> = ({ value, size = 64, color = 'white', rolling = false }) => {
  const reducedMotion = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    []
  );

  const isBlack = color === 'black';
  const faceBg = isBlack
    ? 'radial-gradient(circle at 32% 30%, #3a3a3a, #1c1c1c)'
    : 'radial-gradient(circle at 32% 30%, #fffdf6, #ece3cd)';
  const faceBorder = isBlack ? '#4d4d4d' : '#c9bda0';
  const pipColor = isBlack ? '#e8e8e8' : '#141414';

  const [rx, ry] = SHOW_ROTATION[value] || [0, 0];
  const tumbling = rolling && !reducedMotion;

  return (
    <div
      style={{
        width: size,
        height: size,
        perspective: 700,
        filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.4))',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
          transition: tumbling ? undefined : 'transform 0.3s ease-out',
          animation: tumbling ? 'dieTumble 0.5s linear infinite' : 'none',
          opacity: rolling && reducedMotion ? 0.6 : 1,
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((face) => (
          <div
            key={face}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: Math.round(size * 0.18),
              border: `1px solid ${faceBorder}`,
              background: faceBg,
              backfaceVisibility: 'hidden',
              transform: `${FACE_TRANSFORMS[face]} translateZ(${size / 2}px)`,
              boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.12)',
            }}
          >
            <Pips value={face} color={pipColor} />
          </div>
        ))}
      </div>
    </div>
  );
};
