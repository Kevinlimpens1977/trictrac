import React, { useEffect, useState } from 'react';

interface DiceRollerProps {
  isRolling: boolean;
  dice: [number, number] | null;
}

const playDiceSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playClick = (time: number, freq: number, duration: number, vol = 0.1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.1, time + duration);
      
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + duration);
    };

    const now = ctx.currentTime;
    
    // Shake 1 (in hand/cup)
    playClick(now + 0.1, 800, 0.05, 0.05);
    playClick(now + 0.15, 600, 0.05, 0.05);
    
    // Shake 2
    playClick(now + 0.4, 800, 0.05, 0.05);
    playClick(now + 0.45, 600, 0.05, 0.05);

    // Roll
    for (let i = 0; i < 12; i++) {
      const delay = 0.8 + i * 0.08 + (Math.random() * 0.04);
      playClick(now + delay, 400 + Math.random() * 300, 0.08, 0.1);
    }
  } catch (e) {
    console.error('Audio play failed', e);
  }
};

export const DiceRoller: React.FC<DiceRollerProps> = ({ isRolling, dice }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isRolling) {
      setShow(true);
      playDiceSound();
      
      const t = setTimeout(() => {
        setShow(false);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [isRolling]);

  if (!show || !dice) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 0',
      minHeight: '100px',
    }}>
      <div style={{
        animation: 'shakeAndRoll 2s ease-out forwards',
        display: 'flex',
        gap: '15px',
      }}>
        <DiceIcon value={dice[0]} />
        <DiceIcon value={dice[1]} />
      </div>
      <style>{`
        @keyframes shakeAndRoll {
          0% { transform: scale(0.8) translateY(-40px) rotate(0deg); opacity: 0; }
          10% { transform: scale(1) translateY(-50px) rotate(15deg); opacity: 1; }
          20% { transform: scale(1) translateY(-50px) rotate(-15deg); opacity: 1; }
          30% { transform: scale(1) translateY(-50px) rotate(15deg); opacity: 1; }
          40% { transform: scale(1) translateY(-50px) rotate(-15deg); opacity: 1; }
          50% { transform: scale(1.2) translateY(20px) rotate(720deg); opacity: 1; }
          70% { transform: scale(1) translateY(0px) rotate(1080deg); opacity: 1; }
          90% { transform: scale(1) translateY(0px) rotate(1080deg); opacity: 1; }
          100% { transform: scale(0.8) translateY(0px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const DiceIcon: React.FC<{ value: number }> = ({ value }) => {
  return (
    <div style={{
      width: 80,
      height: 80,
      background: 'radial-gradient(circle at 30% 30%, #fffdfa, #f5f0e8)',
      border: '1px solid rgba(0,0,0,0.1)',
      borderRadius: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 12px 24px rgba(0,0,0,0.4), inset 0 -4px 8px rgba(0,0,0,0.1)',
    }}>
      <TokenPips value={value} />
    </div>
  );
};

const TokenPips: React.FC<{ value: number }> = ({ value }) => {
  const positions: Record<number, {cx: number, cy: number}[]> = {
    1: [{cx: 50, cy: 50}],
    2: [{cx: 25, cy: 25}, {cx: 75, cy: 75}],
    3: [{cx: 25, cy: 25}, {cx: 50, cy: 50}, {cx: 75, cy: 75}],
    4: [{cx: 25, cy: 25}, {cx: 75, cy: 25}, {cx: 25, cy: 75}, {cx: 75, cy: 75}],
    5: [{cx: 25, cy: 25}, {cx: 75, cy: 25}, {cx: 50, cy: 50}, {cx: 25, cy: 75}, {cx: 75, cy: 75}],
    6: [{cx: 25, cy: 22}, {cx: 75, cy: 22}, {cx: 25, cy: 50}, {cx: 75, cy: 50}, {cx: 25, cy: 78}, {cx: 75, cy: 78}],
  };
  
  const dots = positions[value] || [];
  return (
    <svg viewBox="0 0 100 100" style={{ width: '60%', height: '60%', filter: 'drop-shadow(0px 1px 1px rgba(255,255,255,0.4))' }}>
      {dots.map((dot, i) => (
        <circle key={i} cx={dot.cx} cy={dot.cy} r="11" fill="#111" />
      ))}
    </svg>
  );
};
