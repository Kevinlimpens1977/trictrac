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
import type { GameState, GameEvent, Player } from '../types/GameState';
import { canBearOff } from '../engine/moveEngine';


interface GameBoardProps {
  state: GameState;
  onPointClick: (point: number) => void;
  onBarClick: () => void;
  exitingPieces?: { id: string, player: 'B' | 'W', point: number }[];
  isClimax?: boolean;
  /** Laatste zet/hit — hierop worden vliegende stenen geanimeerd */
  flightEvent?: GameEvent | null;
  children?: React.ReactNode;
}

interface Flight {
  id: string;
  player: Player;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
}

/** Vliegende steen: glijdt in ~0.28s van from naar to (SVG user units) */
const FlightPiece: React.FC<Flight> = ({ player, fx, fy, tx, ty }) => {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  const isBlack = player === 'B';
  return (
    <g
      style={{
        transform: go ? `translate(${tx - fx}px, ${ty - fy}px)` : 'translate(0px, 0px)',
        transition: 'transform 0.28s cubic-bezier(0.3, 0.7, 0.4, 1)',
      }}
    >
      <circle cx={fx + 4} cy={fy + 4} r={PIECE_RADIUS - 2} fill="rgba(0,0,0,0.25)" />
      <circle
        cx={fx}
        cy={fy}
        r={PIECE_RADIUS - 2}
        fill={isBlack ? '#2a2a2a' : '#f5f0e8'}
        stroke={isBlack ? '#777' : '#c4b99a'}
        strokeWidth={4}
      />
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

export const GameBoard: React.FC<GameBoardProps> = ({ state, onPointClick, onBarClick, exitingPieces, isClimax, flightEvent, children }) => {
  const layout = BOARD_LAYOUT;
  const containerRef = useRef<HTMLDivElement>(null);

  /* ─── Vliegende stenen bij zetten en hits ─── */
  const [flights, setFlights] = useState<Flight[]>([]);
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
    const barPos = (player: Player) => ({ x: BOARD_LAYOUT.bar.x, y: player === 'B' ? 360 : 440 });

    const from = ev.from === 0 ? barPos(ev.player) : posOfPoint(ev.from, 'from');
    const to = posOfPoint(ev.to, 'to');
    if (!from || !to) return;

    const newFlights: Flight[] = [{
      id: `${ev.seq}-m`,
      player: ev.player,
      fx: from.x, fy: from.y, tx: to.x, ty: to.y,
    }];

    if (ev.type === 'hit') {
      const opp: Player = ev.player === 'B' ? 'W' : 'B';
      const oppBar = barPos(opp);
      newFlights.push({
        id: `${ev.seq}-h`,
        player: opp,
        fx: to.x, fy: to.y, tx: oppBar.x, ty: oppBar.y,
      });
    }

    setFlights((f) => [...f, ...newFlights]);
    const ids = new Set(newFlights.map((f) => f.id));
    const t = setTimeout(() => setFlights((f) => f.filter((x) => !ids.has(x.id))), 380);
    return () => clearTimeout(t);
  }, [flightEvent]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* Board image */}
      <img
        src="/afbeeldingen/speelbord.png"
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

        {/* ── Highlight valid targets (green) ── */}
        {state.validTos.map((ptId) => {
          const pt = layout.points.find((p) => p.id === ptId);
          if (!pt) return null;
          
          const isSetup = state.phase === 'setup';
          if (isSetup) return null; // Geen groen kader tijdens setup
          
          const halfW = 18;
          const rectY = pt.isTop ? pt.yBase : pt.yBase - triH;
          return (
            <rect
              key={`hl-${ptId}`}
              x={pt.x - halfW}
              y={rectY}
              width={halfW * 2}
              height={triH}
              fill="rgba(76, 175, 80, 0.18)"
              stroke="rgba(76, 175, 80, 0.5)"
              strokeWidth={4}
              rx={8}
            />
          );
        })}

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

            return (
              <React.Fragment key={`p-${pt.id}-${i}`}>
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
                  fill={isBlack ? '#2a2a2a' : '#f5f0e8'}
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
              </React.Fragment>
            );
          });
        })}

        {/* ── Bar pieces ── */}
        {state.barB > 0 && Array.from({ length: state.barB }).map((_, i) => (
          <circle key={`barB-${i}`}
            cx={layout.bar.x} cy={448 - 80 - i * PIECE_DIAMETER}
            r={PIECE_RADIUS - 2}
            fill="#2a2a2a" stroke="#777" strokeWidth={4} />
        ))}
        {state.barW > 0 && Array.from({ length: state.barW }).map((_, i) => (
          <circle key={`barW-${i}`}
            cx={layout.bar.x} cy={448 + 80 + i * PIECE_DIAMETER}
            r={PIECE_RADIUS - 2}
            fill="#f5f0e8" stroke="#c4b99a" strokeWidth={4} />
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
                  fill={isBlack ? '#2a2a2a' : '#f5f0e8'}
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

      </svg>
      {children}
    </div>
  );
};
