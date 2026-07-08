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
import { DiceRoller } from './components/DiceRoller';
import { Coach } from './components/Coach';
import { ChatBox } from './components/ChatBox';
import { loadStats, recordGame, type PlayerStats } from './stats';
import { playPieceMove, playHit, playBearOff, vibrate } from './audio/sound';
import { db } from './firebase';
import { doc, getDoc, updateDoc, onSnapshot, deleteField } from 'firebase/firestore';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(() => {
    if (window.location.search.includes('test=1')) {
      return { uid: 'test-user', email: 'test@example.com', displayName: 'Test User' } as unknown as User;
    }
    return null;
  });

  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    // Testhook: laad een voorbereide state (alleen met test=1&resume=1)
    if (window.location.search.includes('test=1') && window.location.search.includes('resume=1')) {
      try {
        const raw = localStorage.getItem('tt-savegame');
        if (raw) return { ...JSON.parse(raw), history: [] } as GameState;
      } catch { /* val terug op normale start */ }
    }
    if (window.location.search.includes('start_pva=1')) {
      return gameReducer(createInitialState(), { type: 'START_GAME', mode: 'pva' });
    }
    if (window.location.search.includes('start_gameroom=1') || window.location.search.includes('join=')) {
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
    if (state.mode !== 'pvp' || !state.gameId) return;
    // Ook de allerlaatste state (gameover door winst of verlaten) moet
    // gesynct worden, anders blijft de tegenstander eeuwig wachten.
    if (state.screen !== 'game' && state.screen !== 'gameover') return;
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

      // Tegenstander heeft het spel geannuleerd zonder nieuwe state
      // (vroeg verlaten of tab gesloten): behandel als verlaten
      if (
        raw.status === 'cancelled' &&
        stateRef.current.screen === 'game' &&
        (!raw.lastUpdateId || raw.lastUpdateId === stateRef.current.lastUpdateId)
      ) {
        const opp: Player = stateRef.current.localPlayer === 'B' ? 'W' : 'B';
        dispatch({ type: 'ABANDON_GAME', player: opp });
        return;
      }

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

  /* ─── Persistentie: savegame (lokaal/pva) + reconnect (online) ─── */
  type ResumeOffer =
    | { kind: 'local' }
    | { kind: 'online'; gameId: string; localPlayer: Player | null };
  const [resumeOffer, setResumeOffer] = useState<ResumeOffer | null>(() => {
    if (window.location.search.includes('test=1')) return null;
    try {
      const online = localStorage.getItem('tt-online-game');
      if (online) {
        const parsed = JSON.parse(online);
        if (parsed?.gameId) return { kind: 'online', gameId: parsed.gameId, localPlayer: parsed.localPlayer ?? null };
      }
      if (localStorage.getItem('tt-savegame')) return { kind: 'local' };
    } catch { /* corrupte opslag negeren */ }
    return null;
  });

  const clearSaves = useCallback(() => {
    try {
      localStorage.removeItem('tt-savegame');
      localStorage.removeItem('tt-online-game');
    } catch { /* private mode */ }
  }, []);

  // Autosave: elke state-wijziging tijdens het spelen
  useEffect(() => {
    if (state.screen !== 'game') return;
    try {
      if (state.mode === 'pvp' && state.gameId) {
        localStorage.setItem('tt-online-game', JSON.stringify({
          gameId: state.gameId,
          localPlayer: state.localPlayer ?? null,
        }));
      } else {
        localStorage.setItem('tt-savegame', JSON.stringify({ ...state, history: [] }));
      }
    } catch { /* opslag vol/geblokkeerd is geen spelfout */ }
  }, [state.lastUpdateId, state.screen, state.mode, state.gameId, state.localPlayer, state]);

  // Opruimen zodra een potje echt klaar is (incl. de chat van dit potje)
  useEffect(() => {
    if (state.screen !== 'gameover') return;
    clearSaves();
    if (state.mode === 'pvp' && state.gameId) {
      updateDoc(doc(db, 'games', state.gameId), { chat: deleteField() }).catch(() => {});
    }
  }, [state.screen, state.mode, state.gameId, clearSaves]);

  /* ─── Carrière-statistieken per gebruiker ─── */
  const [career, setCareer] = useState<PlayerStats | null>(() => (user ? loadStats(user.uid) : null));
  const gameStartRef = useRef<number>(Date.now());
  const recordedRef = useRef(false);

  useEffect(() => {
    if (state.screen === 'game') {
      gameStartRef.current = Date.now();
      recordedRef.current = false;
    }
    if (state.screen === 'gameover' && state.winner && user && !recordedRef.current) {
      recordedRef.current = true;
      // Perspectief van deze gebruiker: pva = zwart; online = localPlayer;
      // lokaal 2-spelers potje heeft geen eigen perspectief.
      let me: Player | null = null;
      if (state.mode === 'pva') me = 'B';
      else if (state.gameId && state.localPlayer) me = state.localPlayer;

      const updated = recordGame(user.uid, {
        won: me ? state.winner === me : null,
        doubles: me ? state.stats.doubles[me] : 0,
        hits: me ? state.stats.hits[me] : 0,
        durationMs: Date.now() - gameStartRef.current,
      });
      setCareer(updated);
    }
  }, [state.screen, state.winner, state.mode, state.gameId, state.localPlayer, state.stats, user]);

  const resumeLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem('tt-savegame');
      if (raw) {
        const saved = JSON.parse(raw) as GameState;
        dispatch({ type: 'SYNC_STATE', state: { ...saved, history: [] } });
      }
    } catch {
      clearSaves();
    }
    setResumeOffer(null);
  }, [clearSaves]);

  const resumeOnline = useCallback(async (gameId: string, localPlayer: Player | null) => {
    setResumeOffer(null);
    try {
      const snap = await getDoc(doc(db, 'games', gameId));
      const data = snap.exists() ? snap.data() : null;
      if (data?.stateJson && data.status === 'playing') {
        const remote = JSON.parse(data.stateJson) as GameState;
        dispatch({
          type: 'SYNC_STATE',
          state: { ...remote, history: [], localPlayer: localPlayer ?? undefined },
        });
        return;
      }
    } catch (e) {
      console.error('[Reconnect] mislukt:', e);
    }
    clearSaves(); // potje bestaat niet meer
  }, [clearSaves]);

  const declineResume = useCallback(() => {
    clearSaves();
    setResumeOffer(null);
  }, [clearSaves]);

  /* Reageer op expliciete bord-events uit de reducer (geen state-diffing
     meer: een hit kan zo nooit meer als bear-off worden gelezen). */
  const lastEventSeqRef = useRef(0);
  useEffect(() => {
    const ev = state.lastEvent;
    if (!ev) return;
    if (ev.seq <= lastEventSeqRef.current) {
      lastEventSeqRef.current = ev.seq; // undo: teller terugzetten, niet opnieuw afspelen
      return;
    }
    lastEventSeqRef.current = ev.seq;

    if (ev.type === 'move') {
      playPieceMove();
    } else if (ev.type === 'hit') {
      playHit();
      vibrate([40, 60, 40]);
    } else if (ev.type === 'bearoff') {
      playBearOff();
      vibrate(60);
      const exiting = { id: `${ev.seq}`, player: ev.player, point: ev.from };
      setExitingPieces(prev => [...prev, exiting]);
      setTimeout(() => {
        setExitingPieces(ex => ex.filter(pc => pc.id !== exiting.id));
      }, 1500);
    }
  }, [state.lastEvent]);

  const remainingStones = state.points.reduce((acc, p) => p && p.owner === state.turn ? acc + p.count : acc, 0);
  const isClimax = canBearOff(state, state.turn) && remainingStones <= 3 && remainingStones > 0;

  /* Instelling: automatisch uitspelen (bear-off). Default aan. */
  const [autoBearOff, setAutoBearOff] = useState(() => {
    try { return localStorage.getItem('tt-autobearoff') !== '0'; } catch { return true; }
  });
  const autoBearOffRef = useRef(autoBearOff);
  autoBearOffRef.current = autoBearOff;
  const toggleAutoBearOff = useCallback(() => {
    setAutoBearOff(prev => {
      try { localStorage.setItem('tt-autobearoff', prev ? '0' : '1'); } catch { /* private mode */ }
      return !prev;
    });
  }, []);

  /* ─── Online turn-timer: 60s per beurt in pvp ───
     Gebaseerd op een LOKAAL klok-anker per beurtwissel (immuun voor
     klokverschil tussen apparaten). Reageert de actieve speler niet
     (tab dicht, slaapstand), dan neemt de wachtende client de beurt
     over na een korte gratieperiode — het spel kan nooit meer hangen. */
  const TURN_SECONDS = (() => {
    const t = Number(new URLSearchParams(window.location.search).get('turnsecs'));
    return Number.isFinite(t) && t > 0 ? t : 60; // testhook
  })();
  const TAKEOVER_GRACE = Math.max(3, Math.round(TURN_SECONDS / 4));
  const [turnRemaining, setTurnRemaining] = useState<number | null>(null);
  const turnAnchorRef = useRef(Date.now());
  useEffect(() => {
    turnAnchorRef.current = Date.now();
  }, [state.turn, state.turnStartedAt]);

  useEffect(() => {
    if (!(state.mode === 'pvp' && state.gameId && state.screen === 'game')) {
      setTurnRemaining(null);
      return;
    }
    const tick = () => {
      const elapsed = (Date.now() - turnAnchorRef.current) / 1000;
      const remain = Math.max(0, Math.ceil(TURN_SECONDS - elapsed));
      setTurnRemaining(remain);

      const iAmActive = state.localPlayer === state.turn;
      if (iAmActive && remain === 0 && !state.isRolling) {
        dispatch({ type: 'FORFEIT_TURN', reason: 'Tijd om! Beurt verloren.' });
        return;
      }
      // Actieve speler reageert niet: wachtende client neemt de beurt over
      if (!iAmActive && state.localPlayer && elapsed > TURN_SECONDS + TAKEOVER_GRACE) {
        const opp = state.playerNames?.[state.turn] ?? 'Je tegenstander';
        dispatch({ type: 'FORFEIT_TURN', reason: `${opp} reageerde niet binnen de tijd — jij bent aan de beurt.` });
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [state.mode, state.gameId, state.screen, state.turnStartedAt, state.turn, state.localPlayer, state.isRolling, TURN_SECONDS, TAKEOVER_GRACE]);

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

    // Auto bear-off (Euforisch einde) — alleen als de instelling aan staat
    if (!isSetup && autoBearOff && canBearOff(state, state.turn) && state.remainingDice.length > 0) {
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
  }, [state.validTos, state.isRolling, state.screen, state.turn, state.mode, state.remainingDice, state.points, autoBearOff, isClimax, remainingStones]);

  /* ─── Roll Animation ─── */
  useEffect(() => {
    if (state.isRolling) {
      // In online PvP, only the active player dispatches END_ROLL_ANIMATION
      // The remote player sees the animation but doesn't mutate state
      const isRemotePlayer = state.mode === 'pvp' && state.localPlayer && state.localPlayer !== state.turn;
      if (isRemotePlayer) return;

      const t = setTimeout(() => {
        dispatch({ type: 'END_ROLL_ANIMATION' });
      }, 1200);
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

    // Tap tijdens de worp-animatie = animatie overslaan
    if (s.isRolling) {
      dispatch({ type: 'END_ROLL_ANIMATION' });
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
      if (canBearOff(s, s.turn) && autoBearOffRef.current) {
        // Automatisch uitspelen staat aan; de useEffect speelt de zetten
        return;
      }

      // Handmatig uitspelen: tweede tik op het geselecteerde punt speelt de steen uit
      if (s.selected === point && s.validTos.includes(25)) {
        dispatch({ type: 'MOVE_PIECE', from: point, to: 25 });
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
    if (s.isRolling) {
      if (!(s.mode === 'pvp' && s.localPlayer && s.localPlayer !== s.turn)) {
        dispatch({ type: 'END_ROLL_ANIMATION' });
      }
      return;
    }
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
    const s = stateRef.current;
    // Online: markeer het spel als geannuleerd zodat de tegenstander het
    // direct ziet, ook als de gameover-state-sync hem niet zou bereiken
    if (s.mode === 'pvp' && s.gameId) {
      updateDoc(doc(db, 'games', s.gameId), { status: 'cancelled' }).catch(() => {});
    }
    clearSaves();
    // De verlater ben IK (online = mijn kleur); alleen bij lokaal spelen op
    // één scherm is 'wie aan de beurt is' de beste benadering
    const leaver: Player = (s.mode === 'pvp' && s.gameId && s.localPlayer) ? s.localPlayer : s.turn;
    dispatch({ type: 'ABANDON_GAME', player: leaver });
  }, [clearSaves]);

  /* ─── Keyboard Listeners ─── */
  const [showDevTools, setShowDevTools] = useState(false);
  const introSeen = () => {
    try { return sessionStorage.getItem('tt-intro-seen') === '1'; } catch { return false; }
  };
  const [introPhase, setIntroPhase] = useState<'intro' | 'game'>(() => {
    if (window.location.search.includes('start_pva=1') || window.location.search.includes('test=1')) return 'game';
    return introSeen() ? 'game' : 'intro';
  });
  const finishIntro = useCallback(() => {
    try { sessionStorage.setItem('tt-intro-seen', '1'); } catch { /* private mode */ }
    setIntroPhase('game');
  }, []);
  const [isMobilePortrait, setIsMobilePortrait] = useState(() => {
    return window.matchMedia('(max-width: 700px) and (orientation: portrait)').matches;
  });
  const [showRotateHint, setShowRotateHint] = useState(() => {
    try { return sessionStorage.getItem('tt-rotate-hint') !== '1'; } catch { return true; }
  });
  const dismissRotateHint = useCallback(() => {
    setShowRotateHint(false);
    try { sessionStorage.setItem('tt-rotate-hint', '1'); } catch { /* private mode */ }
  }, []);

  const rotateHintBanner = (floating: boolean) => (
    isMobilePortrait && showRotateHint ? (
      <div className={`rotate-hint${floating ? ' rotate-hint--floating' : ''}`} role="status">
        <span>🔄 Draai je telefoon horizontaal voor een groter bord</span>
        <button className="rotate-hint-close" onClick={dismissRotateHint} aria-label="Sluit tip">
          ✕
        </button>
      </div>
    ) : null
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        setShowDevTools(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /* ─── Keyboard-bediening van het bord (toegankelijkheid) ───
     ←/→ loopt door eigen punten (of geldige doelen bij selectie),
     Enter bevestigt, Esc deselecteert, R gooit, U neemt terug. */
  const [kbFocus, setKbFocus] = useState<number | null>(null);

  useEffect(() => {
    if (state.screen !== 'game') return;

    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.mode === 'pvp' && s.localPlayer && s.localPlayer !== s.turn) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'r' || e.key === 'R') {
        if (!s.rawDice && !s.isRolling) dispatch({ type: 'ROLL_DICE' });
        return;
      }
      if (e.key === 'u' || e.key === 'U') {
        if (s.history.length > 0) dispatch({ type: 'UNDO', stepsBack: 1 });
        return;
      }
      if (e.key === 'Escape') {
        if (s.selected !== null) dispatch({ type: 'SELECT_POINT', point: -1 });
        setKbFocus(null);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const candidates = s.selected !== null && s.validTos.length > 0
          ? [...s.validTos].filter(p => p >= 1 && p <= 24).sort((a, b) => a - b)
          : Array.from({ length: 24 }, (_, i) => i + 1).filter(i => s.points[i]?.owner === s.turn);
        if (candidates.length === 0) return;
        setKbFocus(prev => {
          const idx = prev !== null ? candidates.indexOf(prev) : -1;
          return candidates[(idx + dir + candidates.length) % candidates.length];
        });
        return;
      }
      if (e.key === 'Enter' && kbFocus !== null) {
        handlePointClick(kbFocus);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.screen, kbFocus, handlePointClick]);

  // Esc sluit de verlaat-dialoog
  useEffect(() => {
    if (!showLeaveConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLeaveConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showLeaveConfirm]);

  useEffect(() => {
    if (state.screen === 'menu' && !introSeen()) {
      setIntroPhase('intro');
    }
  }, [state.screen]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px) and (orientation: portrait)');
    const update = () => setIsMobilePortrait(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  /* ─── Render ─── */
  if (!user) {
    return <AuthScreen onAuthenticated={(user) => setUser(user)} />;
  }

  if (state.screen === 'menu') {
    return (
      <>
        <MenuScreen onStart={handleStart} career={career} />
        {rotateHintBanner(true)}
        {resumeOffer && (
          <div style={{ ...styles.modalOverlay, position: 'fixed' }}>
            <div style={styles.modalContent}>
              <h2 style={styles.modalTitle}>Potje hervatten?</h2>
              <p style={styles.modalText}>
                {resumeOffer.kind === 'online'
                  ? `Je was nog verbonden met online potje ${resumeOffer.gameId}. Opnieuw verbinden?`
                  : 'Er staat nog een onafgemaakt potje klaar. Wil je verdergaan waar je was gebleven?'}
              </p>
              <div style={styles.modalActions}>
                <button style={styles.modalBtnCancel} onClick={declineResume}>
                  Nieuw spel
                </button>
                <button
                  style={{ ...styles.modalBtnConfirm, background: 'linear-gradient(135deg, #4caf50, #2e7d32)', border: '1px solid #1b5e20' }}
                  onClick={() => resumeOffer.kind === 'online'
                    ? resumeOnline(resumeOffer.gameId, resumeOffer.localPlayer)
                    : resumeLocal()}
                >
                  Hervatten
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (state.screen === 'gameroom') {
    const joinParam = new URLSearchParams(window.location.search).get('join');
    return (
      <>
        <Gameroom
          onBack={() => dispatch({ type: 'RESET' })}
          onStartMatch={handleStartMatch}
          initialJoinId={joinParam ?? undefined}
        />
        {rotateHintBanner(true)}
      </>
    );
  }

  return (
    <div className="game-shell" style={styles.gameContainer}>
      {showDevTools && (
        <div style={styles.devPanel}>
          <button onClick={() => dispatch({ type: 'DEV_SETUP_COMPLETE' })} style={styles.devBtn}>DEV: Lopen Test</button>
          <button onClick={() => dispatch({ type: 'DEV_ENDGAME_SCENARIO' })} style={styles.devBtn}>DEV: Endgame Test</button>
          <button onClick={() => dispatch({ type: 'DEV_ENDGAME_3' })} style={styles.devBtn}>DEV: Endgame (3 stn)</button>
          <button onClick={() => dispatch({ type: 'DEV_ENDGAME_1' })} style={styles.devBtn}>DEV: Endgame (1 stn)</button>
        </div>
      )}

      {introPhase === 'game' && rotateHintBanner(false)}

      <div className="board-wrapper" style={styles.boardWrapper}>
        <GameBoard
          state={state}
          onPointClick={introPhase === 'intro' ? () => {} : handlePointClick}
          onBarClick={introPhase === 'intro' ? () => {} : handleBarClick}
          exitingPieces={exitingPieces}
          isClimax={isClimax}
          flightEvent={state.lastEvent}
          focusPoint={kbFocus}
        >
          {introPhase === 'intro' && (
            <div
              onPointerUp={finishIntro}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 100,
                cursor: 'pointer',
              }}
            >
              <video
                src="/afbeeldingen/bordopenen.mp4"
                autoPlay
                muted
                playsInline
                onEnded={finishIntro}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                }}
              />
              <button onClick={finishIntro} style={styles.skipIntroBtn} aria-label="Intro overslaan">
                Overslaan ▸
              </button>
            </div>
          )}

          {/* Worp-animatie op het bord (midden linkerhelft) */}
          {introPhase === 'game' && (
            <div className="board-dice-overlay">
              <DiceRoller isRolling={state.isRolling} dice={state.rawDice} />
            </div>
          )}

          {/* Inject HUD over the right section of the board */}
          {introPhase === 'game' && !isMobilePortrait && (
            <div className="board-hud-overlay">
              <GameHUD
                state={state}
                localPlayer={state.localPlayer}
                onRollDice={handleRollDice}
                onUndo={(stepsBack) => dispatch({ type: 'UNDO', stepsBack })}
                onLeaveGame={() => setShowLeaveConfirm(true)}
                autoBearOff={autoBearOff}
                onToggleAutoBearOff={toggleAutoBearOff}
                turnRemaining={turnRemaining}
              />
            </div>
          )}
        </GameBoard>
      </div>

      {introPhase === 'game' && isMobilePortrait && (
        <div className="mobile-hud-panel">
          <GameHUD
            state={state}
            localPlayer={state.localPlayer}
            onRollDice={handleRollDice}
            onUndo={(stepsBack) => dispatch({ type: 'UNDO', stepsBack })}
            onLeaveGame={() => setShowLeaveConfirm(true)}
            autoBearOff={autoBearOff}
            onToggleAutoBearOff={toggleAutoBearOff}
            turnRemaining={turnRemaining}
          />
        </div>
      )}
      
      {introPhase === 'game' && state.screen === 'game' && <Coach state={state} />}

      {state.mode === 'pvp' && state.gameId && state.localPlayer && state.screen === 'game' && (
        <ChatBox
          gameId={state.gameId}
          localPlayer={state.localPlayer}
          opponentName={state.playerNames[state.localPlayer === 'B' ? 'W' : 'B']}
        />
      )}

      {state.screen === 'gameover' && state.winner && (
        <GameOverScreen winner={state.winner} stats={state.stats} onRestart={handleRestart} career={career} />
      )}

      {showLeaveConfirm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Spel Verlaten</h2>
            <p style={styles.modalText}>Weet je zeker dat je het spel wilt verlaten? Je keert terug naar het beginscherm en de huidige voortgang gaat verloren.</p>
            <div style={styles.modalActions}>
              <button
                style={styles.modalBtnCancel}
                autoFocus
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
    height: '100dvh',
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
  skipIntroBtn: {
    position: 'absolute',
    right: '3%',
    bottom: '4%',
    minHeight: '44px',
    minWidth: '44px',
    padding: '10px 20px',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.5)',
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    backdropFilter: 'blur(3px)',
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
    minHeight: '44px',
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
    minHeight: '44px',
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
