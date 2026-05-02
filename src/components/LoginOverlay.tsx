import React, { useState } from 'react';
import './LoginOverlay.css';

/**
 * ZET DIT OP TRUE OM DE POSITIES TE FINE-TUNEN!
 * Als dit aan staat, zie je rode transparante blokken over de hitboxes.
 */
const DEBUG_MODE = false;

interface LoginOverlayProps {
  onGoogleLogin: () => void;
  onEmailLogin: (email: string, pass: string) => void;
}

export const LoginOverlay: React.FC<LoginOverlayProps> = ({ onGoogleLogin, onEmailLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Pas deze percentages aan om de hitboxes exact over de afbeelding te leggen!
  // 'left' en 'top' definiëren het MIDDELPUNT van de knop/het veld.
  const positions = {
    googleBtn: { left: '50%', top: '35%', width: '20%', height: '6%' },
    emailInput: { left: '50%', top: '48%', width: '20%', height: '6%' },
    passwordInput: { left: '50%', top: '58%', width: '20%', height: '6%' },
    loginBtn: { left: '50%', top: '70%', width: '20%', height: '6%' },
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      onEmailLogin(email, password);
    }
  };

  return (
    <div className="login-wrapper">
      <div className={`login-container ${DEBUG_MODE ? 'debug-mode' : ''}`}>
        
        {/* De achtergrond afbeelding */}
        <img 
          src="/afbeeldingen/inlogscherm.png" 
          alt="Login Achtergrond" 
          className="login-background" 
        />

        {/* De onzichtbare interactieve laag */}
        <div className="login-overlay">
          
          {/* Google Login Button */}
          <button 
            type="button"
            className="login-element login-btn"
            style={positions.googleBtn}
            onClick={onGoogleLogin}
            aria-label="Doorgaan met Google"
          />

          {/* Formulier voor Email / Wachtwoord */}
          <form onSubmit={handleLoginSubmit}>
            
            {/* Email Input */}
            <input 
              type="email"
              className="login-element login-input"
              style={positions.emailInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="E-mailadres"
              required
            />

            {/* Password Input */}
            <input 
              type="password"
              className="login-element login-input"
              style={positions.passwordInput}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Wachtwoord"
              required
            />

            {/* Inloggen Button */}
            <button 
              type="submit"
              className="login-element login-btn"
              style={positions.loginBtn}
              aria-label="Inloggen"
            />
            
          </form>

        </div>
      </div>
    </div>
  );
};
