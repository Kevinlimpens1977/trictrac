import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BOARD_LAYOUT,
  PIECE_RADIUS,
  PIECE_DIAMETER,
  IMG_W,
  IMG_H,
  BOTTOM_BASE,
  BOTTOM_TIP,
  TOP_BASE,
  TOP_TIP,
} from '../constants/boardLayout';
import gsap from 'gsap';
import type { GameState, GameEvent, Player } from '../types/GameState';
import { canBearOff } from '../engine/moveEngine';
import { isPlayerSetupDone } from '../engine/setupEngine';
import { prefersReducedMotion } from '../anim/motion';


interface GameBoardProps {
  state: GameState;
  onPointClick: (point: number) => void;
  onBarClick: () => void;
  exitingPieces?: { id: string, player: 'B' | 'W', point: number }[];
  isClimax?: boolean;
  /** Laatste zet/hit — hierop worden vliegende stenen geanimeerd */
  flightEvent?: GameEvent | null;
  /** Punt met keyboard-focus (toegankelijkheid) */
  focusPoint?: number | null;
  children?: React.ReactNode;
}

/** Y-positie van bar-steen `index`. Zwart staat in de onderste helft van de
    bar, wit gespiegeld in de bovenste helft; beide stapelen richting het
    midden (y=254.5). De oude wit-formule (448+80+i*d = 528+) viel buiten de
    976x509-viewBox, waardoor geslagen witte stenen onzichtbaar waren. */
const getBarPieceY = (player: Player, index: number) =>
  player === 'B' ? 368 - index * PIECE_DIAMETER : 141 + index * PIECE_DIAMETER;

interface Flight {
  id: string;
  player: Player;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  /** startvertraging in s (geslagen steen wacht tot de aanvaller landt) */
  delay?: number;
}

/** Vliegende steen (GSAP): boogje met aparte grond-schaduw en een
    subtiele squash bij de landing — voelt fysiek i.p.v. glijdend. */
const FlightPiece: React.FC<Flight> = ({ player, fx, fy, tx, ty, delay = 0 }) => {
  const pieceRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const piece = pieceRef.current;
    const shadow = shadowRef.current;
    if (!piece || !shadow) return;

    if (prefersReducedMotion()) {
      gsap.set([piece, shadow], { x: tx - fx, y: ty - fy });
      return;
    }

    const dist = Math.hypot(tx - fx, ty - fy);
    const arc = Math.min(36, 12 + dist * 0.1);
    const o = { t: 0 };
    const tween = gsap.to(o, {
      t: 1,
      duration: 0.32,
      delay,
      ease: 'power1.inOut',
      onUpdate() {
        const t = o.t;
        const lift = Math.sin(Math.PI * t);
        gsap.set(piece, { x: (tx - fx) * t, y: (ty - fy) * t - lift * arc });
        gsap.set(shadow, {
          x: (tx - fx) * t,
          y: (ty - fy) * t,
          scale: 1 - lift * 0.35,
          opacity: 1 - lift * 0.45,
          transformOrigin: '50% 50%',
        });
      },
      onComplete() {
        gsap.fromTo(piece,
          { scaleY: 0.8, scaleX: 1.18, transformOrigin: '50% 50%' },
          { scaleY: 1, scaleX: 1, duration: 0.2, ease: 'power2.out' });
      },
    });
    return () => { tween.kill(); };
  }, [fx, fy, tx, ty, delay]);

  return (
    <g>
      <circle ref={shadowRef} cx={fx + 4} cy={fy + 4} r={PIECE_RADIUS - 2} fill="rgba(0,0,0,0.25)" />
      <g ref={pieceRef}>
        <circle
          cx={fx}
          cy={fy}
          r={PIECE_RADIUS - 2}
          fill={player === 'B' ? 'url(#pieceB)' : 'url(#pieceW)'}
          stroke={player === 'B' ? '#777' : '#c4b99a'}
          strokeWidth={4}
        />
      </g>
    </g>
  );
};

/** Impact-burst op het punt waar een steen geslagen wordt */
const ImpactBurst: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const ref = useRef<SVGGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const ring = el.querySelector('.imp-ring');
    const sparks = el.querySelectorAll('.imp-spark');
    if (ring) {
      gsap.fromTo(ring,
        { scale: 0.2, opacity: 0.9, transformOrigin: '50% 50%' },
        { scale: 2.1, opacity: 0, duration: 0.45, ease: 'power2.out' });
    }
    sparks.forEach((sp, i) => {
      const a = (i / sparks.length) * Math.PI * 2;
      gsap.fromTo(sp,
        { x: 0, y: 0, opacity: 1 },
        { x: Math.cos(a) * 30, y: Math.sin(a) * 30, opacity: 0, duration: 0.4, ease: 'power2.out' });
    });
  }, []);

  return (
    <g ref={ref} pointerEvents="none">
      <circle className="imp-ring" cx={x} cy={y} r={16} fill="none" stroke="#ff5252" strokeWidth={4} />
      {Array.from({ length: 6 }).map((_, i) => (
        <circle key={i} className="imp-spark" cx={x} cy={y} r={3.5} fill="#ffca28" />
      ))}
    </g>
  );
};

/** Groen doelkader dat zichzelf 'tekent' + dobberend richtingspijltje */
const TargetHighlight: React.FC<{
  x: number; y: number; w: number; h: number;
  markerPath: string; markerDir: number;
}> = ({ x, y, w, h, markerPath, markerDir }) => {
  const strokeRef = useRef<SVGRectElement>(null);
  const fillRef = useRef<SVGRectElement>(null);
  const markerRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const len = 2 * (w + h);
    if (strokeRef.current) {
      gsap.fromTo(strokeRef.current,
        { strokeDasharray: `${len}`, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 0.32, ease: 'power2.out' });
    }
    if (fillRef.current) {
      gsap.fromTo(fillRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    }
    let bob: gsap.core.Tween | undefined;
    if (markerRef.current) {
      bob = gsap.to(markerRef.current, {
        y: markerDir > 0 ? 4 : -4,
        duration: 0.5,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
    }
    return () => { bob?.kill(); };
  }, [w, h, markerDir]);

  return (
    <g>
      <rect ref={fillRef} x={x} y={y} width={w} height={h} fill="rgba(76, 175, 80, 0.18)" rx={8} />
      <rect ref={strokeRef} x={x} y={y} width={w} height={h} fill="none" stroke="rgba(76, 175, 80, 0.65)" strokeWidth={4} rx={8} />
      <path ref={markerRef} d={markerPath} fill="#1b5e20" stroke="#fff" strokeWidth={1.5} />
    </g>
  );
};

/**
 * Calculate Y center of a piece in a stack.
 * Piece 0 = at the base, piece 4 = at the tip.
 * 5 pieces fill the triangle exactly.
 */
function getPieceY(isTop: boolean, index: number, count: number): number {
  if (isTop) {
    const baseY = TOP_BASE + PIECE_RADIUS;
    const tipY = TOP_TIP - PIECE_RADIUS;
    const maxSpan = tipY - baseY;
    const spacing = count > 1 ? Math.min(PIECE_DIAMETER, maxSpan / (count - 1)) : 0;
    return baseY + index * spacing;
  } else {
    const baseY = BOTTOM_BASE - PIECE_RADIUS;
    const tipY = BOTTOM_TIP + PIECE_RADIUS;
    const maxSpan = baseY - tipY;
    const spacing = count > 1 ? Math.min(PIECE_DIAMETER, maxSpan / (count - 1)) : 0;
    return baseY - index * spacing;
  }
}

/**
 * Given a tap at (px, py) in image-pixel space,
 * find which point ID was hit (or the bar, or none).
 * Zones are wider than the painted triangles and lopen door tot voorbij de
 * basis/punt, zodat ook op kleine schermen elke tik raak is.
 */
function hitTest(px: number, py: number): { type: 'point' | 'bar' | 'none'; id: number } {
  const layout = BOARD_LAYOUT;
  const halfW = 20; // volle driehoekbreedte (~40.5px image-space)
  const barHalfW = 20; // bar-zone verbreed van 12 naar 40px voor touch

  // Check bar
  if (Math.abs(px - layout.bar.x) < barHalfW && Math.abs(py - layout.bar.y) < layout.bar.h / 2) {
    return { type: 'bar', id: 0 };
  }

  // Check points (verticale marge boven basis en voorbij de punt)
  for (const pt of layout.points) {
    const yMin = pt.isTop ? TOP_BASE - 10 : BOTTOM_TIP - 20;
    const yMax = pt.isTop ? TOP_TIP + 20 : BOTTOM_BASE + 10;
    if (px >= pt.x - halfW && px <= pt.x + halfW && py >= yMin && py <= yMax) {
      return { type: 'point', id: pt.id };
    }
  }

  return { type: 'none', id: 0 };
}

export const GameBoard: React.FC<GameBoardProps> = ({ state, onPointClick, onBarClick, exitingPieces, isClimax, flightEvent, focusPoint, children }) => {
  const layout = BOARD_LAYOUT;
  const containerRef = useRef<HTMLDivElement>(null);

  /* ─── Vliegende stenen bij zetten en hits ─── */
  const [flights, setFlights] = useState<Flight[]>([]);
  const [impacts, setImpacts] = useState<{ id: string; x: number; y: number }[]>([]);
  const flightSeqRef = useRef(0);

  useEffect(() => {
    const ev = flightEvent;
    if (!ev) return;
    if (ev.seq <= flightSeqRef.current) {
      flightSeqRef.current = ev.seq;
      return;
    }
    flightSeqRef.current = ev.seq;
    if (ev.type !== 'move' && ev.type !== 'hit') return; // bear-off heeft eigen animatie

    // Positie in image-space; state is de POST-move stand.
    const posOfPoint = (pid: number, role: 'from' | 'to') => {
      const pt = BOARD_LAYOUT.points.find((p) => p.id === pid);
      if (!pt) return null;
      const count = state.points[pid]?.count ?? 0;
      const index = role === 'to' ? Math.max(count - 1, 0) : count; // verwijderde steen zat bovenop
      return { x: pt.x, y: getPieceY(pt.isTop, index, Math.max(count, index + 1)) };
    };
    // Stapelplek `index` op de bar — zelfde formule als de statische
    // bar-rendering, zodat vluchten exact op de stapel landen/vertrekken
    const barStackPos = (player: Player, index: number) => ({
      x: BOARD_LAYOUT.bar.x,
      y: getBarPieceY(player, index),
    });
    const barCountOf = (p: Player) => (p === 'B' ? state.barB : state.barW);

    // Heropzet vanaf de bar: de vertrokken steen lag bovenop (teller is al verlaagd)
    const from = ev.from === 0
      ? barStackPos(ev.player, barCountOf(ev.player))
      : posOfPoint(ev.from, 'from');
    const to = posOfPoint(ev.to, 'to');
    if (!from || !to) return;

    const MOVE_MS = 620;      // boog (320ms) + landing-squash + marge
    const HIT_DELAY_S = 0.32; // geslagen steen vertrekt pas als de aanvaller landt

    const newFlights: Flight[] = [{
      id: `${ev.seq}-m`,
      player: ev.player,
      fx: from.x, fy: from.y, tx: to.x, ty: to.y,
    }];
    const ttl: Record<string, number> = { [`${ev.seq}-m`]: MOVE_MS };

    if (ev.type === 'hit') {
      const opp: Player = ev.player === 'B' ? 'W' : 'B';
      // Doel: de bovenste stapelplek (teller is al verhoogd)
      const oppTop = barStackPos(opp, Math.max(barCountOf(opp) - 1, 0));
      const hitId = `${ev.seq}-h`;
      newFlights.push({
        id: hitId,
        player: opp,
        fx: to.x, fy: to.y, tx: oppTop.x, ty: oppTop.y,
        delay: HIT_DELAY_S,
      });
      ttl[hitId] = MOVE_MS + HIT_DELAY_S * 1000;
      // Impact-burst op het moment dat de aanvaller landt
      const impact = { id: `${ev.seq}-i`, x: to.x, y: to.y };
      setTimeout(() => {
        setImpacts((arr) => [...arr, impact]);
        setTimeout(() => setImpacts((arr) => arr.filter((i) => i.id !== impact.id)), 550);
      }, HIT_DELAY_S * 1000);
    }

    setFlights((f) => [...f, ...newFlights]);
    // Opruimen niet in de effect-cleanup: een volgende zet binnen de vluchttijd
    // zou de timer annuleren en een hit-vlucht zou dan permanent een
    // bar-steen blijven verbergen
    for (const f of newFlights) {
      setTimeout(() => setFlights((arr) => arr.filter((x) => x.id !== f.id)), ttl[f.id]);
    }
  }, [flightEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Selectie-feedback: pop bij selectie, hoofdschudden zonder zetten ─── */
  const prevSelectedRef = useRef<number | null>(null);
  useEffect(() => {
    const sel = state.selected;
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = sel;
    if (sel == null || sel === prev || prefersReducedMotion()) return;
    const el = containerRef.current?.querySelector(`[data-stack-top="${sel}"]`);
    if (!el) return;
    if (state.validTos.length === 0) {
      gsap.fromTo(el, { x: 0 }, { keyframes: [{ x: -4 }, { x: 4 }, { x: -3 }, { x: 2 }, { x: 0 }], duration: 0.35, ease: 'power1.inOut' });
    } else {
      gsap.fromTo(el, { scale: 0.88, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
    }
  }, [state.selected, state.validTos]);

  /** Convert pointer-up to image-pixel coordinates and dispatch */
  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    // Tap position relative to container (0-1)
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    // Convert to image pixel space
    const px = relX * IMG_W;
    const py = relY * IMG_H;

    let hit = hitTest(px, py);

    // Touch-slop: net naast alles getikt? Kies het dichtstbijzijnde relevante
    // punt (eigen steen of geldige bestemming) binnen 30 image-px.
    if (hit.type === 'none') {
      const s = state;
      let best: { id: number; d: number } | null = null;
      for (const pt of BOARD_LAYOUT.points) {
        const yMin = pt.isTop ? TOP_BASE : BOTTOM_TIP;
        const yMax = pt.isTop ? TOP_TIP : BOTTOM_BASE;
        const dy = py < yMin ? yMin - py : py > yMax ? py - yMax : 0;
        const dx = Math.abs(px - pt.x);
        const d = Math.hypot(dx, dy);
        if (d > 30) continue;
        const ps = s.points[pt.id];
        const relevant = s.validTos.includes(pt.id) || (ps !== null && ps.owner === s.turn);
        if (relevant && (!best || d < best.d)) best = { id: pt.id, d };
      }
      if (best) hit = { type: 'point', id: best.id };
    }

    if (hit.type === 'point') {
      onPointClick(hit.id);
    } else if (hit.type === 'bar') {
      onBarClick();
    }
  }, [onPointClick, onBarClick, state]);

  if (!state || !state.points) {
    return <div style={{ color: '#fff', padding: 40 }}>Laden...</div>;
  }

  const isBearOff = canBearOff(state, state.turn);
  const triH = BOTTOM_BASE - BOTTOM_TIP;

  return (
    <div
      className="game-board"
      ref={containerRef}
      onPointerUp={handlePointerUp}
      role="application"
      aria-label="Tric-Trac speelbord. Gebruik de pijltjestoetsen en Enter om stenen te verplaatsen, R om te gooien, U om terug te nemen."
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        maxWidth: `calc(100vh * ${layout.aspectRatio})`,
        maxHeight: `calc(100vw / ${layout.aspectRatio})`,
        aspectRatio: `${layout.aspectRatio}`,
        margin: '0 auto',
        cursor: 'pointer',
        touchAction: 'manipulation',
      }}
    >
      {/* Board image — 1x/2x WebP; layoutcoördinaten blijven in 976×509-space */}
      <img
        src="/afbeeldingen/speelbord.png"
        srcSet="/afbeeldingen/speelbord.webp 1x, /afbeeldingen/speelbord@2x.webp 2x"
        alt="Tric-Trac Speelbord"
        draggable={false}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />

      {/* Cinematic Focus Overlay */}
      {isClimax && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.65)',
          pointerEvents: 'none',
          transition: 'background-color 1s ease',
        }} />
      )}

      {/* SVG Overlay — rendering only, no click handling */}
      <svg
        viewBox={`0 0 ${IMG_W} ${IMG_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {/* Materiaal-look voor de stenen (ivoor / ebbenhout) */}
        <defs>
          <radialGradient id="pieceB" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#4d4d4d" />
            <stop offset="60%" stopColor="#2a2a2a" />
            <stop offset="100%" stopColor="#141414" />
          </radialGradient>
          <radialGradient id="pieceW" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fffdf5" />
            <stop offset="60%" stopColor="#f0e9d8" />
            <stop offset="100%" stopColor="#d6cbb0" />
          </radialGradient>
        </defs>

        {/* ── Highlight valid targets (green) ── */}
        {state.validTos.map((ptId) => {
          const pt = layout.points.find((p) => p.id === ptId);
          if (!pt) return null;
          
          const isSetup = !isPlayerSetupDone(state, state.turn);
          if (isSetup) return null; // Geen groen kader tijdens de eigen opzetfase
          
          const halfW = 18;
          const rectY = pt.isTop ? pt.yBase : pt.yBase - triH;
          // ▼-marker bij de punt-tip: kleuronafhankelijk signaal voor geldige doelen
          const markerY = pt.isTop ? TOP_TIP + 14 : BOTTOM_TIP - 14;
          const markerDir = pt.isTop ? -8 : 8;
          return (
            <TargetHighlight
              key={`hl-${ptId}-${state.selected ?? 'x'}`}
              x={pt.x - halfW}
              y={rectY}
              w={halfW * 2}
              h={triH}
              markerPath={`M ${pt.x - 8} ${markerY} h 16 l -8 ${markerDir} z`}
              markerDir={markerDir}
            />
          );
        })}

        {/* ── Keyboard-focus ring ── */}
        {focusPoint != null && (() => {
          const pt = layout.points.find((p) => p.id === focusPoint);
          if (!pt) return null;
          const rectY = pt.isTop ? pt.yBase : pt.yBase - triH;
          return (
            <rect
              x={pt.x - 20}
              y={rectY - 4}
              width={40}
              height={triH + 8}
              fill="none"
              stroke="#1e87d6"
              strokeWidth={4}
              strokeDasharray="10 6"
              rx={10}
            />
          );
        })()}

        {/* ── Selected point highlight (yellow) ── */}
        {!isBearOff && state.selected !== null && (() => {
          const pt = layout.points.find((p) => p.id === state.selected);
          if (!pt) return null;
          const halfW = 18;
          const rectY = pt.isTop ? pt.yBase : pt.yBase - triH;
          return (
            <rect
              x={pt.x - halfW}
              y={rectY}
              width={halfW * 2}
              height={triH}
              fill="rgba(255, 235, 59, 0.12)"
              stroke="rgba(255, 235, 59, 0.5)"
              strokeWidth={4}
              rx={8}
            />
          );
        })()}

        {/* ── Render pieces on points ── */}
        {layout.points.map((pt) => {
          const pointState = state.points[pt.id];
          if (!pointState) return null;

          return Array.from({ length: pointState.count }).map((_, i) => {
            const cy = getPieceY(pt.isTop, i, pointState.count);
            const isBlack = pointState.owner === 'B';

            const isTop = i === pointState.count - 1;
            return (
              <g key={`p-${pt.id}-${i}`} data-stack-top={isTop ? pt.id : undefined}>
                <circle
                  cx={pt.x + 4}
                  cy={cy + 4}
                  r={PIECE_RADIUS - 2}
                  fill="rgba(0,0,0,0.25)"
                  className="piece-enter"
                />
                <circle
                  cx={pt.x}
                  cy={cy}
                  r={PIECE_RADIUS - 2}
                  fill={isBlack ? 'url(#pieceB)' : 'url(#pieceW)'}
                  stroke={isBlack ? '#777' : '#c4b99a'}
                  strokeWidth={4}
                  className="piece-enter"
                />
                <circle
                  cx={pt.x}
                  cy={cy}
                  r={PIECE_RADIUS * 0.6}
                  fill="none"
                  stroke={isBlack ? '#555' : '#d8d0c0'}
                  strokeWidth={3}
                  className={isClimax ? 'piece-enter climax-piece' : 'piece-enter'}
                />
              </g>
            );
          });
        })}

        {/* ── Bar pieces ── */}
        {/* Een geslagen steen die nog naar de bar vliegt telt even niet mee;
            de statische steen verschijnt pas als de vlucht geland is */}
        {Array.from({
          length: Math.max(0, state.barB - flights.filter((f) => f.player === 'B' && f.id.endsWith('-h')).length),
        }).map((_, i) => (
          <circle key={`barB-${i}`}
            cx={layout.bar.x} cy={getBarPieceY('B', i)}
            r={PIECE_RADIUS - 2}
            fill="url(#pieceB)" stroke="#777" strokeWidth={4} />
        ))}
        {Array.from({
          length: Math.max(0, state.barW - flights.filter((f) => f.player === 'W' && f.id.endsWith('-h')).length),
        }).map((_, i) => (
          <circle key={`barW-${i}`}
            cx={layout.bar.x} cy={getBarPieceY('W', i)}
            r={PIECE_RADIUS - 2}
            fill="url(#pieceW)" stroke="#c4b99a" strokeWidth={4} />
        ))}

        {/* ── Bear-off counters ── */}
        {state.boreB > 0 && (
          <text x={layout.trayRight.x} y={300} textAnchor="middle"
            fontSize={40} fill="#fff" fontWeight="bold" fontFamily="sans-serif">
            ⬛ {state.boreB}
          </text>
        )}
        {state.boreW > 0 && (
          <text x={layout.trayRight.x} y={600} textAnchor="middle"
            fontSize={40} fill="#fff" fontWeight="bold" fontFamily="sans-serif">
            ⬜ {state.boreW}
          </text>
        )}

        {/* ── Exiting pieces (Magic Bear-Off) ── */}
        {exitingPieces && exitingPieces.map((ex) => {
          const pt = layout.points.find(p => p.id === ex.point);
          if (!pt) return null;
          
          const cy = getPieceY(pt.isTop, 0, 1);
          const isBlack = ex.player === 'B';

          return (
             <g key={`exiting-${ex.id}`} className="animate-piece-exit">
                <circle
                  cx={pt.x + 4}
                  cy={cy + 4}
                  r={PIECE_RADIUS - 2}
                  fill="rgba(0,0,0,0.25)"
                />
                <circle
                  cx={pt.x}
                  cy={cy}
                  r={PIECE_RADIUS - 2}
                  fill={isBlack ? 'url(#pieceB)' : 'url(#pieceW)'}
                  stroke={isBlack ? '#777' : '#c4b99a'}
                  strokeWidth={4}
                />
                <circle
                  cx={pt.x}
                  cy={cy}
                  r={PIECE_RADIUS * 0.6}
                  fill="none"
                  stroke={isBlack ? '#555' : '#d8d0c0'}
                  strokeWidth={3}
                />
              </g>
          );
        })}

        {/* ── Vliegende stenen (zet/hit-animatie) ── */}
        {flights.map((f) => (
          <FlightPiece key={f.id} {...f} />
        ))}

        {/* ── Impact-bursts bij geslagen stenen ── */}
        {impacts.map((im) => (
          <ImpactBurst key={im.id} x={im.x} y={im.y} />
        ))}

      </svg>
      {children}
    </div>
  );
};
