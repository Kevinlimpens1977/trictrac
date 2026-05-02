import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot, updateDoc, collection, query, where } from 'firebase/firestore';
import type { GameMode, Player } from '../types/GameState';

interface GameroomProps {
  onBack: () => void;
  onStartMatch: (mode: GameMode, playerNames?: { B: string, W: string }, gameId?: string, starter?: Player, localPlayer?: Player) => void;
}

type RoomState = 'lobby' | 'toss';

export const Gameroom: React.FC<GameroomProps> = ({ onBack, onStartMatch }) => {
  const [roomState, setRoomState] = useState<RoomState>('lobby');
  
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

  const handleBack = async () => {
    if (isWaiting) {
      await handleCancelHost();
    }
    onBack();
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
    <div style={styles.container}>
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
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .gameRoomGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          height: 100%;
          align-items: center;
        }
        @media (max-width: 900px) {
          .gameRoomGrid {
            grid-template-columns: 1fr;
            align-items: start;
            overflow-y: auto;
          }
        }
      `}</style>
      
      <div 
        style={{
          ...styles.gameRoomStage,
          '--room-panel-left': '50%',
          '--room-panel-top': '54%',
          '--room-panel-width': '56%',
          '--room-panel-height': '58%'
        } as React.CSSProperties}
      >
        <div className="gameRoomOverlay">
          {roomState === 'lobby' && (
            <div className="gameRoomGrid">
              {/* LEFT COLUMN: LOCAL PLAY */}
              <div style={styles.column}>
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
                <button onClick={handleLocalStart} style={styles.btnSupercell}>
                  Start Spel
                </button>
                <button onClick={handleBack} style={{...styles.btnSupercellRed, marginTop: '10px'}}>
                  Terug
                </button>
              </div>

              {/* RIGHT COLUMN: ONLINE PLAY */}
              <div style={styles.column}>
                {!isWaiting ? (
                  <>
                    <h2 style={styles.columnTitle}>Online Spelen</h2>
                    <input 
                      value={onlineName} 
                      onChange={e => setOnlineName(e.target.value)} 
                      style={{...styles.compactInput, marginBottom: '4px'}} 
                      placeholder="Jouw Naam" 
                    />
                    
                    <div style={styles.hostBox}>
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
                        <button onClick={handleHostGame} style={{...styles.btnSupercellBlue, width: '50%', height: '36px', fontSize: '14px'}}>
                          Host Game
                        </button>
                      </div>
                    </div>

                    <div style={styles.divider}>OF JOIN EEN SPEL</div>
                    
                    <div style={styles.gameListContainer}>
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
                      <button onClick={() => handleJoinGame()} style={{...styles.btnSupercellBlue, width: '38%', height: '40px', fontSize: '12px'}}>
                        Join ID
                      </button>
                    </div>
                    {errorMsg && <p style={styles.error}>{errorMsg}</p>}
                  </>
                ) : (
                  <div style={styles.waitingContainer}>
                    <h2 style={styles.columnTitle}>Online Spelen</h2>
                    <div style={styles.spinner}></div>
                    <p style={styles.text}>Wachten op tegenstander...</p>
                    <p style={styles.text}>Deel dit Game ID: <strong>{gameId}</strong></p>
                    <button onClick={handleCancelHost} style={{...styles.btnSupercellRed, marginTop: '10px'}}>
                      Annuleren
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {roomState === 'toss' && (
            <div style={styles.tossContainer}>
              <h2 style={styles.columnTitle}>De Toss</h2>
              <p style={styles.text}>Wie gooit het hoogst en begint?</p>
              
              <div style={styles.tossDisplay}>
                <div style={styles.playerToss}>
                  <p style={styles.playerName}>{p1Name} (Zwart)</p>
                  <div className={isTossing ? "rolling" : ""} style={styles.tossDie}>
                    {tossP1 !== null ? <DiceFace value={tossP1} color="black" /> : <span style={styles.questionMark}>?</span>}
                  </div>
                </div>
                <div style={styles.playerToss}>
                  <p style={styles.playerName}>{p2Name} (Wit)</p>
                  <div className={isTossing ? "rolling" : ""} style={styles.tossDie}>
                    {tossP2 !== null ? <DiceFace value={tossP2} color="white" /> : <span style={styles.questionMark}>?</span>}
                  </div>
                </div>
              </div>

              {!tossWinner && !isTossing && (
                isOnlineMode && !isHost ? (
                  <p style={styles.text}>Wacht op {p1Name} voor de toss...</p>
                ) : (
                  <button onClick={handleToss} style={styles.btnSupercell}>
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
      </div>
    </div>
  );
};

const DiceFace: React.FC<{value: number, color: 'white' | 'black'}> = ({value, color}) => {
  const isBlack = color === 'black';
  const dotColor = isBlack ? '#e0e0e0' : '#222';
  
  const dotPositions: Record<number, {r: number, c: number}[]> = {
    1: [{r: 2, c: 2}],
    2: [{r: 1, c: 1}, {r: 3, c: 3}],
    3: [{r: 1, c: 1}, {r: 2, c: 2}, {r: 3, c: 3}],
    4: [{r: 1, c: 1}, {r: 1, c: 3}, {r: 3, c: 1}, {r: 3, c: 3}],
    5: [{r: 1, c: 1}, {r: 1, c: 3}, {r: 2, c: 2}, {r: 3, c: 1}, {r: 3, c: 3}],
    6: [{r: 1, c: 1}, {r: 2, c: 1}, {r: 3, c: 1}, {r: 1, c: 3}, {r: 2, c: 3}, {r: 3, c: 3}],
  };

  const faceStyle = {
    ...styles.diceFace,
    backgroundColor: isBlack ? '#222' : '#fff',
  };

  return (
    <div style={faceStyle}>
      {dotPositions[value]?.map((pos, i) => (
        <div 
          key={i} 
          style={{
            gridRow: pos.r, 
            gridColumn: pos.c, 
            alignSelf: 'center',
            justifySelf: 'center',
            ...styles.diceDot, 
            backgroundColor: dotColor
          }}
        />
      ))}
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
    position: 'relative',
    width: '100%',
    height: '100%',
    maxWidth: 'calc(100vh * (16/9))',
    maxHeight: 'calc(100vw / (16/9))',
    aspectRatio: '16 / 9',
    background: 'url("/afbeeldingen/gameroom_new.png") center/cover no-repeat',
    margin: '0 auto',
    overflow: 'hidden',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    height: '100%',
    justifyContent: 'center',
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
    fontFamily: '"Impact", sans-serif',
    fontSize: 'clamp(20px, 2.5vw, 28px)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
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
    height: '40px',
    padding: '0 12px',
    borderRadius: '8px',
    border: '2px solid #8d6e63',
    background: 'rgba(255,255,255,0.9)',
    color: '#3e2723',
    fontSize: 'clamp(12px, 1.2vw, 16px)',
    outline: 'none',
    fontFamily: 'sans-serif',
    textAlign: 'center',
    fontWeight: 'bold',
    boxSizing: 'border-box',
    width: '100%',
  },
  btnSupercell: {
    height: '44px',
    background: 'linear-gradient(180deg, #fbbc05 0%, #e38a04 100%)',
    border: '2px solid #b86200',
    borderRadius: '12px',
    color: 'white',
    fontFamily: '"Impact", sans-serif',
    textTransform: 'uppercase',
    fontSize: 'clamp(14px, 1.5vw, 18px)',
    cursor: 'pointer',
    boxShadow: '0 4px 0 #b86200, 0 6px 12px rgba(0,0,0,0.3)',
    textShadow: '1px 1px 1px rgba(0,0,0,0.5)',
    transition: 'transform 0.1s, filter 0.1s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  btnSupercellBlue: {
    height: '44px',
    background: 'linear-gradient(180deg, #5fc3fa 0%, #1e87d6 100%)',
    border: '2px solid #104e7d',
    borderRadius: '12px',
    color: 'white',
    fontFamily: '"Impact", sans-serif',
    textTransform: 'uppercase',
    fontSize: 'clamp(14px, 1.5vw, 18px)',
    cursor: 'pointer',
    boxShadow: '0 4px 0 #104e7d, 0 6px 12px rgba(0,0,0,0.3)',
    textShadow: '1px 1px 1px rgba(0,0,0,0.5)',
    transition: 'transform 0.1s, filter 0.1s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  btnSupercellRed: {
    height: '44px',
    background: 'linear-gradient(180deg, #ff6b6b 0%, #c92a2a 100%)',
    border: '2px solid #861616',
    borderRadius: '12px',
    color: 'white',
    fontFamily: '"Impact", sans-serif',
    textTransform: 'uppercase',
    fontSize: 'clamp(14px, 1.5vw, 18px)',
    cursor: 'pointer',
    boxShadow: '0 4px 0 #861616, 0 6px 12px rgba(0,0,0,0.3)',
    textShadow: '1px 1px 1px rgba(0,0,0,0.5)',
    transition: 'transform 0.1s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  copyBtn: {
    padding: '4px 8px',
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
    flex: 1,
    background: 'rgba(255,255,255,0.6)',
    borderRadius: '8px',
    border: '1px solid #8d6e63',
    padding: '8px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minHeight: '80px',
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
    background: 'linear-gradient(180deg, #5fc3fa 0%, #1e87d6 100%)',
    border: '1px solid #104e7d',
    borderRadius: '6px',
    color: 'white',
    fontFamily: '"Impact", sans-serif',
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
  diceFace: {
    width: '100%',
    height: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gridTemplateRows: '1fr 1fr 1fr',
    padding: '8px',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.2)',
  },
  diceDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
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


