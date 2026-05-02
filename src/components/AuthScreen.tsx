import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        onAuthenticated(user);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [onAuthenticated]);

  const handleGoogleLogin = () => {
    setLoading(true);
    setStatus('');
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then((result) => {
        onAuthenticated(result.user);
      })
      .catch((error) => {
        console.error('Error signing in with Google', error);
        setStatus('Er is een fout opgetreden bij het inloggen met Google.');
        setLoading(false);
      });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.loadingText}>Laden...</h1>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Het 'patch' kader om de oude elementen af te dekken */}
      <div style={styles.card}>
        <h2 style={styles.title}>Spelen als</h2>
        
        <button onClick={handleGoogleLogin} style={styles.googleButton}>
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google" 
            style={styles.googleIcon} 
          />
          Doorgaan met Google
        </button>

        {status && <div style={styles.status}>{status}</div>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'url(/afbeeldingen/inlogscherm.png) center/cover no-repeat',
    backgroundColor: '#0a0a0a',
    fontFamily: '"Inter", sans-serif',
  },
  card: {
    // Effen beige/hout kleur om de achtergrond af te dekken
    background: '#e6ceaa',
    padding: '40px',
    borderRadius: '24px',
    // Subtiele schaduw zodat het lijkt alsof het op het bord ligt
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1), 0 4px 15px rgba(0,0,0,0.2)',
    width: '470px',
    height: '580px',
    maxWidth: '90%',
    textAlign: 'center',
    zIndex: 10,
    // Verplaats het blok iets naar beneden over de oude inputs
    transform: 'translateY(5vh)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
  },
  title: {
    color: '#5c3a21', // Donkerbruin hout contrast
    fontSize: '20px',
    fontWeight: 'bold',
    margin: 0,
    marginBottom: '10px',
  },
  loadingText: {
    color: '#5c3a21',
    fontSize: '20px',
    margin: 0,
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '14px 24px',
    borderRadius: '12px',
    border: '2px solid rgba(0,0,0,0.1)',
    background: '#ffffff',
    color: '#333',
    fontWeight: 'bold',
    fontSize: '18px',
    cursor: 'pointer',
    transition: 'transform 0.2s, background 0.2s',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  },
  googleIcon: {
    width: '24px',
    height: '24px',
  },
  status: {
    marginTop: '16px',
    color: '#d32f2f',
    fontSize: '14px',
    fontWeight: 'bold',
  },
};
