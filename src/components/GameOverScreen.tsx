import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import type { Player } from '../types/GameState';
import type { PlayerStats } from '../stats';
import { playVictory } from '../audio/sound';
import { Pips } from './Die';

/**
 * Game-over "Gouden Medaille-ceremonie" (GSAP):
 * 1. De winnende steen dendert binnen en slaat in — schokgolven,
 *    camera-shake, confettikanonnen en een fanfare.
 * 2. Muntspin: de steen wordt 'geslagen' tot een gouden medaille met een
 *    kroon van dobbelsteen-pips (de tric-trac-signatuur).
 * 3. Titel-letters klappen één voor één binnen, statistieken tellen op.
 * Tik ergens = animatie overslaan. prefers-reduced-motion = direct eindbeeld.
 */

interface GameOverScreenProps {
  winner: Player;
  stats?: {
    doubles: { B: number; W: number };
    hits: { B: number; W: number };
    borneOff: { B: number; W: number };
  };
  onRestart: () => void;
  career?: PlayerStats | null;
}

const GOLD = ['#FFD700', '#FFF3B0', '#D4AF37', '#E5A93C', '#FFF8DC'];
const PIP_ANGLES = [-56, -28, 0, 28, 56];

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ winner, stats, onRestart, career }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const doublesRef = useRef<HTMLSpanElement>(null);
  const hitsRef = useRef<HTMLSpanElement>(null);

  const isBlack = winner === 'B';
  const name = isBlack ? 'ZWART' : 'WIT';
  const doublesVal = stats?.doubles[winner] ?? 0;
  const hitsVal = stats?.hits[winner] ?? 0;
  const subtitle = stats
    ? (stats.hits[winner] > 3 ? 'Gevreesde Krijger' : (stats.doubles[winner] > 2 ? 'Meester van het Lot' : 'Vlekkeloze Eindstrijd'))
    : 'Vlekkeloze Eindstrijd';

  const setCounters = (d: number, h: number) => {
    if (doublesRef.current) doublesRef.current.textContent = String(d);
    if (hitsRef.current) hitsRef.current.textContent = String(h);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);

      if (reduced) {
        setCounters(doublesVal, hitsVal);
        return;
      }

      /* Sfeer-loops (buiten de hoofdtimeline zodat skippen blijft werken) */
      gsap.to(q('.go-rays'), { rotation: 360, duration: 46, repeat: -1, ease: 'none' });
      (q('.go-float') as HTMLElement[]).forEach((el) => {
        gsap.set(el, { rotation: gsap.utils.random(-40, 40) });
        gsap.to(el, {
          y: `-=${gsap.utils.random(50, 130)}`,
          x: `+=${gsap.utils.random(-60, 60)}`,
          rotation: `+=${gsap.utils.random(-100, 100)}`,
          opacity: gsap.utils.random(0.06, 0.2),
          duration: gsap.utils.random(6, 13),
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      });

      const counters = { d: 0, h: 0 };
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          gsap.to(q('.go-medal'), { y: -7, duration: 1.7, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        },
      });
      tlRef.current = tl;

      tl.from(root, { opacity: 0, duration: 0.45 }, 0)
        .from(q('.go-card'), { scale: 0.9, opacity: 0, duration: 0.6 }, 0.05)
        .from(q('.go-rays'), { scale: 0.3, opacity: 0, duration: 1.3, ease: 'power2.out' }, 0.1)

        /* 1: de steen dendert binnen */
        .fromTo(q('.go-stone'), { y: -480, rotation: -200 }, { y: 0, rotation: 0, duration: 0.6, ease: 'power2.in' }, 0.35)
        .add('impact')
        .to(q('.go-stone'), { scaleY: 0.55, scaleX: 1.35, duration: 0.09, ease: 'power1.out' }, 'impact')
        .to(q('.go-stone'), { scaleY: 1, scaleX: 1, duration: 0.9, ease: 'elastic.out(1, 0.35)' }, 'impact+=0.09')
        .fromTo(q('.go-shockwave'),
          { scale: 0.2, opacity: 0.85 },
          { scale: 3.6, opacity: 0, duration: 0.85, ease: 'power2.out', stagger: 0.13, immediateRender: false }, 'impact')
        .to(q('.go-card'), { keyframes: [{ x: -7, y: 2 }, { x: 6, y: -3 }, { x: -4, y: 2 }, { x: 0, y: 0 }], duration: 0.42, ease: 'power2.out' }, 'impact')
        .call(() => {
          playVictory();
          confetti({ particleCount: 70, angle: 60, spread: 62, origin: { x: 0, y: 0.72 }, colors: GOLD, zIndex: 999999, startVelocity: 52, ticks: 110 });
          confetti({ particleCount: 70, angle: 120, spread: 62, origin: { x: 1, y: 0.72 }, colors: GOLD, zIndex: 999999, startVelocity: 52, ticks: 110 });
        }, [], 'impact')

        /* 2: muntspin -> gouden medaille met pip-kroon */
        .to(q('.go-stone-inner'), { rotationY: 720, duration: 0.9, ease: 'power2.inOut' }, 'impact+=0.5')
        .from(q('.go-ring'), { scale: 0, opacity: 0, duration: 0.55, ease: 'back.out(2.5)' }, 'impact+=0.95')
        .from(q('.go-pip'), { scale: 0, opacity: 0, y: 16, stagger: 0.07, duration: 0.4, ease: 'back.out(3)' }, 'impact+=1.1')
        .call(() => {
          confetti({ particleCount: 45, spread: 100, origin: { x: 0.5, y: 0.35 }, colors: GOLD, zIndex: 999999, startVelocity: 30, gravity: 0.9, scalar: 0.8 });
        }, [], 'impact+=1.25')

        /* 3: titel, subtitel, statistieken, knop */
        .from(q('.go-letter'), { rotationX: -95, y: 26, opacity: 0, transformOrigin: '50% 100%', stagger: 0.05, duration: 0.55, ease: 'back.out(1.8)' }, 'impact+=1.0')
        .from(q('.go-sub'), { opacity: 0, y: 12, duration: 0.4 }, '>-0.1')
        .from(q('.go-stat'), { x: -46, opacity: 0, stagger: 0.14, duration: 0.5 }, '>-0.05')
        .to(counters, {
          d: doublesVal,
          h: hitsVal,
          duration: 0.9,
          ease: 'power1.out',
          onUpdate: () => setCounters(Math.round(counters.d), Math.round(counters.h)),
        }, '<+0.15')
        .from(q('.go-career'), { opacity: 0, y: 10, duration: 0.4 }, '>-0.3')
        .from(q('.go-divider'), { scaleX: 0, duration: 0.5 }, '<')
        .from(q('.go-btn'), { scale: 0.6, opacity: 0, duration: 0.55, ease: 'back.out(2.2)' }, '>-0.1')
        .call(() => setCounters(doublesVal, hitsVal));
    }, root);

    return () => {
      ctx.revert();
      tlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner, doublesVal, hitsVal]);

  /* Tik ergens = ceremonie overslaan, direct naar het eindbeeld */
  const skip = () => {
    const tl = tlRef.current;
    if (tl && tl.progress() < 1) {
      tl.progress(1);
      setCounters(doublesVal, hitsVal);
    }
  };

  return (
    <div ref={rootRef} style={styles.container} onPointerDown={skip}>
      {/* Draaiende gouden stralen */}
      <div className="go-rays" style={styles.rays} aria-hidden="true" />

      {/* Zwevende gouden pips */}
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="go-float"
          aria-hidden="true"
          style={{
            ...styles.floatPip,
            left: `${6 + (i * 83) % 90}%`,
            top: `${12 + (i * 47) % 75}%`,
            width: 5 + (i % 3) * 3,
            height: 5 + (i % 3) * 3,
          }}
        />
      ))}

      <div className="go-card" style={styles.card}>
        {/* Medaille: steen + gouden ring + pip-kroon + schokgolven */}
        <div className="go-medal" style={styles.medal}>
          <span className="go-shockwave" style={styles.shockwave} aria-hidden="true" />
          <span className="go-shockwave" style={styles.shockwave} aria-hidden="true" />
          {PIP_ANGLES.map((a, i) => (
            <span
              key={a}
              className="go-pip"
              aria-hidden="true"
              style={{ ...styles.crownDie, transform: `rotate(${a}deg) translateY(-82px)` }}
            >
              <Pips value={i + 1} color="#5b4308" size="74%" />
            </span>
          ))}
          <span className="go-ring" style={styles.ring} aria-hidden="true" />
          <div className="go-stone" style={styles.stone}>
            <div
              className="go-stone-inner"
              style={{
                ...styles.stoneInner,
                background: isBlack
                  ? 'radial-gradient(circle at 32% 28%, #4d4d4d, #141414)'
                  : 'radial-gradient(circle at 32% 28%, #fffdf5, #d6cbb0)',
                border: `4px solid ${isBlack ? '#666' : '#c4b99a'}`,
              }}
            />
          </div>
        </div>

        <h1 className="go-title" style={styles.title} aria-label={`${name} WINT!`}>
          {`${name} WINT!`.split('').map((ch, i) => (
            <span key={i} className="go-letter" aria-hidden="true" style={styles.letter}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </h1>
        <p className="go-sub" style={styles.subtitle}>{subtitle}</p>

        {stats && (
          <div className="go-stats" style={styles.statsContainer}>
            <div className="go-stat" style={styles.statBox}>
              Gooide <span ref={doublesRef}>0</span>x dubbel
            </div>
            <div className="go-stat" style={styles.statBox}>
              Aantal stenen geslagen: <span ref={hitsRef}>0</span>
            </div>
          </div>
        )}

        {career && career.played > 0 && (
          <p className="go-career" style={styles.careerLine}>
            Jouw totaal: {career.played} {career.played === 1 ? 'potje' : 'potjes'} · {career.won} gewonnen
            {career.fastestWinMs != null && ` · snelste winst ${Math.max(1, Math.round(career.fastestWinMs / 60000))} min`}
          </p>
        )}

        <div className="go-divider" style={styles.divider} />

        <button
          className="go-btn"
          style={{ ...styles.button, animation: 'pulseButton 2s infinite' }}
          onClick={onRestart}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
        >
          Neem Revanche
        </button>
      </div>
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
    background: 'radial-gradient(ellipse at center, #1c1c31 0%, #0a0a10 78%)',
  },
  rays: {
    position: 'absolute',
    width: 640,
    height: 640,
    borderRadius: '50%',
    background: 'repeating-conic-gradient(rgba(212, 175, 55, 0.13) 0deg 7deg, transparent 7deg 26deg)',
    WebkitMaskImage: 'radial-gradient(circle, black 26%, transparent 68%)',
    maskImage: 'radial-gradient(circle, black 26%, transparent 68%)',
    pointerEvents: 'none',
  },
  floatPip: {
    position: 'absolute',
    borderRadius: '50%',
    background: '#d4af37',
    opacity: 0.12,
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    background: 'linear-gradient(150deg, rgba(38, 38, 60, 0.92), rgba(18, 18, 30, 0.95))',
    border: '1px solid rgba(212, 175, 55, 0.4)',
    borderRadius: 26,
    padding: '84px 44px 48px',
    textAlign: 'center',
    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
    maxWidth: 520,
    width: '90%',
  },
  medal: {
    position: 'absolute',
    left: '50%',
    top: -58,
    transform: 'translateX(-50%)',
    width: 116,
    height: 116,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shockwave: {
    position: 'absolute',
    inset: -6,
    borderRadius: '50%',
    border: '3px solid rgba(255, 215, 0, 0.85)',
    opacity: 0,
    pointerEvents: 'none',
  },
  ring: {
    position: 'absolute',
    inset: -10,
    borderRadius: '50%',
    border: '6px solid transparent',
    background: 'linear-gradient(140deg, #f7e08a, #d4af37 40%, #9a7a1e 70%, #ffd700) border-box',
    WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
    boxShadow: '0 0 26px rgba(255, 215, 0, 0.45)',
    pointerEvents: 'none',
  },
  crownDie: {
    position: 'absolute',
    left: 'calc(50% - 11px)',
    top: 'calc(50% - 11px)',
    width: 22,
    height: 22,
    borderRadius: 5,
    background: 'linear-gradient(145deg, #ffe9a8 0%, #f3cf5c 45%, #d4af37 100%)',
    border: '1px solid #8a6a12',
    boxShadow: '0 0 12px rgba(255, 215, 0, 0.55), inset 0 -2px 3px rgba(122, 92, 18, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  stone: {
    width: 92,
    height: 92,
    perspective: 600,
  },
  stoneInner: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.55), 0 0 40px rgba(255, 215, 0, 0.35)',
  },
  title: {
    fontSize: 44,
    fontWeight: 900,
    color: '#f3d264',
    margin: '6px 0 6px',
    fontFamily: 'var(--tt-font-display, Georgia, serif)',
    letterSpacing: 2,
    textShadow: '0 2px 0 #7a5c12, 0 6px 18px rgba(212, 175, 55, 0.45)',
    perspective: 500,
    whiteSpace: 'nowrap',
  },
  letter: {
    display: 'inline-block',
    willChange: 'transform',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.62)',
    margin: '0 0 26px 0',
    fontStyle: 'italic',
  },
  statsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    margin: '0 auto 24px',
  },
  statBox: {
    background: 'rgba(0, 0, 0, 0.32)',
    padding: '13px 20px',
    borderRadius: 12,
    border: '1px solid rgba(255, 215, 0, 0.18)',
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
  },
  careerLine: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 13,
    margin: '0 0 18px 0',
  },
  divider: {
    width: 110,
    height: 2,
    background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
    margin: '0 auto 28px',
  },
  button: {
    minHeight: 48,
    padding: '15px 46px',
    fontSize: 18,
    fontWeight: 700,
    color: '#1a1a2e',
    background: 'linear-gradient(135deg, #FFD700, #D4AF37)',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
};
