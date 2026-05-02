import React from 'react';

interface LeaveGameModalProps {
  isOpen: boolean;
  hasStarted: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const LeaveGameModal: React.FC<LeaveGameModalProps> = ({
  isOpen,
  hasStarted,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={titleStyle}>Spel Verlaten?</h2>
        <p style={textStyle}>
          Je staat op het punt het huidige spel te verlaten.
          {hasStarted && (
            <span style={{ color: '#ff6b6b', display: 'block', marginTop: '10px' }}>
              <strong>Let op:</strong> Je geeft dit spel op. Je tegenstander zal winnen.
            </span>
          )}
        </p>
        <div style={buttonContainerStyle}>
          <button style={cancelButtonStyle} onClick={onCancel}>
            Terug naar Spel
          </button>
          <button style={confirmButtonStyle} onClick={onConfirm}>
            Verlaat Spel
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Styles ---

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: '12px',
  padding: '30px',
  width: '400px',
  maxWidth: '90%',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  textAlign: 'center',
  color: '#f0f0f0',
  fontFamily: 'sans-serif',
};

const titleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: '15px',
  fontSize: '24px',
  fontWeight: 'bold',
};

const textStyle: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: 1.5,
  marginBottom: '30px',
  color: '#ccc',
};

const buttonContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '15px',
};

const baseButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 20px',
  fontSize: '16px',
  fontWeight: 'bold',
  borderRadius: '6px',
  cursor: 'pointer',
  border: 'none',
  transition: 'all 0.2s ease',
};

const cancelButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  backgroundColor: '#4caf50',
  color: '#fff',
  boxShadow: '0 4px 15px rgba(76, 175, 80, 0.3)',
};

const confirmButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  backgroundColor: 'transparent',
  color: '#ff4d4d',
  border: '1px solid #ff4d4d',
};

export default LeaveGameModal;
