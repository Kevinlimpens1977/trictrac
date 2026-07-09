import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import type { GameState } from '../types/GameState';
import { isDouble, isTricTrac } from '../engine/diceEngine';
import { playYourTurn } from '../audio/sound';
import { prefersReducedMotion } from '../anim/motion';

/**
 * Bord-banners voor grote spelmomenten (GSAP):
 * - Beurtwissel: "Jij bent aan zet!" / "{naam} is aan zet" veegt kort
 *   over het bord (prominent voor de eigen beurt, subtiel voor de ander).
 * - Worpuitkomst: "DUBBEL!" of "TRIC-TRAC!" met gouden bordflits
 *   (tric-trac krijgt mini-confetti).
 * Tap = banner direct weg. Reduced motion = geen banners (HUD-tekst dekt het).
 */

type BannerKind = 'turn-own' | 'turn-other' | 'double' | 'trictrac';

interface Banner {
  kind: BannerKind;
  text: string;
  stone?: 'B' | 'W';
  id: number;
}

interface GameBannerProps {
  state: GameState;
}

const GOLD = ['#FFD700', '#FFF3B0', '#D4AF37', '#E5A93C'];

export const GameBanner: React.FC<GameBannerProps> = ({ state }) => {
  const [banner, setBanner] = useState<Banner | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const idRef = useRef(0);

  const prevTurnRef = useRef(state.turn);
  const prevRollingRef = useRef(state.isRolling);

  /* ── Trigger: beurtwissel ── */
  useEffect(() => {
    const prev = prevTurnRef.current;
    prevTurnRef.current = state.turn;
    if (state.screen !== 'game' || prev === state.turn) return;
    if (prefersReducedMotion()) return;

    const own = state.mode === 'pva'
      ? state.turn === 'B'
      : state.localPlayer
        ? state.turn === state.localPlayer
        : true; // lokaal gedeeld scherm: beide beurten aankondigen

    const naam = state.playerNames?.[state.turn] ?? (state.turn === 'B' ? 'Zwart' : 'Wit');
    const text = state.mode !== 'pva' && !state.localPlayer
      ? `${naam} is aan zet`
      : own ? 'Jij bent aan zet!' : `${naam} is aan zet`;

    if (own && (state.mode === 'pva' || state.localPlayer)) playYourTurn();
    setBanner({ kind: own ? 'turn-own' : 'turn-other', text, stone: state.turn, id: ++idRef.current });
  }, [state.turn, state.screen, state.mode, state.localPlayer, state.playerNames]);

  /* ── Trigger: worpuitkomst (na de tuimel-animatie) ── */
  useEffect(() => {
    const was = prevRollingRef.current;
    prevRollingRef.current = state.isRolling;
    if (!was || state.isRolling || !state.rawDice || state.screen !== 'game') return;
    if (prefersReducedMotion()) return;

    const [d1, d2] = state.rawDice;
    if (isTricTrac(d1, d2)) {
      setBanner({ kind: 'trictrac', text: 'TRIC-TRAC!', id: ++idRef.current });
      confetti({ particleCount: 50, spread: 90, origin: { x: 0.4, y: 0.5 }, colors: GOLD, zIndex: 999999, startVelocity: 34, scalar: 0.8, ticks: 90 });
    } else if (isDouble(d1, d2)) {
      setBanner({ kind: 'double', text: 'DUBBEL!', id: ++idRef.current });
    }
  }, [state.isRolling, state.rawDice, state.screen]);

  /* ── Animatie: in → hold → uit ── */
  useEffect(() => {
    if (!banner) return;
    const el = bannerRef.current;
    if (!el) return;

    tlRef.current?.kill();
    const big = banner.kind === 'double' || banner.kind === 'trictrac';
    const subtle = banner.kind === 'turn-other';

    const tl = gsap.timeline({ onComplete: () => setBanner(null) });
    tlRef.current = tl;

    tl.fromTo(el,
      { xPercent: -46, opacity: 0, scale: big ? 0.6 : 0.92 },
      { xPercent: 0, opacity: 1, scale: 1, duration: big ? 0.42 : 0.3, ease: big ? 'back.out(2.2)' : 'power3.out' })
      .to(el, { xPercent: 34, opacity: 0, duration: 0.28, ease: 'power2.in' }, big ? '+=1.0' : (subtle ? '+=0.55' : '+=0.8'));

    if (big && flashRef.current) {
      tl.fromTo(flashRef.current, { opacity: 0 }, { opacity: 0.32, duration: 0.16, ease: 'power1.out' }, 0)
        .to(flashRef.current, { opacity: 0, duration: 0.5, ease: 'power2.out' }, 0.2);
    }

    return () => { tl.kill(); };
  }, [banner]);

  if (!banner) return null;

  const big = banner.kind === 'double' || banner.kind === 'trictrac';
  const subtle = banner.kind === 'turn-other';

  return (
    <>
      {big && <div ref={flashRef} style={styles.flash} aria-hidden="true" />}
      <div
        ref={bannerRef}
        style={{
          ...styles.banner,
          ...(big ? styles.bannerBig : subtle ? styles.bannerSubtle : styles.bannerOwn),
        }}
        role="status"
        onPointerDown={() => { tlRef.current?.progress(1); }}
      >
        {banner.stone && (
          <span
            style={{
              ...styles.stone,
              background: banner.stone === 'B'
                ? 'radial-gradient(circle at 32% 28%, #4d4d4d, #141414)'
                : 'radial-gradient(circle at 32% 28%, #fffdf5, #d6cbb0)',
              borderColor: banner.stone === 'B' ? '#666' : '#c4b99a',
            }}
            aria-hidden="true"
          />
        )}
        <span>{banner.text}</span>
      </div>
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  banner: {
    position: 'absolute',
    left: '35%',
    top: '46%',
    transform: 'translate(-50%, -50%)',
    zIndex: 80,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 26px',
    borderRadius: 999,
    fontFamily: 'var(--tt-font-display, Impact, sans-serif)',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
  },
  bannerOwn: {
    background: 'rgba(20, 40, 18, 0.88)',
    border: '2px solid #4caf50',
    color: '#d7ffd0',
    fontSize: 'clamp(18px, 3.4vh, 28px)',
    boxShadow: '0 10px 26px rgba(0, 0, 0, 0.4), 0 0 22px rgba(76, 175, 80, 0.35)',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.6)',
  },
  bannerSubtle: {
    background: 'rgba(30, 26, 20, 0.72)',
    border: '1.5px solid rgba(255, 255, 255, 0.25)',
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 'clamp(14px, 2.6vh, 20px)',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.35)',
  },
  bannerBig: {
    background: 'linear-gradient(160deg, rgba(64, 44, 6, 0.94), rgba(38, 24, 2, 0.94))',
    border: '2.5px solid #ffd700',
    color: '#ffe9a8',
    fontSize: 'clamp(24px, 5vh, 40px)',
    letterSpacing: 2,
    boxShadow: '0 14px 34px rgba(0, 0, 0, 0.5), 0 0 34px rgba(255, 215, 0, 0.5)',
    textShadow: '0 2px 0 #7a5c12, 0 4px 14px rgba(255, 215, 0, 0.5)',
  },
  stone: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '3px solid',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
    flex: '0 0 auto',
  },
  flash: {
    position: 'absolute',
    inset: 0,
    zIndex: 70,
    background: 'radial-gradient(ellipse at 35% 46%, rgba(255, 215, 0, 0.9), transparent 62%)',
    opacity: 0,
    pointerEvents: 'none',
  },
};
