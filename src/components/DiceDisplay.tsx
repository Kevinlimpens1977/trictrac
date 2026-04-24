import React from 'react';


interface DiceDisplayProps {
  rawDice: [number, number] | null;
  diceSets: number[][];
  selectedSetIndex: number;
  remainingDice: number[];
  onSelectSet: (index: number) => void;
}

/* ─── Single die face ─── */
const DieFace: React.FC<{ value: number; size?: number; dimmed?: boolean }> = ({
  value,
  size = 44,
  dimmed = false,
}) => {
  // Dot positions for standard die faces
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
  };

  const dots = dotPositions[value] || [];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ opacity: dimmed ? 0.3 : 1, transition: 'opacity 0.2s' }}
    >
      <rect
        x="2" y="2" width="96" height="96" rx="16"
        fill="linear-gradient(135deg, #f5f0e8, #e8e0d0)"
        stroke="#c4b99a"
        strokeWidth="2"
      />
      <defs>
        <linearGradient id="dieGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5f0e8" />
          <stop offset="100%" stopColor="#e0d8c8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="url(#dieGrad)" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={10} fill="#1a1a1a" />
      ))}
    </svg>
  );
};

/* ─── Dice Display Component ─── */
export const DiceDisplay: React.FC<DiceDisplayProps> = ({
  rawDice,
  diceSets,
  selectedSetIndex,
  remainingDice,
  onSelectSet,
}) => {
  if (!rawDice) return null;

  return (
    <div style={styles.container}>
      {/* Current roll display */}
      <div style={styles.rollDisplay}>
        <DieFace value={rawDice[0]} />
        <DieFace value={rawDice[1]} />
      </div>

      {/* Dice set selection (if multiple sets) */}
      {diceSets.length > 1 && selectedSetIndex === -1 && (
        <div style={styles.setSelection}>
          <p style={styles.setLabel}>Kies een set:</p>
          {diceSets.map((set, i) => (
            <button
              key={i}
              onClick={() => onSelectSet(i)}
              style={styles.setButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#d4af37';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              }}
            >
              [{set.join(', ')}]
            </button>
          ))}
        </div>
      )}

      {/* Remaining dice indicator */}
      {selectedSetIndex >= 0 && remainingDice.length > 0 && (
        <div style={styles.remaining}>
          {remainingDice.map((d, i) => (
            <DieFace key={i} value={d} size={32} />
          ))}
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
    gap: '12px',
    padding: '12px',
  },
  rollDisplay: {
    display: 'flex',
    gap: '8px',
  },
  setSelection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'center',
  },
  setLabel: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    margin: 0,
  },
  setButton: {
    padding: '8px 16px',
    fontSize: '13px',
    fontFamily: 'monospace',
    color: '#d4af37',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    width: '100%',
  },
  remaining: {
    display: 'flex',
    gap: '4px',
  },
};
