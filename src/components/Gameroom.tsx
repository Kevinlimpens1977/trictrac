import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot, updateDoc, collection, query, where } from 'firebase/firestore';
import type { GameMode, Player } from '../types/GameState';
import { Die } from './Die';

interface GameroomProps {
  onBack: () => void;
  onStartMatch: (mode: GameMode, playerNames?: { B: string, W: string }, gameId?: string, starter?: Player, localPlayer?: Player) => void;
}

type RoomState = 'lobby' | 'toss';
type LobbyMode = 'menu' | 'local' | 'online';

export const Gameroom: React.FC<GameroomProps> = ({ onStartMatch }) => {
  const [roomState, setRoomState] = useState<RoomState>('lobby');
  const [lobbyMode, setLobbyMode] = useState<LobbyMode>('menu');
  
  const [p1Name, setP1Name] = useState('Speler 1');
  const [p2Name, setP2Name] = useState('Speler 2');
  
  const [gameId, setGameId] = useState('');
  const [joinId, setJoinId] = useState('');
  const [isHost, setIsHost] = useState(true);
  const [isWaiting, setIsWaiting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [isPrivate, setIsPrivate] = useState(false);
  const [openGames, setOpenGames] = useState<any[]>([]);
  const [onlineName, setOnlineName] = useState('');

  const [tossP1, setTossP1] = useState<number | null>(null);
  const [tossP2, setTossP2] = useState<number | null>(null);
  const [isTossing, setIsTossing] = useState(false);
  const [tossWinner, setTossWinner] = useState<Player | null>(null);
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Generate a random 5-character ID for hosting
  useEffect(() => {
    if (roomState === 'lobby' && !gameId) {
      const newId = Math.random().toString(36).substring(2, 7).toUpperCase();
      setGameId(newId);
    }
  }, [roomState, gameId]);

  // Listen for open public games
  useEffect(() => {
    if (roomState === 'lobby') {
      const q = query(
        collection(db, 'games'), 
        where('status', '==', 'waiting')
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const gamesList = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter((game: any) => !game.isPrivate);
        setOpenGames(gamesList);
      });
      return () => unsub();
    }
  }, [roomState]);

  // Firebase listener for host waiting for guest
  useEffect(() => {
    let unsub: () => void;
    if (roomState === 'lobby' && isWaiting && isHost && gameId) {
      console.log('[Host] Setting up listener for gameId:', gameId);
      unsub = onSnapshot(doc(db, 'games', gameId), (snapshot) => {
        console.log('[Host] Snapshot received. Exists?', snapshot.exists());
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('[Host] Snapshot data:', data);
          if (data && data.status === 'playing') {
            console.log('[Host] Guest joined! Transitioning to toss...');
            setP2Name(data.player2 || 'Gast Speler');
            setIsWaiting(false);
            setRoomState('toss');
          }
        } else {
          console.log('[Host] Document does not exist (anymore?)');
        }
      }, (error) => {
        console.error('[Host] Snapshot error:', error);
      });
    }
    return () => {
      if (unsub) unsub();
    };
  }, [roomState, isWaiting, isHost, gameId]);

  // Firebase listener for online toss synchronization
  useEffect(() => {
    if (roomState === 'toss' && isOnlineMode && gameId) {
      const unsub = onSnapshot(doc(db, 'games', gameId), (snapshot) => {
        const data = snapshot.data();
        if (data) {
          // Als de data.tossP1 gezet is en we zijn de guest (of we zijn host en we synchroniseren)
          // Zorg dat guest de toss animatie ziet na ontvangst
          if (!isHost && data.tossP1 !== null && data.tossP2 !== null && data.starter && !isTossing && !tossWinner) {
            setIsTossing(true);
            let count = 0;
            const interval = setInterval(() => {
              setTossP1(Math.floor(Math.random() * 6) + 1);
              setTossP2(Math.floor(Math.random() * 6) + 1);
              count++;
              if (count > 10) {
                clearInterval(interval);
                setTossP1(data.tossP1);
                setTossP2(data.tossP2);
                setIsTossing(false);
                setTossWinner(data.starter);
                
                setTimeout(() => {
                  onStartMatch('pvp', { B: data.player1, W: data.player2 }, gameId, data.starter, 'W');
                }, 2500);
              }
            }, 100);
          }
        }
      });
      return () => unsub();
    }
  }, [roomState, isOnlineMode, isHost, gameId, isTossing, tossWinner, onStartMatch]);

  // Setup host doc
  const handleHostGame = async () => {
    if (!gameId) return;
    if (!onlineName.trim()) {
      setErrorMsg('Vul aub eerst een spelernaam in!');
      return;
    }
    setErrorMsg('');
    setIsWaiting(true);
    setIsOnlineMode(true);
    setP1Name(onlineName);
    await setDoc(doc(db, 'games', gameId), {
      player1: onlineName,
      player2: null,
      status: 'waiting',
      tossP1: null,
      tossP2: null,
      starter: null,
      isPrivate: isPrivate,
      createdAt: new Date().getTime(),
    });
  };

  const handleJoinGame = async (optionalId?: string) => {
    if (!onlineName.trim()) {
      setErrorMsg('Vul aub eerst een spelernaam in!');
      return;
    }
    setErrorMsg('');
    const targetId = typeof optionalId === 'string' ? optionalId : joinId;
    if (!targetId) return;
    setIsHost(false);
    setIsOnlineMode(true);
    setGameId(targetId.toUpperCase());
    
    const docRef = doc(db, 'games', targetId.toUpperCase());
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (!data.player2) {
        await updateDoc(docRef, {
          player2: onlineName,
          status: 'playing'
        });
        setP1Name(data.player1 || 'Speler 1');
        setP2Name(onlineName);
        setRoomState('toss');
      } else {
        setErrorMsg('Game is al vol!');
      }
    } else {
      setErrorMsg('Game ID niet gevonden!');
    }
  };

  const handleLocalStart = () => {
    setIsOnlineMode(false);
    setRoomState('toss');
  };

  const handleCancelHost = async () => {
    setIsWaiting(false);
    if (isOnlineMode && isHost && gameId) {
      try {
        await updateDoc(doc(db, 'games', gameId), {
          status: 'cancelled'
        });
      } catch (err) {
        console.error("Failed to cancel game:", err);
      }
    }
  };

  const handleLobbyModeBack = async () => {
    if (isWaiting) {
      await handleCancelHost();
    }
    setErrorMsg('');
    setLobbyMode('menu');
  };

  // Toss logic for both local and online
  const handleToss = async () => {
    if (isOnlineMode && !isHost) return; // Alleen host rolt
    
    setIsTossing(true);
    
    let count = 0;
    const interval = setInterval(() => {
      setTossP1(Math.floor(Math.random() * 6) + 1);
      setTossP2(Math.floor(Math.random() * 6) + 1);
      count++;
      
      if (count > 10) {
        clearInterval(interval);
        
        let finalP1 = Math.floor(Math.random() * 6) + 1;
        let finalP2 = Math.floor(Math.random() * 6) + 1;
        while (finalP1 === finalP2) {
          finalP1 = Math.floor(Math.random() * 6) + 1;
          finalP2 = Math.floor(Math.random() * 6) + 1;
        }
        
        setTossP1(finalP1);
        setTossP2(finalP2);
        setIsTossing(false);
        
        const winner: Player = finalP1 > finalP2 ? 'B' : 'W';
        setTossWinner(winner);

        if (isOnlineMode && isHost && gameId) {
          updateDoc(doc(db, 'games', gameId), {
            tossP1: finalP1,
            tossP2: finalP2,
            starter: winner
          });
        }

        setTimeout(() => {
          onStartMatch('pvp', { B: p1Name, W: p2Name }, isOnlineMode ? gameId : undefined, winner, isOnlineMode ? 'B' : undefined);
        }, 2500);
      }
    }, 100);
  };

  return (
    <div className="gameRoomScreen" style={styles.container}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .rolling {
          animation: shake 0.2s infinite;
        }
        .gameRoomScreen {
          --room-frame-gap: clamp(10px, 1.6vw, 18px);
          --room-frame-radius: clamp(20px, 2.4vw, 34px);
          position: relative;
          isolation: isolate;
          padding: var(--room-frame-gap);
          box-sizing: border-box;
          overflow: hidden;
          background:
            radial-gradient(circle at 18% 20%, rgba(255, 244, 184, 0.55), transparent 32%),
            radial-gradient(circle at 82% 16%, rgba(219, 235, 255, 0.7), transparent 34%),
            linear-gradient(135deg, #f8fbff 0%, #edf5ff 44%, #fff9d7 100%) !important;
        }
        .gameRoomScreen::before {
          content: '';
          position: absolute;
          inset: -28px;
          z-index: 0;
          background: url('/afbeeldingen/gameroom_new.png') center/cover no-repeat;
          filter: blur(22px) brightness(1.12) saturate(0.82);
          opacity: 0.42;
          transform: scale(1.04);
          pointer-events: none;
        }
        .gameRoomStage {
          position: fixed;
          z-index: 1;
          inset: var(--room-frame-gap);
          margin: auto;
          width: min(calc(100vw - (var(--room-frame-gap) * 2)), calc((100vh - (var(--room-frame-gap) * 2)) * 1.777778)) !important;
          height: min(calc(100vh - (var(--room-frame-gap) * 2)), calc((100vw - (var(--room-frame-gap) * 2)) * 0.5625)) !important;
          max-width: none !important;
          max-height: none !important;
          min-width: 0 !important;
          min-height: 0 !important;
          flex: 0 0 auto;
          overflow: hidden;
          border: 2px solid rgb(255, 255, 255);
          border-radius: var(--room-frame-radius);
          box-sizing: border-box;
          box-shadow: 0 18px 48px rgba(38, 66, 102, 0.28);
        }
        .gameRoomOverlay {
          position: absolute;
          left: var(--room-panel-left, 50%);
          top: var(--room-panel-top, 54%);
          width: var(--room-panel-width, 56%);
          height: var(--room-panel-height, 58%);
          transform: translate(-50%, -50%);
          background: transparent;
          box-sizing: border-box;
          overflow: hidden;
          padding: 10px 24px;
          max-width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .gameRoomChoices {
          width: min(48%, 520px);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: clamp(12px, 2.3dvh, 22px);
          animation: fadeIn 0.3s ease-out;
        }
        .gameRoomChoiceButton {
          min-height: clamp(46px, 7dvh, 68px);
          padding: 0 clamp(16px, 3vw, 28px);
          border: 2px solid rgba(78, 52, 46, 0.35);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.92);
          color: #2d1b16;
          font-family: var(--tt-font-display);
          font-size: clamp(18px, 3dvh, 30px);
          line-height: 1.05;
          letter-spacing: 0;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 5px 0 rgba(96, 58, 22, 0.26), 0 12px 22px rgba(0, 0, 0, 0.2);
          transition: transform 0.12s ease, filter 0.12s ease;
        }
        .gameRoomChoiceHelp {
          border-color: #98e30d;
          text-transform: none;
          font-family: sans-serif;
          font-weight: 900;
        }
        .gameRoomChoiceLocal {
          border-color: #12a8e8;
        }
        .gameRoomChoiceOnline {
          border-color: #12a8e8;
        }
        .gameRoomChoiceButton:hover {
          filter: brightness(1.04);
          transform: translateY(-1px);
        }
        .gameRoomChoiceButton:active {
          transform: translateY(1px);
        }
        .gameRoomSinglePanel {
          width: min(58%, 620px);
          margin: 0 auto;
          animation: fadeIn 0.3s ease-out;
        }
        .gameRoomSinglePanel.isOnline {
          width: min(62%, 680px);
        }
        .gameRoomHelpDialog {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 30;
          width: min(620px, 82%);
          max-height: 74%;
          transform: translate(-50%, -50%);
          overflow-y: auto;
          padding: clamp(20px, 3vw, 32px);
          box-sizing: border-box;
          color: #3e2723;
          background: rgba(255, 255, 255, 0.9);
          border: 2px solid rgba(255, 255, 255, 0.95);
          border-radius: 18px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.36);
          backdrop-filter: blur(8px);
        }
        .gameRoomHelpDialog h2 {
          margin: 0 0 14px;
          text-align: center;
          font-family: var(--tt-font-display);
          font-size: clamp(24px, 4dvh, 38px);
          text-transform: uppercase;
        }
        .gameRoomHelpDialog p,
        .gameRoomHelpDialog li {
          font-size: clamp(15px, 2dvh, 18px);
          line-height: 1.45;
          font-weight: 600;
        }
        .gameRoomHelpClose {
          position: absolute;
          top: 10px;
          right: 12px;
          border: 0;
          border-radius: 999px;
          width: 44px;
          height: 44px;
          background: #c92a2a;
          color: #fff;
          font-weight: 900;
          cursor: pointer;
        }
        @media (max-width: 900px), (max-height: 520px) {
          .gameRoomOverlay {
            left: 50%;
            top: 50%;
            width: min(94vw, 760px);
            height: auto;
            max-height: calc(100dvh - 20px);
            max-width: calc(100% - 16px);
            padding: 12px;
            overflow-y: auto;
            justify-content: flex-start;
            background: rgba(246, 224, 177, 0.9);
            border: 1px solid rgba(78, 52, 46, 0.35);
            border-radius: 14px;
            box-shadow: 0 14px 36px rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(2px);
          }
          .gameRoomChoices,
          .gameRoomSinglePanel,
          .gameRoomSinglePanel.isOnline {
            width: 100%;
          }
          .gameRoomChoices {
            gap: 12px;
          }
          .gameRoomChoiceButton {
            min-height: 46px;
            font-size: clamp(17px, 3.4dvh, 24px);
          }
          .gameRoomColumn {
            height: auto !important;
            min-height: 0;
            justify-content: flex-start !important;
            gap: 8px !important;
          }
        }
        @media (max-width: 560px) and (orientation: portrait) {
          .gameRoomChoices,
          .gameRoomSinglePanel,
          .gameRoomSinglePanel.isOnline {
            width: 100%;
          }
        }
        @media (max-height: 520px) and (orientation: landscape) {
          .gameRoomOverlay {
            width: min(96vw, 820px);
            max-height: calc(100dvh - 12px);
            padding: 6px 12px;
          }
          .gameRoomChoices {
            width: min(64%, 520px);
            gap: 8px;
          }
          .gameRoomChoiceButton {
            min-height: 44px;
            font-size: clamp(16px, 5dvh, 22px);
          }
          /* Compacter zodat het online-paneel met 44px-knoppen zonder
             scrollen past op korte landscape-schermen */
          .gameRoomColumn {
            gap: 5px !important;
          }
          .gameRoomColumn h2 {
            font-size: 16px !important;
            margin: 0 !important;
          }
          .gameRoomColumn input:not([type="checkbox"]) {
            height: 32px !important;
            min-height: 32px !important;
          }
          .gameRoomColumn .gameRoomHostBox {
            gap: 5px !important;
            padding: 5px !important;
          }
          .gameRoomColumn .gameRoomDivider {
            margin: 0 !important;
            font-size: 11px !important;
          }
          .gameRoomColumn .gameRoomGameList {
            max-height: 44px !important;
          }
        }
      `}</style>
      
      <div 
        className="gameRoomStage"
        style={{
          ...styles.gameRoomStage,
          '--room-panel-left': '50%',
          '--room-panel-top': '54%',
          '--room-panel-width': '72%',
          '--room-panel-height': '66%'
        } as React.CSSProperties}
      >
        <div className="gameRoomOverlay">
          {roomState === 'lobby' && (
            <>
            {lobbyMode === 'menu' && (
              <div className="gameRoomChoices">
                <button className="gameRoomChoiceButton gameRoomChoiceHelp" onClick={() => setShowHelp(true)}>
                  Speluitleg
                </button>
                <button className="gameRoomChoiceButton gameRoomChoiceLocal" onClick={() => setLobbyMode('local')}>
                  Speel op één computer
                </button>
                <button className="gameRoomChoiceButton gameRoomChoiceOnline" onClick={() => setLobbyMode('online')}>
                  Speel online
                </button>
              </div>
            )}

            {lobbyMode === 'local' && (
            <div className="gameRoomSinglePanel">
              {/* LEFT COLUMN: LOCAL PLAY */}
              <div className="gameRoomColumn" style={styles.column}>
                <h2 style={styles.columnTitle}>Op 1 computer</h2>
                <input 
                  value={p1Name} 
                  onChange={e => setP1Name(e.target.value)} 
                  style={styles.compactInput} 
                  placeholder="Naam Speler 1 (Zwart)" 
                />
                <input 
                  value={p2Name} 
                  onChange={e => setP2Name(e.target.value)} 
                  style={styles.compactInput} 
                  placeholder="Naam Speler 2 (Wit)" 
                />
                <button onClick={handleLocalStart} className="btn btn--gold btn--block">
                  Start Spel
                </button>
                <button onClick={handleLobbyModeBack} className="btn btn--red btn--block" style={{ marginTop: '10px' }}>
                  Terug
                </button>
              </div>
            </div>
            )}

            {lobbyMode === 'online' && (
            <div className="gameRoomSinglePanel isOnline">
              {/* RIGHT COLUMN: ONLINE PLAY */}
              <div className="gameRoomColumn" style={styles.column}>
                {!isWaiting ? (
                  <>
                    <h2 style={styles.columnTitle}>Online Spelen</h2>
                    <input 
                      value={onlineName} 
                      onChange={e => setOnlineName(e.target.value)} 
                      style={{...styles.compactInput, marginBottom: '4px'}} 
                      placeholder="Jouw Naam" 
                    />
                    
                    <div className="gameRoomHostBox" style={styles.hostBox}>
                      <div style={styles.compactRow}>
                        <span style={styles.idLabel}>Game ID:</span>
                        <div style={styles.idDisplay}>
                          {gameId}
                          <button onClick={() => navigator.clipboard.writeText(gameId)} style={styles.copyBtn}>Copy</button>
                        </div>
                      </div>
                      <div style={styles.compactRow}>
                        <label style={{...styles.idLabel, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'}}>
                          <input 
                            type="checkbox" 
                            checked={isPrivate} 
                            onChange={e => setIsPrivate(e.target.checked)} 
                            style={{cursor: 'pointer'}}
                          />
                          Privé spel
                        </label>
                        <button onClick={handleHostGame} className="btn btn--blue" style={{ width: '50%', fontSize: '14px' }}>
                          Host Game
                        </button>
                      </div>
                    </div>

                    <div className="gameRoomDivider" style={styles.divider}>OF JOIN EEN SPEL</div>
                    
                    <div className="gameRoomGameList" style={styles.gameListContainer}>
                      {openGames.length === 0 ? (
                        <p style={styles.textSmall}>Geen open spellen momenteel...</p>
                      ) : (
                        openGames.map(game => (
                          <div key={game.id} style={styles.gameListItem}>
                            <span style={styles.gameListName}>{game.player1 || 'Anoniem'}'s game</span>
                            <button onClick={() => handleJoinGame(game.id)} style={styles.btnJoinSmall}>Join</button>
                          </div>
                        ))
                      )}
                    </div>

                    <div style={{...styles.compactRow, marginTop: '4px'}}>
                      <input 
                        value={joinId} 
                        onChange={e => setJoinId(e.target.value)} 
                        style={{...styles.compactInput, width: '60%'}} 
                        placeholder="Privé ID" 
                      />
                      <button onClick={() => handleJoinGame()} className="btn btn--blue" style={{ width: '38%', fontSize: '12px' }}>
                        Join ID
                      </button>
                    </div>
                    {errorMsg && <p style={styles.error}>{errorMsg}</p>}
                    <button onClick={handleLobbyModeBack} className="btn btn--red btn--block" style={{ marginTop: '6px' }}>
                      Terug
                    </button>
                  </>
                ) : (
                  <div style={styles.waitingContainer}>
                    <h2 style={styles.columnTitle}>Online Spelen</h2>
                    <div style={styles.spinner}></div>
                    <p style={styles.text}>Wachten op tegenstander...</p>
                    <p style={styles.text}>Deel dit Game ID: <strong>{gameId}</strong></p>
                    <button onClick={handleLobbyModeBack} className="btn btn--red btn--block" style={{ marginTop: '10px' }}>
                      Terug
                    </button>
                  </div>
                )}
              </div>
            </div>
            )}
            </>
          )}

          {roomState === 'toss' && (
            <div style={styles.tossContainer}>
              <h2 style={styles.columnTitle}>De Toss</h2>
              <p style={styles.text}>Wie gooit het hoogst en begint?</p>
              
              <div style={styles.tossDisplay}>
                <div style={styles.playerToss}>
                  <p style={styles.playerName}>{p1Name} (Zwart)</p>
                  {tossP1 !== null ? (
                    <Die value={tossP1} color="black" size={60} rolling={isTossing} />
                  ) : (
                    <div style={styles.tossDie}><span style={styles.questionMark}>?</span></div>
                  )}
                </div>
                <div style={styles.playerToss}>
                  <p style={styles.playerName}>{p2Name} (Wit)</p>
                  {tossP2 !== null ? (
                    <Die value={tossP2} color="white" size={60} rolling={isTossing} />
                  ) : (
                    <div style={styles.tossDie}><span style={styles.questionMark}>?</span></div>
                  )}
                </div>
              </div>

              {!tossWinner && !isTossing && (
                isOnlineMode && !isHost ? (
                  <p style={styles.text}>Wacht op {p1Name} voor de toss...</p>
                ) : (
                  <button onClick={handleToss} className="btn btn--gold">
                    Gooi Dobbelstenen
                  </button>
                )
              )}
              
              {tossWinner && (
                <div style={styles.winnerDisplay}>
                  <h3>{tossWinner === 'B' ? p1Name : p2Name} Wint!</h3>
                  <p style={styles.text}>Spel start zo...</p>
                </div>
              )}
            </div>
          )}
        </div>
        {showHelp && (
          <div className="gameRoomHelpDialog" role="dialog" aria-modal="true">
            <button className="gameRoomHelpClose" onClick={() => setShowHelp(false)} aria-label="Sluit speluitleg">
              X
            </button>
            <h2>Speluitleg</h2>
            <p>Tric-Trac is een eeuwenoud bordspel voor twee spelers.</p>
            <ul>
              <li>Beide spelers hebben 15 stenen.</li>
              <li>Gooi met twee dobbelstenen om te verplaatsen.</li>
              <li>Gooi je dubbel? Dan mag je de ogen spelen, en het spiegelbeeld aan de overkant.</li>
              <li>Wie als eerste al zijn stenen veilig van het bord haalt, wint.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  gameRoomStage: {
    position: 'fixed',
    inset: 'var(--room-frame-gap)',
    margin: 'auto',
    width: '100%',
    height: '100%',
    maxWidth: 'calc(100vh * (16/9))',
    maxHeight: 'calc(100vw / (16/9))',
    aspectRatio: '16 / 9',
    background: 'url("/afbeeldingen/gameroom_new.png") center/cover no-repeat',
    overflow: 'hidden',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    animation: 'fadeIn 0.3s ease-out',
  },
  tossContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    animation: 'fadeIn 0.3s ease-out',
  },
  columnTitle: {
    color: '#3e2723',
    textAlign: 'center',
    margin: '0 0 4px 0',
    fontFamily: 'var(--tt-font-display)',
    fontSize: 'clamp(18px, 2.6dvh, 28px)',
    textTransform: 'uppercase',
    letterSpacing: 0,
    textShadow: '0 1px 2px rgba(255,255,255,0.6)',
  },
  compactRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  idLabel: {
    color: '#4e342e',
    fontFamily: 'sans-serif',
    fontWeight: 'bold',
    fontSize: 'clamp(12px, 1.2vw, 14px)',
    whiteSpace: 'nowrap',
  },
  idDisplay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    background: 'rgba(255,255,255,0.8)',
    padding: '4px 8px',
    borderRadius: '6px',
    color: '#3e2723',
    fontSize: 'clamp(14px, 1.5vw, 18px)',
    fontWeight: 'bold',
    letterSpacing: '1px',
    border: '1px solid #8d6e63',
    flex: 1,
  },
  compactInput: {
    height: 'clamp(36px, 5.5dvh, 40px)',
    padding: '0 12px',
    borderRadius: '8px',
    border: '2px solid #8d6e63',
    background: 'rgba(255,255,255,0.9)',
    color: '#3e2723',
    fontSize: 'clamp(12px, 2dvh, 16px)',
    outline: 'none',
    fontFamily: 'sans-serif',
    textAlign: 'center',
    fontWeight: 'bold',
    boxSizing: 'border-box',
    width: '100%',
  },
  copyBtn: {
    minWidth: '44px',
    minHeight: '44px',
    padding: '0 10px',
    background: '#8d6e63',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '10px',
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  divider: {
    color: '#5d4037',
    textAlign: 'center',
    fontWeight: 'bold',
    margin: '4px 0',
    fontSize: 'clamp(12px, 1.2vw, 16px)',
  },
  hostBox: {
    background: 'rgba(255,255,255,0.4)',
    borderRadius: '8px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  gameListContainer: {
    background: 'rgba(255,255,255,0.6)',
    borderRadius: '8px',
    border: '1px solid #8d6e63',
    padding: '6px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: 'clamp(44px, 14dvh, 110px)',
    minHeight: '44px',
    width: '100%',
    boxSizing: 'border-box',
  },
  gameListItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.9)',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid #bcaaa4',
  },
  gameListName: {
    color: '#3e2723',
    fontWeight: 'bold',
    fontSize: 'clamp(12px, 1.2vw, 14px)',
  },
  btnJoinSmall: {
    minHeight: '44px',
    minWidth: '44px',
    background: 'linear-gradient(180deg, #5fc3fa 0%, #1e87d6 100%)',
    border: '1px solid #104e7d',
    borderRadius: '6px',
    color: 'white',
    fontFamily: 'var(--tt-font-display)',
    textTransform: 'uppercase',
    fontSize: '12px',
    padding: '4px 12px',
    cursor: 'pointer',
    boxShadow: '0 2px 0 #104e7d',
    textShadow: '1px 1px 1px rgba(0,0,0,0.5)',
  },
  textSmall: {
    color: '#4e342e',
    textAlign: 'center',
    margin: 'auto 0',
    fontFamily: 'sans-serif',
    fontWeight: 'bold',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  waitingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    height: '100%',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '4px solid rgba(141,110,99,0.2)',
    borderTop: '4px solid #5fc3fa',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    color: '#d32f2f',
    textAlign: 'center',
    margin: 0,
    fontWeight: 'bold',
    fontSize: '12px',
  },
  text: {
    color: '#4e342e',
    textAlign: 'center',
    margin: 0,
    fontFamily: 'sans-serif',
    fontWeight: 'bold',
    fontSize: 'clamp(12px, 1.2vw, 16px)',
  },
  tossDisplay: {
    display: 'flex',
    justifyContent: 'center',
    gap: '40px',
    margin: '10px 0',
  },
  playerToss: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  playerName: {
    color: '#3e2723',
    fontWeight: 'bold',
    margin: 0,
    fontSize: 'clamp(14px, 1.5vw, 18px)',
  },
  tossDie: {
    width: '60px',
    height: '60px',
    borderRadius: '12px',
    background: 'linear-gradient(160deg, #6d4c33, #4e342e)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 12px rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  questionMark: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#fff',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)'
  },
  winnerDisplay: {
    textAlign: 'center',
    color: '#d84315',
    animation: 'pulse 1.5s infinite',
    fontWeight: 'bold',
    fontSize: 'clamp(18px, 2vw, 24px)',
    textShadow: '0 2px 4px rgba(255,255,255,0.5)',
    margin: 0,
  }
};
