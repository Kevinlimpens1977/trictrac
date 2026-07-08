import React, { useEffect, useState } from 'react';
import { Die } from './Die';
import { playDiceRoll, vibrate } from '../audio/sound';

interface DiceRollerProps {
  isRolling: boolean;
  dice: [number, number] | null;
  /** Dobbelsteengrootte in px (schaalt mee met het bord) */
  size?: number;
}

type Phase = 'hidden' | 'tumbling' | 'resting' | 'fading';

/**
 * Worp-weergave met 3D-tuimelende stenen. Wordt op het bord gerenderd
 * (board-dice-overlay). Fasen: tuimelen (zolang isRolling), ~0.7s rust
 * zodat de waarden leesbaar zijn, dan krimp-fade richting de HUD-tokens.
 */
export const DiceRoller: React.FC<DiceRollerProps> = ({ isRolling, dice, size = 56 }) => {
  const [phase, setPhase] = useState<Phase>('hidden');

  useEffect(() => {
    if (isRolling) {
      setPhase('tumbling');
      playDiceRoll();
      vibrate(30);
    } else {
      // Alleen door naar 'resting' als we daadwerkelijk aan het tuimelen waren
      setPhase(prev => (prev === 'tumbling' ? 'resting' : prev));
    }
  }, [isRolling]);

  useEffect(() => {
    if (phase !== 'resting') return;
    const t1 = setTimeout(() => setPhase('fading'), 700);
    const t2 = setTimeout(() => setPhase('hidden'), 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  if (phase === 'hidden' || !dice) return null;

  return (
    <div className={`board-dice${phase === 'fading' ? ' board-dice--fade' : ''}`}>
      <Die value={dice[0]} size={size} rolling={phase === 'tumbling'} />
      <Die value={dice[1]} size={size} rolling={phase === 'tumbling'} />
    </div>
  );
};
