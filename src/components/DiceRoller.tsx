import React, { useEffect, useState } from 'react';

interface DiceRollerProps {
  isRolling: boolean;
  dice: [number, number] | null;
}

export const DiceRoller: React.FC<DiceRollerProps> = ({ isRolling, dice }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isRolling) {
      setShow(true);
      // Wait for 2 seconds
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
        animation: 'rollFadeOut 2s ease-out forwards',
        display: 'flex',
        gap: '15px',
      }}>
        <DiceIcon value={dice[0]} delay="0s" />
        <DiceIcon value={dice[1]} delay="0.1s" />
      </div>
      <style>{`
        @keyframes rollFadeOut {
          0% { transform: scale(0.5) translateY(-100px) rotate(-180deg); opacity: 0; }
          20% { transform: scale(1.2) translateY(0px) rotate(10deg); opacity: 1; }
          40% { transform: scale(1) translateY(-10px) rotate(-10deg); opacity: 1; }
          60% { transform: scale(1) translateY(0px) rotate(0deg); opacity: 1; }
          80% { transform: scale(1) translateY(0px) rotate(0deg); opacity: 1; }
          100% { transform: scale(0.8) translateY(0px); opacity: 0; }
        }
        @keyframes subtleShake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(5deg); }
          75% { transform: rotate(-5deg); }
        }
      `}</style>
    </div>
  );
};

const DiceIcon: React.FC<{ value: number, delay: string }> = ({ value, delay }) => {
  const faces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  return (
    <div style={{
      width: 80,
      height: 80,
      backgroundColor: 'rgba(245, 240, 232, 0.9)',
      borderRadius: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '64px',
      color: '#111',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      animation: `subtleShake 0.4s ease-in-out ${delay} 3`,
    }}>
      {faces[value]}
    </div>
  );
};
