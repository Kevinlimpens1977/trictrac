import React, { useState } from 'react';
import videoMp4 from '../assets/homevideo5s.mp4';
import fallbackImg from '../assets/trictrachome.png';

const DEBUG_HITBOXES = false;

interface MenuScreenProps {
  onStart: (mode: 'pvp' | 'pva') => void;
  onLogout?: () => void;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({ onStart, onLogout }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="startScreen">
      <style>{`
        /* FULLSCREEN WRAPPER */
        .startScreen {
          --menu-frame-gap: clamp(10px, 1.6vw, 18px);
          --menu-frame-radius: clamp(20px, 2.4vw, 34px);
          position: relative;
          isolation: isolate;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--menu-frame-gap);
          box-sizing: border-box;
          background:
            radial-gradient(circle at 18% 20%, rgba(255, 244, 184, 0.55), transparent 32%),
            radial-gradient(circle at 82% 16%, rgba(219, 235, 255, 0.7), transparent 34%),
            linear-gradient(135deg, #f8fbff 0%, #edf5ff 44%, #fff9d7 100%);
          overflow: hidden;

          /* --- FINETUNED HITBOX VALUES --- */
          --pvp-left: 16%;
          --pvp-top: 86%;
          --pvp-width: 32%;
          --pvp-height: 10%;

          --pvc-left: 52.4%;
          --pvc-top: 86%;
          --pvc-width: 32%;
          --pvc-height: 10%;
        }

        .startScreen::before {
          content: '';
          position: absolute;
          inset: -28px;
          z-index: 0;
          background: url('${fallbackImg}') center/cover no-repeat;
          filter: blur(22px) brightness(1.12) saturate(0.82);
          opacity: 0.42;
          transform: scale(1.04);
          pointer-events: none;
        }

        /* 16:9 STAGE */
        .videoStage {
          position: relative;
          z-index: 1;
          aspect-ratio: 16 / 9;
          width: min(calc(100vw - (var(--menu-frame-gap) * 2)), calc((100vh - (var(--menu-frame-gap) * 2)) * 1.777778));
          height: min(calc(100vh - (var(--menu-frame-gap) * 2)), calc((100vw - (var(--menu-frame-gap) * 2)) * 0.5625));
          max-width: none;
          max-height: none;
          overflow: hidden;
          border: 2px solid rgb(255, 255, 255);
          border-radius: var(--menu-frame-radius);
          box-sizing: border-box;
          box-shadow: 0 18px 48px rgba(38, 66, 102, 0.28);
          background: #000 url('${fallbackImg}') center/cover no-repeat;
        }

        /* MAIN VIDEO LAYER */
        .stageVideo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          pointer-events: none;
          opacity: 0;
          transition: opacity 1s ease-in-out;
        }
        
        .stageVideo.loaded {
          opacity: 1;
        }

        /* OVERLAY LAYER */
        .overlayLayer {
          position: absolute;
          inset: 0;
          z-index: 10;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }

        /* TRANSPARENT HITBOX BUTTONS */
        .hitboxBtn {
          position: absolute;
          pointer-events: auto;
          background: ${DEBUG_HITBOXES ? 'rgba(255, 0, 0, 0.3)' : 'transparent'};
          border: ${DEBUG_HITBOXES ? '2px solid red' : 'none'};
          color: transparent;
          box-shadow: none;
          opacity: 1;
          font-size: 0;
          overflow: hidden;
          cursor: pointer;
          min-height: 0;
        }

        .hitbox-pvp {
          left: var(--pvp-left);
          top: var(--pvp-top);
          width: var(--pvp-width);
          height: var(--pvp-height);
        }

        .hitbox-pvc {
          left: var(--pvc-left);
          top: var(--pvc-top);
          width: var(--pvc-width);
          height: var(--pvc-height);
        }

        /* --- SUPERCELL / CLASH ROYALE STYLE BUTTONS --- */
        .btn-supercell {
          position: absolute;
          padding: 1.5vh 3vh;
          background: linear-gradient(180deg, #5fc3fa 0%, #1e87d6 100%);
          border: 0.4vh solid #104e7d;
          border-radius: 2vh;
          color: white;
          font-family: "Impact", sans-serif;
          text-transform: uppercase;
          font-size: 2.8vh;
          cursor: pointer;
          box-shadow: 0 0.6vh 0 #104e7d, 0 0.8vh 1.5vh rgba(0,0,0,0.5);
          text-shadow: 0.1vh 0.2vh 0.2vh rgba(0,0,0,0.8);
          transition: all 0.1s ease-in-out;
          pointer-events: auto;
          letter-spacing: 0;
          min-height: 36px;
        }

        .btn-supercell:hover {
          transform: scale(1.045);
          filter: brightness(1.1);
          box-shadow: 0 0.6vh 0 #104e7d, 0 1vh 2vh rgba(0,0,0,0.6);
        }

        .btn-supercell:active {
          transform: scale(0.96) translateY(0.4vh);
          box-shadow: 0 0.2vh 0 #104e7d, 0 0.4vh 1vh rgba(0,0,0,0.4);
        }

        /* LOGOUT BUTTON */
        .logout-btn {
          top: 4%;
          right: 4%;
          font-size: 2vh;
          padding: 1vh 2vh;
          border-radius: 1.5vh;
          background: linear-gradient(180deg, #ff8c8c 0%, #e63939 100%);
          border-color: #8b0000;
          box-shadow: 0 0.6vh 0 #8b0000, 0 0.8vh 1.5vh rgba(0,0,0,0.5);
        }
        .logout-btn:hover {
          background: linear-gradient(180deg, #ff9999 0%, #ff4d4d 100%);
          box-shadow: 0 0.6vh 0 #8b0000, 0 1vh 2vh rgba(0,0,0,0.6);
        }
        .logout-btn:active {
          box-shadow: 0 0.2vh 0 #8b0000, 0 0.4vh 1vh rgba(0,0,0,0.4);
        }

        @media (orientation: portrait) {

        }

        @media (max-height: 520px) {
          .btn-supercell {
            padding: 1vh 2.6vh;
            font-size: clamp(16px, 4dvh, 24px);
          }

        }
      `}</style>

      <div className="videoStage">
        {/* MAIN IDLE VIDEO */}
        <video 
          className={`stageVideo ${loaded ? 'loaded' : ''}`}
          autoPlay 
          muted 
          loop 
          playsInline 
          preload="auto"
          onCanPlay={() => setLoaded(true)}
        >
          <source src={videoMp4} type="video/mp4" />
        </video>

        <div className="overlayLayer">
          <button 
            className="hitboxBtn hitbox-pvp" 
            aria-label="Start speler tegen speler"
            onClick={() => onStart('pvp')}
          />
          
          <button 
            className="hitboxBtn hitbox-pvc" 
            aria-label="Start speler tegen computer"
            onClick={() => onStart('pva')}
          />

          {onLogout && (
            <button className="btn-supercell logout-btn" onClick={onLogout}>
              Uitloggen
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
