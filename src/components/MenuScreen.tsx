import React, { useState, useRef } from 'react';
import videoMp4 from '../assets/homevideo5s.mp4';
import fallbackImg from '../assets/trictrachome.png';
import helpVideo1Mp4 from '../assets/hulpschermvideo1.mp4';
import helpVideo2Mp4 from '../assets/hulpschermvideo2.mp4';

const DEBUG_HITBOXES = false;

type HelpState = 'closed' | 'opening' | 'content' | 'closing-text' | 'closing';

interface MenuScreenProps {
  onStart: (mode: 'pvp' | 'pva') => void;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({ onStart }) => {
  const [loaded, setLoaded] = useState(false);
  const [helpState, setHelpState] = useState<HelpState>('closed');
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);

  const handleOpenHelp = () => {
    setHelpState('opening');
    if (video1Ref.current) {
      video1Ref.current.currentTime = 0;
      video1Ref.current.play();
    }
  };

  const handleVideo1End = () => {
    if (helpState === 'opening') {
      setHelpState('content');
    }
  };

  const handleCloseHelp = () => {
    // Fade out de tekst eerst
    setHelpState('closing-text');
    
    // Na 500ms (duur van fade out css transition) de tweede video starten
    setTimeout(() => {
      setHelpState('closing');
      if (video2Ref.current) {
        video2Ref.current.currentTime = 0;
        video2Ref.current.play();
      }
    }, 500);
  };

  const handleVideo2End = () => {
    if (helpState === 'closing') {
      setHelpState('closed');
    }
  };

  const isHelpActive = helpState !== 'closed';

  return (
    <div className="startScreen">
      <style>{`
        /* FULLSCREEN WRAPPER */
        .startScreen {
          position: relative;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #050505;
          overflow: hidden;

          /* --- FINETUNED HITBOX VALUES --- */
          --pvp-left: 31%;
          --pvp-top: 90%;
          --pvp-width: 30%;
          --pvp-height: 10%;

          --pvc-left: 69%;
          --pvc-top: 90%;
          --pvc-width: 30%;
          --pvc-height: 10%;
        }

        /* 16:9 STAGE */
        .videoStage {
          position: relative;
          aspect-ratio: 16 / 9;
          width: 100%;
          max-height: 100vh;
          max-width: calc(100vh * (16 / 9));
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
          letter-spacing: 1px;
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

        /* SPELUITLEG BUTTON */
        .speluitleg-btn {
          left: 50%;
          top: 76%; 
          transform: translateX(-50%);
        }
        .speluitleg-btn:hover {
          transform: translateX(-50%) scale(1.045);
        }
        .speluitleg-btn:active {
          transform: translateX(-50%) scale(0.96) translateY(0.4vh);
        }

        /* HELP VIDEOS */
        .helpVideo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          pointer-events: none;
          opacity: 0;
          z-index: 15;
          transition: opacity 0.15s ease-in-out;
        }

        .helpVideo.active {
          opacity: 1;
        }

        /* HELP PANEL TEXTOVERLAY */
        .helpPanel {
          --help-panel-left: 50%;
          --help-panel-top: 50%;
          --help-panel-width: 58%;
          --help-panel-height: 48%;

          position: absolute;
          left: var(--help-panel-left);
          top: var(--help-panel-top);
          width: var(--help-panel-width);
          height: var(--help-panel-height);
          transform: translate(-50%, -50%);
          color: #3e2723;
          font-family: sans-serif;
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
          z-index: 20;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .helpPanel.visible {
          opacity: 1;
          pointer-events: auto;
        }

        /* CLOSE BUTTON */
        .btn-close {
          top: 0;
          right: 0;
          transform: translate(50%, -50%);
          background: linear-gradient(180deg, #ff6b6b 0%, #c92a2a 100%);
          border-color: #861616;
          box-shadow: 0 0.6vh 0 #861616, 0 0.8vh 1.5vh rgba(0,0,0,0.5);
          font-size: 2vh;
          padding: 0.8vh 2vh;
        }
        .btn-close:hover {
          transform: translate(50%, -50%) scale(1.045);
          box-shadow: 0 0.6vh 0 #861616, 0 1vh 2vh rgba(0,0,0,0.6);
        }
        .btn-close:active {
          transform: translate(50%, -50%) scale(0.96) translateY(0.4vh);
          box-shadow: 0 0.2vh 0 #861616, 0 0.4vh 1vh rgba(0,0,0,0.4);
        }

        /* TEKST BINNEN HET PANEEL */
        .helpPanelContent {
          width: 100%;
          height: 100%;
          overflow-y: auto;
          padding: 2vh 4vh;
          box-sizing: border-box;
          text-align: left;
        }

        .helpPanelContent h2 {
          margin: 0 0 2vh 0;
          font-size: 4vh;
          text-align: center;
          font-weight: 900;
          text-transform: uppercase;
        }

        .helpPanelContent p, .helpPanelContent ul {
          font-size: 2.2vh;
          line-height: 1.5;
          margin: 0 0 1.5vh 0;
          font-weight: 500;
        }

        .helpPanelContent ul {
          padding-left: 3vh;
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

        {/* HELP VIDEO 1 (OPENING) */}
        <video 
          ref={video1Ref}
          className={`helpVideo ${['opening', 'content', 'closing-text'].includes(helpState) ? 'active' : ''}`}
          src={helpVideo1Mp4}
          muted
          playsInline
          preload="auto"
          onEnded={handleVideo1End}
        />

        {/* HELP VIDEO 2 (CLOSING) */}
        <video 
          ref={video2Ref}
          className={`helpVideo ${helpState === 'closing' ? 'active' : ''}`}
          src={helpVideo2Mp4}
          muted
          playsInline
          preload="auto"
          onEnded={handleVideo2End}
        />

        {/* OVERLAY LAYER (HIDDEN DURING HELP) */}
        <div className="overlayLayer" style={{ opacity: isHelpActive ? 0 : 1, pointerEvents: isHelpActive ? 'none' : 'auto' }}>
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

          <button className="btn-supercell speluitleg-btn" onClick={handleOpenHelp}>
            Speluitleg
          </button>
        </div>

        {/* HELP TEXT PANEL */}
        <div className={`helpPanel ${helpState === 'content' ? 'visible' : ''}`}>
          <button className="btn-supercell btn-close" onClick={handleCloseHelp}>X</button>
          <div className="helpPanelContent">
            <h2>Speluitleg</h2>
            <p>Tric-Trac is een eeuwenoud bordspel voor twee spelers.</p>
            <ul>
              <li>Beide spelers hebben 15 stenen.</li>
              <li>Gooi met twee dobbelstenen om te verplaatsen.</li>
              <li>Gooi je dubbel? Dan mag je de ogen spelen, én het spiegelbeeld aan de overkant!</li>
              <li>Wie als eerste al zijn stenen veilig van het bord haalt, wint.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
