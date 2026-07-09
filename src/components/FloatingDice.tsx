import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { GameState } from '../types/GameState';
import { Pips } from './Die';
import { prefersReducedMotion } from '../anim/motion';

/**
 * Dobbelsteenweergave in het HUD-paneel (ontwerp "optie 11"):
 * 3D mini-kubusjes in warme outline-stijl op het geschilderde papier.
 * - wachtend: outline-kubus
 * - actief:  groene lijnen + zachte gloed
 * - gespeeld: vervaagd met gestippelde rand en ↩-badge (tik = terugnemen)
 * Daaronder voortgangs-dots en een "laatste zet terugnemen"-tekstknop.
 */

type CubeState = 'used' | 'active' | 'pending';

/** Kubusmaat via CSS-var: 57px op ruime schermen, compacter op smalle
    schermen (zie --hud-cube in App.css). */
const CUBE = 'var(--hud-cube, 57px)';
const HALF = `calc(${CUBE} / 2)`;

const FACE_BASE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 6,
  borderWidth: 1.5,
  borderStyle: 'solid',
  borderColor: '#6d4c33',
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
  const borderColor = isActive ? '#2e7d32' : '#6d4c33';
  const pipColor = isActive ? '#2e7d32' : '#6d4c33';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={label}
      data-cube-state={state}
      style={{
        position: 'relative',
        width: `calc(${CUBE} + 8px)`,
        height: `calc(${CUBE} + 12px)`,
        paddingTop: 8,
        perspective: 500,
        cursor: onClick ? 'pointer' : 'default',
        opacity: isUsed ? 0.38 : 1,
        transition: 'opacity 0.3s ease',
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
            borderColor,
            borderStyle: isUsed ? 'dashed' : 'solid',
            transform: `translateZ(${HALF})`,
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
            borderColor,
            borderStyle: isUsed ? 'dashed' : 'solid',
            background: '#f3ecd8',
            transform: `rotateX(90deg) translateZ(${HALF})`,
          }}
        />
        {/* side */}
        <div
          style={{
            ...FACE_BASE,
            borderColor,
            borderStyle: isUsed ? 'dashed' : 'solid',
            background: '#e6dcc0',
            transform: `rotateY(90deg) translateZ(${HALF})`,
          }}
        />
      </div>
      {isUsed && onClick && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            right: -2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#f9efd7',
            border: '1px solid #8d6e63',
            color: '#5d4433',
            fontSize: 13,
            fontWeight: 900,
            lineHeight: '18px',
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
  const originalSet = state.selectedSetIndex !== -1 ? state.diceSets[state.selectedSetIndex] : undefined;
  const visible = !!originalSet && !state.isRolling;
  const usedCount = originalSet ? originalSet.length - state.remainingDice.length : 0;
  const canUndoAny = interactive && usedCount > 0 && state.history.length > 0;

  /* ─── GSAP: consume-pop op de zojuist gespeelde kubus + dot-pop;
     de actieve kubus 'ademt' zachtjes ───
     Hooks staan vóór de zichtbaarheids-return (rules of hooks);
     zonder gerenderde root doen de effecten niets. */
  const rootRef = useRef<HTMLDivElement>(null);
  const prevUsedRef = useRef(usedCount);

  useEffect(() => {
    const root = rootRef.current;
    const prev = prevUsedRef.current;
    prevUsedRef.current = usedCount;
    if (!root || prefersReducedMotion()) return;
    if (usedCount > prev) {
      const cubes = root.querySelectorAll('[data-cube-state]');
      const justUsed = cubes[usedCount - 1];
      if (justUsed) {
        gsap.fromTo(justUsed, { scale: 1.25, rotation: -10 }, { scale: 1, rotation: 0, duration: 0.4, ease: 'back.out(2.5)' });
      }
      const dots = root.querySelectorAll('[data-dot]');
      const dot = dots[usedCount - 1];
      if (dot) {
        gsap.fromTo(dot, { scale: 2.2 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
      }
    }
  }, [usedCount]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const active = root.querySelector('[data-cube-state="active"]');
    if (!active) return;
    const breathe = gsap.to(active, { scale: 1.09, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    return () => {
      breathe.kill();
      gsap.set(active, { scale: 1 });
    };
  }, [visible, usedCount, originalSet?.length]);

  if (!visible || !originalSet) return null;

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div
        className="hud-cube-row"
        style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          maxWidth: `calc(4 * (${CUBE} + 8px) + 36px)`,
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
      <div className="hud-dots" style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 16 }} aria-hidden="true">
        {originalSet.map((_, i) => (
          <span
            key={i}
            data-dot
            style={{
              display: 'inline-block',
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
          className="hud-undo-btn"
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
