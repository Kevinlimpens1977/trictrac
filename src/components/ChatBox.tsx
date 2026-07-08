import React, { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import type { Player } from '../types/GameState';
import { playChatPing, vibrate } from '../audio/sound';

/**
 * Chat voor online pvp (ontwerp "optie 1"): zwevende bubbel rechtsonder
 * met rood teller-bolletje voor ongelezen berichten; tik = chatvenster.
 * Berichten leven als `chat`-array op het bestaande game-document en
 * worden bij gameover gewist (zie App) — elk potje start dus leeg.
 */

export interface ChatMessage {
  s: Player;       // afzender
  t: string;       // tekst
  at: number;      // ms epoch
}

interface ChatBoxProps {
  gameId: string;
  localPlayer: Player;
  opponentName: string;
}

const MAX_LENGTH = 200;

export const ChatBox: React.FC<ChatBoxProps> = ({ gameId, localPlayer, opponentName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [readCount, setReadCount] = useState(0);

  const openRef = useRef(open);
  openRef.current = open;
  const prevCountRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Berichten volgen op het game-document */
  useEffect(() => {
    // Testhook: met ?test=1 kan tt-chat-mock (JSON-array) de bron zijn,
    // zodat de chat-UI zonder tweede speler te verifiëren is
    if (window.location.search.includes('test=1')) {
      const poll = () => {
        try {
          const raw = localStorage.getItem('tt-chat-mock');
          if (raw) setMessages(JSON.parse(raw));
        } catch { /* negeren */ }
      };
      poll();
      const iv = setInterval(poll, 500);
      return () => clearInterval(iv);
    }

    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      const raw = snap.data();
      if (Array.isArray(raw?.chat)) {
        setMessages(raw.chat as ChatMessage[]);
      }
    });
    return () => unsub();
  }, [gameId]);

  /* Binnenkomend bericht van de tegenstander: ping + tikje (indien dicht) */
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = messages.length;
    if (messages.length <= prev) return;
    const newest = messages[messages.length - 1];
    if (newest?.s !== localPlayer) {
      playChatPing();
      if (!openRef.current) vibrate(25);
    }
  }, [messages, localPlayer]);

  /* Open venster: alles als gelezen markeren + naar onder scrollen */
  useEffect(() => {
    if (!open) return;
    setReadCount(messages.length);
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /* Esc sluit het venster */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = useCallback(() => {
    const text = draft.trim().slice(0, MAX_LENGTH);
    if (!text) return;
    setDraft('');
    const msg: ChatMessage = { s: localPlayer, t: text, at: Date.now() };
    updateDoc(doc(db, 'games', gameId), { chat: arrayUnion(msg) }).catch((e) => {
      console.warn('[Chat] versturen mislukt:', e?.message);
    });
    // Optimistisch tonen zodat het venster direct reageert
    setMessages((prev) => [...prev, msg]);
    setReadCount((c) => c + 1);
  }, [draft, gameId, localPlayer]);

  const unread = Math.max(0, messages.length - readCount);

  return (
    <>
      {open && (
        <div style={styles.window} role="dialog" aria-label={`Chat met ${opponentName}`}>
          <div style={styles.header}>
            <span>Chat met {opponentName}</span>
            <button style={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Sluit chat">
              ✕
            </button>
          </div>
          <div ref={listRef} style={styles.messages}>
            {messages.length === 0 && (
              <div style={styles.empty}>Nog geen berichten — zeg eens hallo! 👋</div>
            )}
            {messages.map((m, i) => (
              <div
                key={`${m.at}-${i}`}
                style={{
                  ...styles.bubble,
                  ...(m.s === localPlayer ? styles.bubbleMe : styles.bubbleThem),
                }}
              >
                {m.t}
              </div>
            ))}
          </div>
          <div style={styles.compose}>
            <input
              ref={inputRef}
              value={draft}
              maxLength={MAX_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder="Typ een bericht…"
              style={styles.input}
            />
            <button style={styles.sendBtn} onClick={send} aria-label="Verstuur bericht">
              ➤
            </button>
          </div>
        </div>
      )}

      <button
        style={{
          ...styles.fab,
          background: open
            ? 'linear-gradient(180deg, #ff6b6b 0%, #c92a2a 100%)'
            : 'linear-gradient(180deg, #5fc3fa 0%, #1e87d6 100%)',
          borderColor: open ? '#861616' : '#104e7d',
        }}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Sluit chat' : unread > 0 ? `Open chat, ${unread} ongelezen` : 'Open chat'}
      >
        {open ? '✕' : '💬'}
        {!open && unread > 0 && (
          <span style={styles.badge}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed',
    right: 'max(14px, env(safe-area-inset-right, 0px))',
    bottom: 'max(14px, env(safe-area-inset-bottom, 0px))',
    zIndex: 600,
    width: 52,
    height: 52,
    borderRadius: '50%',
    border: '2px solid #104e7d',
    color: '#fff',
    fontSize: 22,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 0 rgba(0,0,0,0.25), 0 8px 18px rgba(0,0,0,0.35)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    padding: '0 5px',
    borderRadius: 999,
    background: '#e53935',
    border: '2px solid #fff',
    color: '#fff',
    fontSize: 12,
    fontWeight: 900,
    lineHeight: '16px',
    textAlign: 'center',
  },
  window: {
    position: 'fixed',
    right: 'max(14px, env(safe-area-inset-right, 0px))',
    bottom: 'calc(max(14px, env(safe-area-inset-bottom, 0px)) + 62px)',
    zIndex: 600,
    width: 'min(320px, calc(100vw - 28px))',
    height: 'min(400px, 62dvh)',
    display: 'flex',
    flexDirection: 'column',
    background: '#fffdf6',
    border: '2px solid #8d6e63',
    borderRadius: 14,
    boxShadow: '0 14px 34px rgba(0,0,0,0.45)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px 6px 14px',
    background: 'linear-gradient(180deg, #6d4c33, #5d4433)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 800,
  },
  closeBtn: {
    width: 44,
    height: 44,
    border: 'none',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
  },
  messages: {
    flex: 1,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    overflowY: 'auto',
  },
  empty: {
    margin: 'auto',
    color: '#8d6e63',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  bubble: {
    maxWidth: '80%',
    padding: '7px 11px',
    borderRadius: 12,
    fontSize: 13.5,
    lineHeight: 1.35,
    wordBreak: 'break-word',
  },
  bubbleThem: {
    background: '#f0e0ba',
    color: '#3e2723',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 3,
  },
  bubbleMe: {
    background: '#2e7d32',
    color: '#fff',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 3,
  },
  compose: {
    display: 'flex',
    gap: 6,
    padding: 8,
    borderTop: '1px solid #e0d5bb',
    background: '#faf5e6',
  },
  input: {
    flex: 1,
    minHeight: 40,
    padding: '0 12px',
    borderRadius: 10,
    border: '1.5px solid #c9bda0',
    background: '#fff',
    color: '#3e2723',
    fontSize: 14,
    outline: 'none',
  },
  sendBtn: {
    width: 44,
    height: 44,
    border: 'none',
    borderRadius: 10,
    background: '#2e7d32',
    color: '#fff',
    fontSize: 17,
    cursor: 'pointer',
    boxShadow: '0 2px 0 #1b5e20',
  },
};
