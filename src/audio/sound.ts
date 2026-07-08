/**
 * Centrale audio-engine.
 *
 * Eén gedeelde AudioContext (lazy, hergebruikt) i.p.v. een nieuwe context per
 * worp — browsers staan maar ~6 contexts toe, daarna valt geluid stil.
 * Mute wordt gepersisteerd in localStorage ('tt-muted').
 */

const MUTE_KEY = 'tt-muted';

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch { /* private mode */ }

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

function click(c: AudioContext, time: number, freq: number, duration: number, vol = 0.1, type: OscillatorType = 'triangle') {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.1, 30), time + duration);

  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

  osc.connect(gain);
  gain.connect(c.destination);

  osc.start(time);
  osc.stop(time + duration);
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMuted(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch { /* private mode */ }
  return muted;
}

/** Beker schudden + stenen die op het hout kletteren (~1.2s totaal) */
export function playDiceRoll() {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  try {
    const now = c.currentTime;
    // Schudden in de beker
    click(c, now + 0.05, 800, 0.05, 0.05);
    click(c, now + 0.1, 600, 0.05, 0.05);
    click(c, now + 0.22, 800, 0.05, 0.05);
    click(c, now + 0.27, 600, 0.05, 0.05);
    // Rollen op het hout
    for (let i = 0; i < 9; i++) {
      const delay = 0.42 + i * 0.07 + Math.random() * 0.03;
      click(c, now + delay, 400 + Math.random() * 300, 0.08, 0.1);
    }
  } catch { /* audio niet kritiek */ }
}

/** Korte tik: steen neergezet */
export function playPieceMove() {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  try {
    click(c, c.currentTime, 900, 0.06, 0.08);
  } catch { /* audio niet kritiek */ }
}

/** Lage 'thud': steen geslagen */
export function playHit() {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  try {
    const now = c.currentTime;
    click(c, now, 220, 0.14, 0.14, 'square');
    click(c, now + 0.07, 150, 0.18, 0.12, 'square');
  } catch { /* audio niet kritiek */ }
}

/** Oplopend belletje: steen uitgespeeld */
export function playBearOff() {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  try {
    const now = c.currentTime;
    click(c, now, 660, 0.12, 0.09, 'sine');
    click(c, now + 0.09, 880, 0.16, 0.09, 'sine');
  } catch { /* audio niet kritiek */ }
}

/** Haptische feedback op mobiel; volgt de mute-instelling */
export function vibrate(pattern: number | number[]) {
  if (muted) return;
  try {
    navigator.vibrate?.(pattern);
  } catch { /* niet ondersteund */ }
}
