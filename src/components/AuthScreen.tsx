import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signInAnonymously, GoogleAuthProvider } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebase';
import './AuthScreen.css';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

function AuthArtCard() {
  return (
    <div className="auth-art-card auth-art-card--variant-a" aria-hidden="true">
      {/* Variant A: overlay only, the source image stays one responsive background. */}
      <div className="trictrac-logo-overlay">
        <div className="trictrac-logo-shine" />
      </div>
    </div>
  );
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

    // Terugkomst van de mobiele redirect-flow: fouten zichtbaar maken
    // (succes loopt vanzelf via onAuthStateChanged hierboven)
    getRedirectResult(auth).catch((error) => {
      console.error('Redirect-login mislukt', error);
      setStatus('Inloggen is niet gelukt. Probeer het opnieuw.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [onAuthenticated]);

  const handleGuestLogin = () => {
    setLoading(true);
    setStatus('');
    signInAnonymously(auth)
      .then((result) => {
        onAuthenticated(result.user);
      })
      .catch((error) => {
        console.error('Error signing in anonymously', error);
        setStatus('Gastmodus is momenteel niet beschikbaar.');
        setLoading(false);
      });
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    setStatus('');
    const provider = new GoogleAuthProvider();

    // Op mobiel is signInWithPopup onbetrouwbaar (iOS Safari blokkeert de
    // terugweg); de redirect-flow met first-party authDomain werkt daar wel.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      signInWithRedirect(auth, provider).catch((error) => {
        console.error('Redirect-login starten mislukt', error);
        setStatus('Er is een fout opgetreden bij het inloggen met Google.');
        setLoading(false);
      });
      return; // de pagina navigeert weg
    }

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
      <div className="auth-screen" style={styles.container}>
        <AuthArtCard />
        <div className="auth-card" style={styles.card}>
          <h1 style={styles.loadingText}>Laden...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen" style={styles.container}>
      <AuthArtCard />
      {/* Het 'patch' kader om de oude elementen af te dekken */}
      <div className="auth-card" style={styles.card}>
        <button onClick={handleGoogleLogin} style={styles.googleButton}>
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google" 
            style={styles.googleIcon} 
          />
          Doorgaan met Google
        </button>

        <button onClick={handleGuestLogin} style={styles.guestButton}>
          Speel als gast
        </button>

        {status && <div style={styles.status}>{status}</div>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100vw',
    height: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    fontFamily: '"Inter", sans-serif',
  },
  card: {
    padding: '14px 24px',
    borderRadius: '22px',
    boxShadow: '0 16px 40px rgba(0,0,0,0.22)',
    width: 'auto',
    minWidth: 'min(340px, 86vw)',
    maxWidth: 'min(440px, 90vw)',
    textAlign: 'center',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
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
    minHeight: '44px',
    padding: '8px 24px',
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
  guestButton: {
    width: '100%',
    minHeight: '44px',
    padding: '4px 24px',
    borderRadius: '12px',
    border: '2px dashed rgba(0,0,0,0.25)',
    background: 'transparent',
    color: '#5c3a21',
    fontWeight: 'bold',
    fontSize: '15px',
    cursor: 'pointer',
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
