import React, { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { MenuScreen } from './components/MenuScreen';
import { GameBoard } from './components/GameBoard';
import { GameHUD } from './components/GameHUD';
import { GameOverScreen } from './components/GameOverScreen';
import { FloatingDice } from './components/FloatingDice';
import { DiceRoller } from './components/DiceRoller';
import { gameReducer, createInitialState } from './engine/gameReducer';
import { startAILoop } from './engine/aiEngine';
import { getBarCount, getEntryPoint, canLandOn, canBearOff, getValidMoves } from './engine/moveEngine';
import { isPlayerSetupDone } from './engine/setupEngine';
import type { GameMode, Player } from './types/GameState';
import './App.css';

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [exitingPieces, setExitingPieces] = useState<{ id: string, player: Player, point: number }[]>([]);
  const prevPointsRef = useRef(state.points);

  useEffect(() => {
    const prev = prevPointsRef.current;
    const current = state.points;
    let exitedPoint = -1;
    let playerExited: Player | null = null;

    let totalPrev = 0;
    let totalCurr = 0;

    prev.forEach(p => totalPrev += p ? p.count : 0);
    current.forEach(p => totalCurr += p ? p.count : 0);

    if (totalCurr < totalPrev) {
      for (let i = 1; i <= 24; i++) {
        const p1 = prev[i];
        const p2 = current[i];
        if (p1 && (!p2 || p2.count < p1.count)) {
          exitedPoint = i;
          playerExited = p1.owner;
          break;
        }
      }
    }

    if (exitedPoint !== -1 && playerExited) {
      const newExiting = { id: Math.random().toString(), player: playerExited, point: exitedPoint };
      setExitingPieces(prevEx => [...prevEx, newExiting]);
      
      setTimeout(() => {
        setExitingPieces(ex => ex.filter(p => p.id !== newExiting.id));
      }, 1500); // Exiting animation duration
    }

    prevPointsRef.current = current;
  }, [state.points]);

  const remainingStones = state.points.reduce((acc, p) => p && p.owner === state.turn ? acc + p.count : acc, 0);
  const isClimax = canBearOff(state, state.turn) && remainingStones <= 3 && remainingStones > 0;

  /* ─── AI loop ─── */
  useEffect(() => {
    if (state.mode !== 'pva' || state.screen !== 'game') return;
    if (state.turn !== 'W') return;

    const cancel = startAILoop(() => stateRef.current, dispatch);
    return cancel;
  }, [state.mode, state.screen, state.turn]);

  /* ─── Auto Setup Loop (Human) ─── */
  useEffect(() => {
    if (state.screen !== 'game' || state.isRolling) return;
    if (state.turn === 'W' && state.mode === 'pva') return; // AI handles its own

    const isSetup = !isPlayerSetupDone(state, state.turn);
    
    // Auto setup
    if (isSetup && state.validTos.length === 1) {
      const timer = setTimeout(() => {
        dispatch({ type: 'SETUP_PLACE', point: state.validTos[0] });
      }, 600); // 600ms delay voor mooie weergave
      return () => clearTimeout(timer);
    }

    // Auto bear-off (Euforisch einde)
    if (!isSetup && canBearOff(state, state.turn) && state.remainingDice.length > 0) {
      const allMoves: { from: number, to: number }[] = [];
      
      for (let i = 1; i <= 24; i++) {
        const pt = state.points[i];
        if (pt && pt.owner === state.turn) {
          const tos = getValidMoves(state, i, state.remainingDice);
          tos.forEach(to => allMoves.push({ from: i, to }));
        }
      }

      if (allMoves.length > 0) {
        let bestMove = allMoves.find(m => m.to === 25);
        if (!bestMove) bestMove = allMoves[0];
        
        let delay = 300;
        if (isClimax) {
          delay = remainingStones === 1 ? 1200 : 700; // Slow motion finish!
        }

        const timer = setTimeout(() => {
          dispatch({ type: 'MOVE_PIECE', from: bestMove!.from, to: bestMove!.to });
        }, delay);
        return () => clearTimeout(timer);
      }
    }
  }, [state.validTos, state.isRolling, state.screen, state.turn, state.mode, state.remainingDice, state.points]);

  /* ─── Roll Animation ─── */
  useEffect(() => {
    if (state.isRolling) {
      const t = setTimeout(() => {
        dispatch({ type: 'END_ROLL_ANIMATION' });
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [state.isRolling]);

  /* ─── Handlers ─── */
  const handleStart = useCallback((mode: GameMode) => {
    dispatch({ type: 'START_GAME', mode });
  }, []);

  const handleRollDice = useCallback(() => {
    dispatch({ type: 'ROLL_DICE' });
  }, []);

  const handleSelectSet = useCallback((index: number) => {
    dispatch({ type: 'SELECT_DICE_SET', index });
  }, []);

  const handlePointClick = useCallback((point: number) => {
    const s = stateRef.current;
    const isSetup = !isPlayerSetupDone(s, s.turn);

    // Setup phase: click target to place
    if (isSetup && s.validTos.includes(point)) {
      dispatch({ type: 'SETUP_PLACE', point });
      return;
    }

    // Move phase
    if (!isSetup) {
      if (canBearOff(s, s.turn)) {
        // Bear-off is now fully automated via useEffect. Manual clicking is disabled here.
        return;
      }

      // If clicking a valid destination, execute move
      if (s.selected !== null && s.validTos.includes(point)) {
        dispatch({ type: 'MOVE_PIECE', from: s.selected, to: point });
        return;
      }

      // Otherwise, select the point
      dispatch({ type: 'SELECT_POINT', point });
    }
  }, []);

  const handleBarClick = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'move') return;

    const player = s.turn;
    if (getBarCount(s, player) === 0) return;

    // Try to enter from bar
    if (s.remainingDice.length > 0) {
      const firstDie = s.remainingDice[0];
      const entry = getEntryPoint(player, firstDie);

      if (canLandOn(s, entry, player)) {
        // Execute bar entry via move
        dispatch({ type: 'MOVE_PIECE', from: 0, to: entry });
      }
    }
  }, []);

  const handleRestart = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  /* ─── Keyboard Listeners ─── */
  const [showDevTools, setShowDevTools] = useState(false);
  const [introPhase, setIntroPhase] = useState<'intro' | 'game'>('intro');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        setShowDevTools(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (state.screen === 'menu') {
      setIntroPhase('intro');
    }
  }, [state.screen]);

  /* ─── Render ─── */
  if (state.screen === 'menu') {
    return <MenuScreen onStart={handleStart} />;
  }

  return (
    <div style={styles.gameContainer}>
      {showDevTools && (
        <div style={styles.devPanel}>
          <button onClick={() => dispatch({ type: 'DEV_SETUP_COMPLETE' })} style={styles.devBtn}>DEV: Lopen Test</button>
          <button onClick={() => dispatch({ type: 'DEV_ENDGAME_SCENARIO' })} style={styles.devBtn}>DEV: Endgame Test</button>
          <button onClick={() => dispatch({ type: 'DEV_ENDGAME_3' })} style={styles.devBtn}>DEV: Endgame (3 stn)</button>
          <button onClick={() => dispatch({ type: 'DEV_ENDGAME_1' })} style={styles.devBtn}>DEV: Endgame (1 stn)</button>
        </div>
      )}

      <div style={styles.boardWrapper}>
        <GameBoard
          state={state}
          onPointClick={introPhase === 'intro' ? () => {} : handlePointClick}
          onBarClick={introPhase === 'intro' ? () => {} : handleBarClick}
          exitingPieces={exitingPieces}
          isClimax={isClimax}
        >
          {introPhase === 'intro' && (
             <video 
                src="/afbeeldingen/bordopenen.mp4"
                autoPlay
                muted
                playsInline
                onEnded={() => setIntroPhase('game')}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'fill',
                  zIndex: 100,
                  pointerEvents: 'none',
                }}
             />
          )}

          {/* Inject HUD over the right section of the board */}
          {introPhase === 'game' && (
            <div style={styles.hudOverlay}>
              <GameHUD
                state={state}
                onRollDice={handleRollDice}
                onSelectSet={handleSelectSet}
                onUndo={(stepsBack) => dispatch({ type: 'UNDO', stepsBack })}
              />
            </div>
          )}
        </GameBoard>
      </div>
      
      {state.screen === 'gameover' && state.winner && (
        <GameOverScreen winner={state.winner} stats={state.stats} onRestart={handleRestart} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  gameContainer: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
    overflow: 'hidden',
    boxSizing: 'border-box',
    margin: 0,
    padding: 0,
  },
  boardWrapper: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudOverlay: {
    position: 'absolute',
    right: '2%',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '22%',
    height: '80%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
  },
  devPanel: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    display: 'flex',
    gap: '10px',
    zIndex: 1000,
  },
  devBtn: {
    padding: '8px 16px',
    background: 'rgba(212,175,55,0.2)',
    border: '1px solid #d4af37',
    color: '#d4af37',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  },
};

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'white', padding: 40, background: 'red', height: '100vh' }}>
          <h2>Applicatie Crash!</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppWithErrorBoundary() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}
