import React, { useState, useEffect } from 'react';
import { isSignInWithEmailLink, signInWithEmailLink, sendSignInLinkToEmail, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        onAuthenticated(user);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [onAuthenticated]);

  useEffect(() => {
    // Handle the sign-in link
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let emailForSignIn = window.localStorage.getItem('emailForSignIn');
      
      if (!emailForSignIn) {
        // Prompt user for email if missing from localStorage
        emailForSignIn = window.prompt('Bevestig alstublieft je e-mailadres voor verificatie:');
      }

      if (emailForSignIn) {
        setLoading(true);
        signInWithEmailLink(auth, emailForSignIn, window.location.href)
          .then((result) => {
            window.localStorage.removeItem('emailForSignIn');
            onAuthenticated(result.user);
          })
          .catch((error) => {
            console.error('Error signing in with email link', error);
            setStatus('Er is een fout opgetreden bij het inloggen. De link is mogelijk verlopen.');
            setLoading(false);
          });
      }
    }
  }, [onAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('');

    const actionCodeSettings = {
      // URL you want to redirect back to. The domain (www.example.com) for this
      // URL must be in the authorized domains list in the Firebase Console.
      url: window.location.origin, // Dynamically use the current origin
      handleCodeInApp: true,
    };

    sendSignInLinkToEmail(auth, email, actionCodeSettings)
      .then(() => {
        window.localStorage.setItem('emailForSignIn', email);
        setStatus('Inloglink verstuurd! Controleer je e-mail (ook je spamfolder). Je kunt dit tabblad sluiten.');
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error sending email link', error);
        setStatus('Er ging iets mis bij het versturen van de link. Probeer het later opnieuw.');
        setLoading(false);
      });
  };

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
          <h1 style={styles.title}>Laden...</h1>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Inloggen met E-mail</h1>
        <p style={styles.subtitle}>
          Vul je e-mailadres in en we sturen je een magische link om direct in te loggen zonder wachtwoord.
        </p>

        <form onSubmit={handleLogin} style={styles.form}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Je e-mailadres"
            required
            style={styles.input}
          />
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Versturen...' : 'Stuur inloglink'}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerText}>of</span>
        </div>

        <button onClick={handleGoogleLogin} disabled={loading} style={styles.googleButton}>
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google logo" 
            style={styles.googleIcon} 
          />
          Inloggen met Google
        </button>

        {status && <p style={styles.status}>{status}</p>}
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
    background: '#0a0a0a',
    fontFamily: '"Inter", sans-serif',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '40px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    maxWidth: '400px',
    width: '90%',
    textAlign: 'center',
  },
  title: {
    color: '#d4af37', // Gold color similar to the Tric-Trac aesthetic
    fontSize: '24px',
    marginBottom: '16px',
    margin: 0,
  },
  subtitle: {
    color: '#ccc',
    fontSize: '14px',
    marginBottom: '24px',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    fontSize: '16px',
    outline: 'none',
  },
  button: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #d4af37, #aa8222)',
    color: 'black',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '24px 0',
    color: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    padding: '0 16px',
    fontSize: '14px',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'white',
    color: '#333',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  googleIcon: {
    width: '18px',
    height: '18px',
  },
  status: {
    marginTop: '24px',
    color: '#d4af37',
    fontSize: '14px',
    background: 'rgba(212, 175, 55, 0.1)',
    padding: '12px',
    borderRadius: '8px',
  },
};
