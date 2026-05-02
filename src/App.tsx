import React, { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { MenuScreen } from './components/MenuScreen';
import { Gameroom } from './components/Gameroom';
import { GameBoard } from './components/GameBoard';
import { GameHUD } from './components/GameHUD';
import { GameOverScreen } from './components/GameOverScreen';
import { AuthScreen } from './components/AuthScreen';
import type { User } from 'firebase/auth';
import { gameReducer, createInitialState } from './engine/gameReducer';
import { startAILoop } from './engine/aiEngine';
import { getBarCount, getEntryPoint, canLandOn, canBearOff, getValidMoves } from './engine/moveEngine';
import { isPlayerSetupDone } from './engine/setupEngine';
import type { GameMode, Player, GameState } from './types/GameState';
import { db } from './firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(() => {
    if (window.location.search.includes('test=1')) {
      return { uid: 'test-user', email: 'test@example.com', displayName: 'Test User' } as unknown as User;
    }
    return null;
  });

  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    if (window.location.search.includes('start_pva=1')) {
      return gameReducer(createInitialState(), { type: 'START_GAME', mode: 'pva' });
    }
    if (window.location.search.includes('start_gameroom=1')) {
      return gameReducer(createInitialState(), { type: 'GO_TO_GAMEROOM' });
    }
    if (window.location.search.includes('start_gameover=1')) {
      const s = gameReducer(createInitialState(), { type: 'START_GAME', mode: 'pva' });
      return { ...s, screen: 'gameover' as const, winner: 'W' as const, stats: { doubles: { B: 2, W: 4 }, hits: { B: 1, W: 3 }, borneOff: { B: 15, W: 15 } } };
    }
    return createInitialState();
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const lastSyncedUpdateIdRef = useRef<string>('');

  /* ─── Online PvP: Write state to Firestore ─── */
  useEffect(() => {
    if (state.mode !== 'pvp' || !state.gameId || state.screen !== 'game') return;
    if (state.lastUpdateId === lastSyncedUpdateIdRef.current) return;

    // Serialize state as JSON string (avoids Firestore nested-array limitations)
    const { history, localPlayer, ...syncable } = state;

    updateDoc(doc(db, 'games', state.gameId), {
      stateJson: JSON.stringify(syncable),
      lastUpdateId: state.lastUpdateId,
    }).catch(err => console.error('[Sync] Write failed:', err));
  }, [state.lastUpdateId, state.gameId, state.mode, state.screen]);

  /* ─── Online PvP: Listen for remote state changes ─── */
  useEffect(() => {
    if (state.mode !== 'pvp' || !state.gameId || state.screen !== 'game') return;

    const unsub = onSnapshot(doc(db, 'games', state.gameId), (snapshot) => {
      if (!snapshot.exists()) return;
      const raw = snapshot.data();

      // No stateJson yet (still in lobby phase) or same update
      if (!raw.stateJson || !raw.lastUpdateId) return;
      if (raw.lastUpdateId === stateRef.current.lastUpdateId) return;

      lastSyncedUpdateIdRef.current = raw.lastUpdateId;

      try {
        const remoteState = JSON.parse(raw.stateJson) as GameState;
        dispatch({
          type: 'SYNC_STATE',
          state: { ...remoteState, history: [] },
        });
      } catch (e) {
        console.error('[Sync] Parse failed:', e);
      }
    });

    return () => unsub();
  }, [state.gameId, state.mode, state.screen]);

  const [exitingPieces, setExitingPieces] = useState<{ id: string, player: Player, point: number }[]>([]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
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
    // In online PvP, only the active player's client handles auto-actions
    if (state.mode === 'pvp' && state.localPlayer && state.localPlayer !== state.turn) return;

    const isSetup = !isPlayerSetupDone(state, state.turn);
    
    // Auto setup
    if (isSetup && state.validTos.length === 1) {
      const timer = setTimeout(() => {
        dispatch({ type: 'SETUP_PLACE', point: state.validTos[0] });
      }, 600); // 600ms delay voor mooie weergave
      return () => clearTimeout(timer);
    }

    // Auto bar re-entry: steen op de bar moet eerst terug op het bord
    if (!isSetup && getBarCount(state, state.turn) > 0 && state.validTos.length === 1) {
      const timer = setTimeout(() => {
        dispatch({ type: 'MOVE_PIECE', from: 0, to: state.validTos[0] });
      }, 600);
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
      // In online PvP, only the active player dispatches END_ROLL_ANIMATION
      // The remote player sees the animation but doesn't mutate state
      const isRemotePlayer = state.mode === 'pvp' && state.localPlayer && state.localPlayer !== state.turn;
      if (isRemotePlayer) return;

      const t = setTimeout(() => {
        dispatch({ type: 'END_ROLL_ANIMATION' });
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [state.isRolling]);

  /* ─── Handlers ─── */
  const handleStart = useCallback((mode: GameMode) => {
    if (mode === 'pvp') {
      dispatch({ type: 'GO_TO_GAMEROOM' });
    } else {
      dispatch({ type: 'START_GAME', mode });
    }
  }, []);

  const handleStartMatch = useCallback((mode: GameMode, playerNames?: { B: string, W: string }, gameId?: string, starter?: Player, localPlayer?: Player) => {
    dispatch({ type: 'START_GAME', mode, playerNames, gameId, starter, localPlayer });
  }, []);

  const handleRollDice = useCallback(() => {
    dispatch({ type: 'ROLL_DICE' });
  }, []);


  const handlePointClick = useCallback((point: number) => {
    const s = stateRef.current;
    
    // Prevent interaction if it's a multiplayer game and it's the opponent's turn
    if (s.mode === 'pvp' && s.localPlayer && s.localPlayer !== s.turn) {
      return;
    }

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

    // Prevent interaction if it's a multiplayer game and it's the opponent's turn
    if (s.mode === 'pvp' && s.localPlayer && s.localPlayer !== s.turn) {
      return;
    }

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

  const confirmLeaveGame = useCallback(() => {
    setShowLeaveConfirm(false);
    dispatch({ type: 'ABANDON_GAME', player: state.turn });
  }, [state.turn]);

  /* ─── Keyboard Listeners ─── */
  const [showDevTools, setShowDevTools] = useState(false);
  const [introPhase, setIntroPhase] = useState<'intro' | 'game'>(() => {
    return window.location.search.includes('start_pva=1') || window.location.search.includes('test=1') ? 'game' : 'intro';
  });

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
  if (!user) {
    return <AuthScreen onAuthenticated={(user) => setUser(user)} />;
  }

  if (state.screen === 'menu') {
    return <MenuScreen onStart={handleStart} />;
  }

  if (state.screen === 'gameroom') {
    return (
      <Gameroom
        onBack={() => dispatch({ type: 'RESET' })}
        onStartMatch={handleStartMatch}
      />
    );
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
                localPlayer={state.localPlayer}
                onRollDice={handleRollDice}
                onUndo={(stepsBack) => dispatch({ type: 'UNDO', stepsBack })}
                onLeaveGame={() => setShowLeaveConfirm(true)}
              />
            </div>
          )}
        </GameBoard>
      </div>
      
      {state.screen === 'gameover' && state.winner && (
        <GameOverScreen winner={state.winner} stats={state.stats} onRestart={handleRestart} />
      )}

      {showLeaveConfirm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Spel Verlaten</h2>
            <p style={styles.modalText}>Weet je zeker dat je het spel wilt verlaten? Je keert terug naar het beginscherm en de huidige voortgang gaat verloren.</p>
            <div style={styles.modalActions}>
              <button 
                style={styles.modalBtnCancel} 
                onClick={() => setShowLeaveConfirm(false)}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Annuleren
              </button>
              <button 
                style={styles.modalBtnConfirm} 
                onClick={confirmLeaveGame}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,53,69,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
                }}
              >
                Verlaten
              </button>
            </div>
          </div>
        </div>
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
    /* Below SPELRESULTAAT header: x 643-905 of 976, y ~145-440 of 509 */
    left: '66%',
    top: '28%',
    width: '26.5%',
    height: '58%',
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
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modalContent: {
    background: 'linear-gradient(135deg, rgba(30,30,45,0.95), rgba(15,15,25,0.95))',
    border: '1px solid rgba(212,175,55,0.3)',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '400px',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
  modalTitle: {
    margin: '0 0 16px 0',
    color: '#d4af37',
    fontSize: '24px',
    fontWeight: 'bold',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  },
  modalText: {
    color: '#e0e0e0',
    fontSize: '15px',
    lineHeight: '1.5',
    marginBottom: '24px',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
  },
  modalBtnCancel: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  modalBtnConfirm: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #dc3545, #a71d2a)',
    border: '1px solid #7a151f',
    color: '#fff',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
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
