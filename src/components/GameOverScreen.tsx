import React, { useEffect, useState } from 'react';
import type { Player } from '../types/GameState';
import confetti from 'canvas-confetti';

interface GameOverScreenProps {
  winner: Player;
  stats?: {
    doubles: { B: number; W: number };
    hits: { B: number; W: number };
    borneOff: { B: number; W: number };
  };
  onRestart: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ winner, stats, onRestart }) => {
  const isBlack = winner === 'B';
  const name = isBlack ? 'ZWART' : 'WIT';
  const accent = isBlack ? '#1a1a1a' : '#f5f0e8';
  const accentBorder = isBlack ? '#555' : '#c4b99a';
  const [step, setStep] = useState<'intro' | 'explode' | 'victory'>('intro');
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    // Sequence timings
    const t1 = setTimeout(() => setStep('explode'), 1500);
    const t2 = setTimeout(() => {
      setStep('victory');
      setTimeout(() => setShowStats(true), 800);
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (step !== 'victory') return;

    const duration = 5000;
    const animationEnd = Date.now() + duration;
    // VERY IMPORTANT: zIndex high enough to be over everything
    const defaults = { startVelocity: 45, spread: 360, ticks: 100, zIndex: 999999 };

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }
      const particleCount = 40 * (timeLeft / duration);
      // Goudfolie confetti
      confetti({
        ...defaults, particleCount,
        colors: ['#FFD700', '#C0C0C0', '#D4AF37', '#FFF8DC', '#E5A93C'],
        origin: { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.4 + 0.1 }
      });
    }, 200);

    return () => clearInterval(interval);
  }, [step]);

  return (
    <div style={{
      ...styles.container,
      background: step === 'victory' 
        ? 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%)' 
        : 'transparent',
      transition: 'background 1s ease'
    }}>
      {/* Intro sequence: floating stone */}
      {step !== 'victory' && (
        <div style={{
          ...styles.piece,
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '80px',
          height: '80px',
          margin: 0,
          background: accent,
          border: `3px solid ${accentBorder}`,
          boxShadow: `0 0 60px ${isBlack ? 'rgba(255,215,0,0.8)' : 'rgba(245,240,232,0.8)'}`,
          animation: step === 'intro' 
            ? 'epicWin 1.5s cubic-bezier(0.25, 1, 0.5, 1) forwards'
            : 'pieceExplode 0.5s ease-out forwards',
          zIndex: 9999
        }} />
      )}

      {/* Victory Card */}
      {step === 'victory' && (
        <div style={{...styles.card, animation: 'dawnGlow 1s ease forwards'}}>

        <h1 style={styles.title}>{name} WINT!</h1>
        <p style={styles.subtitle}>
          {stats ? (stats.hits[winner] > 3 ? 'Gevreesde Krijger' : (stats.doubles[winner] > 2 ? 'Meester van het Lot' : 'Vlekkeloze Eindstrijd')) : 'Vlekkeloze Eindstrijd'}
        </p>

        {/* Hero Stats */}
        {stats && (
          <div style={{
            ...styles.statsContainer,
            opacity: showStats ? 1 : 0,
            transform: showStats ? 'translateY(0)' : 'translateY(20px)',
          }}>
            <div style={styles.statBox}>
              <div style={styles.statValue}>Gooide {stats.doubles[winner]}x dubbel</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>Aantal stenen geslagen: {stats.hits[winner]}</div>
            </div>
          </div>
        )}

        <div style={styles.divider} />

        <button
          style={{ ...styles.button, animation: 'pulseButton 2s infinite' }}
          onClick={onRestart}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
          }}
        >
          Neem Revanche
        </button>
      </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 10000,
  },
  card: {
    background: 'linear-gradient(145deg, #1e1e30, #14141f)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '24px',
    padding: '60px 40px',
    textAlign: 'center' as const,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)',
    maxWidth: '500px',
    width: '90%',
  },
  piece: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    margin: '0 auto 24px',
  },
  title: {
    fontSize: '42px',
    fontWeight: 900,
    color: '#d4af37',
    margin: '0 0 8px 0',
    fontFamily: "'Georgia', serif",
    textShadow: '0 2px 10px rgba(212,175,55,0.4)',
  },
  subtitle: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.6)',
    margin: '0 0 32px 0',
    fontStyle: 'italic',
  },
  divider: {
    width: '100px',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
    margin: '0 auto 32px',
  },
  button: {
    padding: '16px 48px',
    fontSize: '18px',
    fontWeight: 700,
    color: '#1a1a2e',
    background: 'linear-gradient(135deg, #FFD700, #D4AF37)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    textTransform: 'uppercase',
  },
  statsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    margin: '0 auto 32px',
    transition: 'all 0.8s ease',
  },
  statBox: {
    background: 'rgba(0,0,0,0.3)',
    padding: '14px 20px',
    borderRadius: '12px',
    border: '1px solid rgba(255,215,0,0.15)',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'sans-serif',
  }
};
