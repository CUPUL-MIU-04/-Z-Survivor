import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, GameStats } from './types';
import { generateMissionReport, generateBossTaunt } from './services/geminiService';
import { 
  Skull, Play, RotateCcw, Trophy, Radio, 
  Settings, HelpCircle, Info, Heart, Users, 
  Pause, X, Music, Volume2, Globe 
} from 'lucide-react';

type ModalType = 'settings' | 'howto' | 'about' | 'support' | 'collabs' | null;
type Language = 'es' | 'en';

const translations = {
  es: {
    start: "INICIAR JUEGO",
    settings: "Configuración",
    howto: "Cómo Jugar",
    about: "Acerca de",
    support: "Apoyo",
    collabs: "Colaboraciones",
    paused: "PAUSA",
    resume: "REANUDAR",
    gameOver: "MISIÓN FALLIDA",
    score: "Puntuación",
    waves: "Rondas",
    kills: "Bajas",
    accuracy: "Precisión",
    menu: "MENÚ",
    redeploy: "REINTENTAR",
    loading: "Analizando datos tácticos...",
    volumeSFX: "Volumen SFX",
    volumeMusic: "Volumen Música",
    saved: "Ajustes guardados para esta sesión.",
    howtoContent: [
      "Usa WASD para moverte y el Mouse para apuntar.",
      "En móvil: Joystick izquierdo (Mover), Botón rojo (Disparar).",
      "MUNICIÓN: Las balas se acaban. Mata zombies para encontrar cajas de munición.",
      "RECARGA: Pulsa 'R' o espera a que se vacíe el cargador.",
      "SOBREVIVE: Hordas masivas y Jefes pondrán a prueba tu habilidad."
    ],
    aboutContent: "Creado por Luis Cupul 04",
    supportContent: "¡Gracias por jugar! Si te gusta, compártelo.",
    warningBoss: "ADVERTENCIA: JEFE DETECTADO",
    warningHorde: "¡ALERTA DE HORDA!",
    collabGemini: "Narrativa y Análisis",
    collabReact: "Motor Gráfico",
    ammo: "MUNICIÓN",
    reloading: "RECARGANDO...",
    outOfAmmo: "¡SIN MUNICIÓN!",
    lowAmmo: "MUNICIÓN BAJA"
  },
  en: {
    start: "START GAME",
    settings: "Settings",
    howto: "How to Play",
    about: "About",
    support: "Support",
    collabs: "Collabs",
    paused: "PAUSED",
    resume: "RESUME",
    gameOver: "MISSION FAILED",
    score: "Score",
    waves: "Waves",
    kills: "Kills",
    accuracy: "Accuracy",
    menu: "MENU",
    redeploy: "REDEPLOY",
    loading: "Analyzing tactical data...",
    volumeSFX: "SFX Volume",
    volumeMusic: "Music Volume",
    saved: "Settings saved for this session.",
    howtoContent: [
      "Use WASD to move and Mouse to aim/shoot.",
      "Mobile: Left Joystick (Move), Red Button (Auto-fire).",
      "AMMO: Bullets are limited. Kill zombies to find ammo crates.",
      "RELOAD: Press 'R' or empty the clip to reload.",
      "SURVIVE: Massive Hordes and Bosses will test your skills."
    ],
    aboutContent: "Created by Luis Cupul 04",
    supportContent: "Thanks for playing! Share if you like it.",
    warningBoss: "WARNING: BOSS DETECTED",
    warningHorde: "HORDE ALERT!",
    collabGemini: "Narrative & Analysis",
    collabReact: "Game Engine",
    ammo: "AMMO",
    reloading: "RELOADING...",
    outOfAmmo: "NO AMMO!",
    lowAmmo: "LOW AMMO"
  }
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [lastStats, setLastStats] = useState<GameStats | null>(null);
  const [geminiReport, setGeminiReport] = useState<string>("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [waveMessage, setWaveMessage] = useState<string>("");
  const [lang, setLang] = useState<Language>('es');
  
  // Menu Modal State
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Fake Settings State
  const [volume, setVolume] = useState(80);
  const [music, setMusic] = useState(60);

  const t = translations[lang];

  const startGame = () => {
    setGameState(GameState.PLAYING);
    setGeminiReport("");
    setWaveMessage("");
  };

  const togglePause = () => {
    if (gameState === GameState.PLAYING) {
      setGameState(GameState.PAUSED);
    } else if (gameState === GameState.PAUSED) {
      setGameState(GameState.PLAYING);
    }
  };

  const handleGameOver = async (stats: GameStats) => {
    setLastStats(stats);
    setGameState(GameState.GAME_OVER);
    
    setLoadingReport(true);
    const report = await generateMissionReport(stats);
    setGeminiReport(report);
    setLoadingReport(false);
  };

  const handleWaveChange = async (wave: number, isHorde?: boolean) => {
      if (isHorde) {
        setWaveMessage(t.warningHorde);
        setTimeout(() => setWaveMessage(""), 3000);
        return;
      }

      // Special boss warning for tens
      if (wave % 10 === 0) {
        setWaveMessage(t.warningBoss);
        setTimeout(() => setWaveMessage(""), 5000);
      } else {
        generateBossTaunt(wave).then(msg => {
            setWaveMessage(msg);
            setTimeout(() => setWaveMessage(""), 4000);
        });
      }
  };

  const renderModalContent = () => {
    if (!activeModal) return null;

    let title = "";
    let content = null;

    switch(activeModal) {
      case 'settings':
        title = t.settings;
        content = (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2"><Globe className="w-4 h-4"/> Language / Idioma</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setLang('es')}
                  className={`flex-1 py-2 rounded border ${lang === 'es' ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                >
                  Español
                </button>
                <button 
                  onClick={() => setLang('en')}
                  className={`flex-1 py-2 rounded border ${lang === 'en' ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                >
                  English
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2"><Volume2 className="w-4 h-4"/> {t.volumeSFX}</span>
                <span>{volume}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-2"><Music className="w-4 h-4"/> {t.volumeMusic}</span>
                <span>{music}%</span>
              </div>
              <input 
                type="range" min="0" max="100" value={music} onChange={(e) => setMusic(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
            <div className="p-3 bg-slate-900/50 rounded text-xs text-slate-500">
              {t.saved}
            </div>
          </div>
        );
        break;
      case 'howto':
        title = t.howto;
        content = (
          <div className="space-y-4 text-slate-300">
             <ul className="space-y-3">
                {t.howtoContent.map((line, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-red-500 font-bold">•</span>
                    <span>{line}</span>
                  </li>
                ))}
             </ul>
          </div>
        );
        break;
      case 'about':
        title = t.about;
        content = (
          <div className="text-slate-300 space-y-4">
            <p>
              <strong>Z-Survivor: Gemini Protocol</strong>
            </p>
            <p className="text-lg font-bold text-white border-b border-slate-700 pb-2">
              {t.aboutContent}
            </p>
            <p className="text-sm text-slate-400">
              Versión: 1.4.0 (Horde & Ammo Update)<br/>
              Motor: React + HTML5 Canvas<br/>
              IA: Google Gemini 2.5 Flash
            </p>
          </div>
        );
        break;
      case 'support':
        title = t.support;
        content = (
          <div className="text-center space-y-4">
            <Heart className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
            <p className="text-slate-300">
              {t.supportContent}
            </p>
            <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold w-full">
              Donar (Simulado)
            </button>
          </div>
        );
        break;
      case 'collabs':
        title = t.collabs;
        content = (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded hover:bg-slate-700/50 transition">
              <div className="bg-blue-500 w-10 h-10 rounded-full flex items-center justify-center font-bold">G</div>
              <div>
                <h4 className="text-white font-bold">Google Gemini</h4>
                <p className="text-xs text-slate-400">{t.collabGemini}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded hover:bg-slate-700/50 transition">
              <div className="bg-indigo-500 w-10 h-10 rounded-full flex items-center justify-center font-bold">R</div>
              <div>
                <h4 className="text-white font-bold">React Community</h4>
                <p className="text-xs text-slate-400">{t.collabReact}</p>
              </div>
            </div>
          </div>
        );
        break;
    }

    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
            <h2 className="text-xl font-creep text-red-500 tracking-wider">{title}</h2>
            <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6">
            {content}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden select-none">
      
      {/* Game Layer */}
      <GameCanvas 
        gameState={gameState} 
        setGameState={setGameState} 
        onGameOver={handleGameOver}
        onWaveChange={handleWaveChange}
        lang={lang}
      />

      {/* Pause Overlay */}
      {gameState === GameState.PAUSED && (
        <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-slate-900/90 p-8 rounded-2xl border border-slate-600 shadow-2xl text-center">
            <h2 className="font-creep text-5xl text-yellow-500 mb-2 tracking-widest">{t.paused}</h2>
            <p className="text-slate-400 mb-6 font-mono text-sm">TACTICAL FREEZE ACTIVE</p>
            <button 
              onClick={togglePause}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-8 rounded-full flex items-center justify-center gap-2 mx-auto transition-transform hover:scale-105"
            >
              <Play className="w-5 h-5 fill-black" /> {t.resume}
            </button>
          </div>
        </div>
      )}

      {/* Pause Button (In Game) */}
      {gameState === GameState.PLAYING && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30">
           <button 
             onClick={togglePause}
             className="bg-slate-900/50 hover:bg-slate-800 text-slate-200 p-2 rounded-full border border-slate-600 backdrop-blur hover:scale-110 transition-all"
           >
             <Pause className="w-6 h-6 fill-current" />
           </button>
        </div>
      )}

      {/* Dynamic Wave Message Overlay */}
      {waveMessage && (gameState === GameState.PLAYING || gameState === GameState.PAUSED) && (
          <div className="fixed top-1/4 w-full text-center pointer-events-none z-20 animate-bounce">
              <h2 className="font-creep text-4xl md:text-6xl text-red-600 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)] bg-black/50 inline-block px-6 py-2 rounded">
                  {waveMessage}
              </h2>
          </div>
      )}

      {/* Modals */}
      {renderModalContent()}

      {/* Menu Screen */}
      {gameState === GameState.MENU && !activeModal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900">
            {/* Background Grid Animation */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" 
                 style={{ 
                     backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', 
                     backgroundSize: '40px 40px' 
                 }}>
            </div>

            <div className="relative max-w-lg w-full p-8 bg-slate-800/90 backdrop-blur-lg rounded-2xl shadow-2xl border border-slate-700 text-center">
                <div className="mb-6 flex justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-500 blur-xl opacity-20 rounded-full"></div>
                        <Skull className="w-20 h-20 text-slate-200 relative z-10" />
                    </div>
                </div>
                
                <h1 className="font-creep text-5xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-red-400 to-red-700 mb-2 drop-shadow-sm">
                    Z-Survivor
                </h1>
                <p className="text-slate-400 mb-8 font-mono text-sm">
                    PROTOCOL: GEMINI // STATUS: ONLINE
                </p>

                {/* Main Menu Buttons Grid */}
                <div className="grid grid-cols-2 gap-3">
                    {/* START Button (Full Width) */}
                    <button 
                        onClick={startGame}
                        className="col-span-2 group relative px-6 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all duration-200 hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] flex items-center justify-center gap-2 overflow-hidden mb-2"
                    >
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]"></div>
                        <Play className="w-6 h-6 fill-current" />
                        <span className="text-lg tracking-widest">{t.start}</span>
                    </button>

                    {/* Secondary Buttons */}
                    <button onClick={() => setActiveModal('settings')} className="menu-btn">
                      <Settings className="w-4 h-4" /> {t.settings}
                    </button>
                    <button onClick={() => setActiveModal('howto')} className="menu-btn">
                      <HelpCircle className="w-4 h-4" /> {t.howto}
                    </button>
                    <button onClick={() => setActiveModal('about')} className="menu-btn">
                      <Info className="w-4 h-4" /> {t.about}
                    </button>
                    <button onClick={() => setActiveModal('support')} className="menu-btn">
                      <Heart className="w-4 h-4" /> {t.support}
                    </button>
                    <button onClick={() => setActiveModal('collabs')} className="col-span-2 menu-btn">
                      <Users className="w-4 h-4" /> {t.collabs}
                    </button>
                </div>
                
                <style>{`
                  .menu-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    background-color: rgba(30, 41, 59, 0.5);
                    border: 1px solid rgba(71, 85, 105, 0.5);
                    border-radius: 0.5rem;
                    color: #cbd5e1;
                    font-weight: 600;
                    font-size: 0.875rem;
                    transition: all 0.2s;
                  }
                  .menu-btn:hover {
                    background-color: rgba(51, 65, 85, 0.8);
                    border-color: #94a3b8;
                    color: white;
                    transform: translateY(-1px);
                  }
                `}</style>
            </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === GameState.GAME_OVER && lastStats && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
                
                {/* Stats Column */}
                <div className="w-full md:w-1/2 p-8 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-center">
                    <h2 className="font-creep text-5xl text-red-600 mb-6 text-center drop-shadow-md">{t.gameOver}</h2>
                    
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                            <span className="text-slate-400 flex items-center gap-2"><Trophy className="w-4 h-4" /> {t.score}</span>
                            <span className="text-2xl font-bold text-yellow-400">{lastStats.score.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                            <span className="text-slate-400">{t.waves}</span>
                            <span className="text-xl font-bold text-white">{lastStats.wave}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                            <span className="text-slate-400">{t.kills}</span>
                            <span className="text-xl font-bold text-red-400">{lastStats.kills}</span>
                        </div>
                         <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                            <span className="text-slate-400">{t.accuracy}</span>
                            <span className="text-xl font-bold text-blue-400">
                                {Math.floor((lastStats.shotsHit / (lastStats.shotsFired || 1)) * 100)}%
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                      <button 
                          onClick={() => setGameState(GameState.MENU)}
                          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded transition-colors"
                      >
                          {t.menu}
                      </button>
                      <button 
                          onClick={startGame}
                          className="flex-1 py-3 bg-slate-100 hover:bg-white text-slate-900 font-bold rounded flex items-center justify-center gap-2 transition-colors"
                      >
                          <RotateCcw className="w-5 h-5" />
                          {t.redeploy}
                      </button>
                    </div>
                </div>

                {/* AI Report Column */}
                <div className="w-full md:w-1/2 bg-slate-950 p-8 flex flex-col relative">
                    <div className="flex items-center gap-2 mb-4 text-green-500">
                        <Radio className={`w-5 h-5 ${loadingReport ? 'animate-pulse' : ''}`} />
                        <h3 className="font-mono text-sm font-bold tracking-wider">HQ TRANSMISSION</h3>
                    </div>

                    <div className="flex-1 font-mono text-sm leading-relaxed text-green-400/90 border border-green-900/30 bg-green-900/5 p-4 rounded h-64 overflow-y-auto">
                        {loadingReport ? (
                             <div className="flex flex-col gap-2">
                                <span className="animate-pulse">{t.loading}</span>
                             </div>
                        ) : (
                            <div className="typewriter">
                                {geminiReport}
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-4 text-xs text-slate-600 text-center">
                        AI Analysis powered by Google Gemini 2.5
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;