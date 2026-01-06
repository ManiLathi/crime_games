
import React, { useState, useEffect, useRef } from 'react';
import { 
  GameState, Case, Evidence, LevelInfo, Verdict, Character, Suspect, InvestigativeTool, Room, PlayerPos 
} from './types';
import { generateLevelCase, generateSceneImage, calculateVerdict } from './services/geminiService';

const LEVELS: LevelInfo[] = [
  { id: 1, title: 'Basic Investigation', crimeType: 'Simple Theft', difficulty: 'EASY', unlocked: true },
  { id: 2, title: 'Domestic Dispute', crimeType: 'Domestic Violence', difficulty: 'MEDIUM', unlocked: false },
  { id: 3, title: 'Cyber Crime', crimeType: 'UPI Fraud', difficulty: 'MEDIUM', unlocked: false },
  { id: 4, title: 'Suspicious Death', crimeType: 'Suicide vs Murder', difficulty: 'HARD', unlocked: false },
  { id: 5, title: 'Political Pressure', crimeType: 'High-profile Murder', difficulty: 'HARD', unlocked: false },
  { id: 6, title: 'Combined Crime', crimeType: 'Multiple Felonies', difficulty: 'EXPERT', unlocked: false },
  { id: 7, title: 'Daily Justice Mode', crimeType: 'Random Cases', difficulty: 'EXPERT', unlocked: false },
];

const CHARACTERS: Record<string, Character> = {
  Manikandan: { name: 'Manikandan', role: 'Senior Police', specialty: 'Criminal Mindset', avatarIcon: 'fa-user-tie' },
  Malathi: { name: 'Malathi', role: 'Forensics', specialty: 'Trace Analysis', avatarIcon: 'fa-microscope' },
  Madhavan: { name: 'Madhavan', role: 'Senior Advocate', specialty: 'Legal Strategy', avatarIcon: 'fa-scale-balanced' },
  Koushik: { name: 'Koushik Raj', role: 'Cyber Expert', specialty: 'Digital Footprints', avatarIcon: 'fa-laptop-code' },
  Vazhini: { name: 'Vazhini Valli', role: 'Junior Advocate', specialty: 'Fact Checking', avatarIcon: 'fa-user-graduate' },
};

const TOOLS: { id: InvestigativeTool; icon: string; name: string; color: string }[] = [
  { id: 'GLOVES', icon: 'fa-hands', name: 'GLOVES', color: 'blue' },
  { id: 'TORCH', icon: 'fa-flashlight', name: 'TORCH', color: 'yellow' },
  { id: 'UV_LIGHT', icon: 'fa-bolt-lightning', name: 'UV', color: 'purple' },
  { id: 'EVIDENCE_BAG', icon: 'fa-bag-shopping', name: 'BAG', color: 'orange' },
  { id: 'RECORDER', icon: 'fa-microphone', name: 'REC', color: 'red' },
  { id: 'CYBER_KIT', icon: 'fa-microchip', name: 'CYBER', color: 'cyan' },
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('LEVEL_SELECT');
  const [levels, setLevels] = useState(LEVELS);
  const [currentLevel, setCurrentLevel] = useState<LevelInfo | null>(null);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [currentRoomIdx, setCurrentRoomIdx] = useState(0);
  const [inventory, setInventory] = useState<Evidence[]>([]);
  const [integrity, setIntegrity] = useState(100);
  const [activeTool, setActiveTool] = useState<InvestigativeTool | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [qaClue, setQaClue] = useState<Evidence | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [selectedSuspect, setSelectedSuspect] = useState<Suspect | null>(null);
  const [playerPos, setPlayerPos] = useState<PlayerPos>({ x: 50, y: 80 });
  const [playerState, setPlayerState] = useState<'IDLE' | 'WALKING' | 'INVESTIGATING' | 'SUCCESS'>('IDLE');
  const [showTutorial, setShowTutorial] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState<number | null>(null);

  const sceneRef = useRef<HTMLDivElement>(null);

  const startLevel = async (lvl: LevelInfo) => {
    setCurrentLevel(lvl);
    setGameState('LOADING');
    setInventory([]);
    setIntegrity(100);
    setPlayerPos({ x: 50, y: 80 });
    setPlayerState('IDLE');
    setShowTutorial(lvl.id === 1);
    setJustUnlocked(null);
    
    try {
      const caseData = await generateLevelCase(lvl);
      const img = await generateSceneImage(caseData.title, caseData.rooms[0].description);
      caseData.rooms[0].imageUrl = img;
      setCurrentCase(caseData);
      setGameState('BRIEFING');
    } catch (e) {
      alert("Error loading case file.");
      setGameState('LEVEL_SELECT');
    }
  };

  const handleSceneClick = (e: React.MouseEvent) => {
    if (!sceneRef.current || isProcessing || showQA || playerState === 'SUCCESS') return;
    const rect = sceneRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setPlayerState('WALKING');
    setPlayerPos({ x, y });
    
    const room = currentCase?.rooms[currentRoomIdx];
    if (room?.hotspots) {
      const targetHotspot = room.hotspots.find(hs => {
        const dx = Math.abs(hs.x - x);
        const dy = Math.abs(hs.y - y);
        return dx < 5 && dy < 5;
      });

      if (targetHotspot) {
        setTimeout(() => {
          setPlayerState('INVESTIGATING');
          setTimeout(() => {
            setQaClue(room.clue);
            setShowQA(true);
            if (currentLevel?.id === 1) setShowTutorial(false);
          }, 500);
        }, 1000);
      } else {
        setTimeout(() => setPlayerState('IDLE'), 1000);
      }
    } else {
      setTimeout(() => setPlayerState('IDLE'), 1000);
    }
  };

  const attemptCollection = (tool: InvestigativeTool) => {
    if (!qaClue) return;
    setIsProcessing(true);
    setTimeout(() => {
      if (tool === qaClue.requiredTool) {
        setInventory([...inventory, qaClue]);
        setPlayerState('SUCCESS');
        setShowQA(false);
        setQaClue(null);
        setTimeout(() => setPlayerState('IDLE'), 2000);
      } else {
        setIntegrity(prev => Math.max(0, prev - 15));
      }
      setIsProcessing(false);
    }, 800);
  };

  const nextRoom = async () => {
    if (!currentCase) return;
    setIsProcessing(true);
    const nextIdx = (currentRoomIdx + 1) % currentCase.rooms.length;
    if (!currentCase.rooms[nextIdx].imageUrl) {
      const img = await generateSceneImage(currentCase.title, currentCase.rooms[nextIdx].description);
      const updated = { ...currentCase };
      updated.rooms[nextIdx].imageUrl = img;
      setCurrentCase(updated);
    }
    setCurrentRoomIdx(nextIdx);
    setPlayerPos({ x: 50, y: 80 }); 
    setPlayerState('IDLE');
    setIsProcessing(false);
  };

  const fetchVerdict = async () => {
    if (!currentCase || !selectedSuspect) return;
    setGameState('LOADING');
    try {
      const result = await calculateVerdict(currentCase, inventory, integrity);
      setVerdict({ ...result, integrityScore: integrity });
      setGameState('VERDICT');
      
      if (currentLevel) {
        const nextId = currentLevel.id + 1;
        setLevels(prev => {
          const isAlreadyUnlocked = prev.find(l => l.id === nextId)?.unlocked;
          if (nextId <= prev.length && !isAlreadyUnlocked) {
            setJustUnlocked(nextId);
            return prev.map(l => l.id === nextId ? {...l, unlocked: true} : l);
          }
          return prev;
        });
      }
    } catch (e) {
      alert("Failed to reach verdict. Try again.");
      setGameState('COURTROOM');
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 font-sans selection:bg-orange-600 overflow-hidden select-none">
      {/* HUD Header */}
      <div className="fixed top-0 left-0 w-full z-[60] p-4 flex justify-between items-start pointer-events-none">
        <div className="flex gap-4 items-center">
           <div className="relative transform skew-x-[-12deg] bg-slate-900 border-2 border-orange-600 p-2 pr-8 shadow-[0_0_20px_rgba(234,88,12,0.3)] pointer-events-auto">
              <div className="absolute top-0 left-0 w-1 h-full bg-orange-600"></div>
              <div className="text-[10px] font-black tracking-widest text-orange-500 uppercase">Integrity</div>
              <div className="w-48 h-2 bg-slate-800 mt-1 relative">
                <div 
                  className={`h-full transition-all duration-500 ${integrity > 50 ? 'bg-green-500' : 'bg-red-600'}`} 
                  style={{ width: `${integrity}%` }}
                ></div>
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-white/20 to-transparent"></div>
              </div>
           </div>
           <div className="bg-slate-900/80 border border-slate-700 p-2 rounded transform skew-x-[-12deg] pointer-events-auto">
              <i className="fa-solid fa-signal text-green-500 text-xs animate-pulse"></i>
           </div>
        </div>

        <div className="flex flex-col items-end gap-2 pointer-events-auto">
           <div className="bg-black/60 backdrop-blur border border-slate-800 p-2 text-[10px] font-black tracking-tighter text-slate-400">
              LVL 0{currentLevel?.id || 0} | {currentLevel?.title || 'HQ'}
           </div>
           {gameState !== 'LEVEL_SELECT' && (
             <button onClick={() => setGameState('LEVEL_SELECT')} className="bg-red-600/20 border border-red-600 px-4 py-1 text-[10px] font-black uppercase hover:bg-red-600 transition-colors">
               EXIT
             </button>
           )}
        </div>
      </div>

      <main className="h-screen w-full relative">
        {gameState === 'LEVEL_SELECT' && (
          <div className="h-full w-full flex flex-col items-center justify-center p-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black overflow-y-auto">
            <h2 className="text-6xl font-black italic tracking-tighter mb-12 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-200">
               SELECT MISSION
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-6xl">
              {levels.map(lvl => (
                <div 
                  key={lvl.id}
                  onClick={() => lvl.unlocked && startLevel(lvl)}
                  className={`relative p-8 border-2 transition-all transform hover:scale-105 active:scale-95 group overflow-hidden ${lvl.unlocked ? 'border-orange-600 bg-slate-900 shadow-2xl cursor-pointer' : 'border-slate-800 bg-slate-950 opacity-20 cursor-not-allowed'}`}
                >
                  <div className="absolute -right-4 -bottom-4 text-8xl text-white/5 font-black uppercase tracking-tighter">{lvl.id}</div>
                  <div className="relative z-10">
                    <div className="text-[10px] font-black text-orange-500 mb-2">CRIME FILE 00{lvl.id}</div>
                    <h3 className="text-2xl font-black leading-tight mb-2 italic">{lvl.title}</h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{lvl.crimeType}</p>
                    {!lvl.unlocked && <div className="mt-4 flex items-center gap-2 text-slate-600 text-[10px] font-black uppercase"><i className="fa-solid fa-lock"></i> Locked</div>}
                  </div>
                  {lvl.unlocked && <div className="absolute top-0 left-0 w-1 h-0 group-hover:h-full bg-orange-600 transition-all duration-300"></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {gameState === 'LOADING' && (
          <div className="h-full w-full flex flex-col items-center justify-center bg-black">
             <div className="w-24 h-24 border-4 border-slate-800 border-t-orange-600 rounded-full animate-spin"></div>
             <p className="mt-8 text-xs font-black uppercase tracking-[0.5em] text-orange-500 animate-pulse">Establishing Connection...</p>
          </div>
        )}

        {gameState === 'BRIEFING' && currentCase && (
          <div className="h-full w-full flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
             <div className="max-w-4xl w-full bg-slate-900 border-2 border-slate-800 p-10 shadow-[0_0_100px_rgba(234,88,12,0.2)] relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-orange-600"></div>
                <div className="flex gap-8 items-start mb-8">
                   <div className="w-32 h-32 bg-slate-800 border-4 border-orange-600 rounded flex items-center justify-center shrink-0 shadow-2xl animate-bounce">
                      <i className="fa-solid fa-user-tie text-5xl text-orange-500"></i>
                   </div>
                   <div className="space-y-4">
                      <h4 className="text-orange-500 font-black text-sm uppercase tracking-[0.3em]">MISSION BRIEF</h4>
                      <h2 className="text-5xl font-black italic tracking-tighter">{currentCase.title}</h2>
                   </div>
                </div>
                <div className="bg-black/50 p-8 border-l-8 border-orange-600 text-2xl font-serif italic text-slate-300 leading-relaxed mb-8">
                   "{currentCase.backstory}"
                </div>
                <button 
                  onClick={() => setGameState('POLICE_INVESTIGATION')}
                  className="w-full py-6 bg-orange-600 hover:bg-orange-500 font-black uppercase text-xl tracking-[0.3em] shadow-[0_20px_50px_rgba(234,88,12,0.4)] transition-all transform hover:-translate-y-1 active:translate-y-0"
                >
                  START MATCH
                </button>
             </div>
          </div>
        )}

        {gameState === 'POLICE_INVESTIGATION' && currentCase && (
          <div className="h-screen w-full flex flex-col relative bg-black">
            {showTutorial && inventory.length === 0 && (
              <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[55] w-full max-w-sm pointer-events-none animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="bg-orange-600/90 backdrop-blur text-white p-4 border-l-8 border-white shadow-2xl">
                   <p className="text-xs font-black uppercase tracking-widest mb-1">Incoming Transmission</p>
                   <p className="text-sm font-bold italic">"Manikandan here. Click the environment to move. Reach the <span className="text-black">Crosshair Targets</span> to find clues!"</p>
                </div>
              </div>
            )}

            <div 
              ref={sceneRef}
              onClick={handleSceneClick}
              className="flex-1 relative overflow-hidden cursor-crosshair"
            >
               {currentCase.rooms[currentRoomIdx].imageUrl ? (
                 <div className="w-full h-full relative animate-slow-pulse">
                    <img 
                      src={currentCase.rooms[currentRoomIdx].imageUrl} 
                      className="w-full h-full object-cover grayscale opacity-60"
                      alt="Crime Scene"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20 pointer-events-none"></div>
                    {/* Tool VFX Overlay */}
                    {activeTool === 'TORCH' && (
                      <div className="absolute pointer-events-none mix-blend-overlay animate-torch-flicker" style={{ 
                        left: `${playerPos.x}%`, 
                        top: `${playerPos.y}%`,
                        background: 'radial-gradient(circle at center, rgba(255,255,150,0.4) 0%, transparent 60%)',
                        width: '300px',
                        height: '300px',
                        transform: 'translate(-50%, -50%)'
                      }}></div>
                    )}
                    {activeTool === 'UV_LIGHT' && (
                       <div className="absolute inset-0 pointer-events-none bg-purple-900/10 mix-blend-overlay animate-pulse"></div>
                    )}
                 </div>
               ) : <div className="w-full h-full flex items-center justify-center animate-pulse text-slate-700 font-black uppercase tracking-[1em]">Buffering Assets...</div>}

               {/* Animated Hotspots */}
               {currentCase.rooms[currentRoomIdx].hotspots?.map((hs, i) => (
                  <div 
                    key={i} 
                    style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  >
                    {showTutorial && i === 0 && (
                      <div className="absolute bottom-full mb-8 flex flex-col items-center animate-bounce-heavy">
                        <span className="bg-orange-600 text-[10px] font-black uppercase px-3 py-1 mb-2 whitespace-nowrap shadow-xl border-2 border-white">INVESTIGATE HERE</span>
                        <i className="fa-solid fa-arrow-down text-3xl text-orange-500 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]"></i>
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-full border-2 border-orange-500/50 animate-ping"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <i className="fa-solid fa-location-crosshairs text-orange-500 text-xl shadow-lg animate-pulse"></i>
                    </div>
                  </div>
               ))}

               {/* PLAYER CHARACTER WITH DYNAMIC STATES */}
               <div 
                 className={`absolute w-16 h-24 -translate-x-1/2 -translate-y-full transition-all duration-1000 ease-in-out z-40 pointer-events-none`}
                 style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%` }}
               >
                  <div className={`relative w-full h-full flex flex-col items-center transition-transform duration-300
                    ${playerState === 'WALKING' ? 'animate-walking-rhythm scale-110' : ''}
                    ${playerState === 'IDLE' ? 'animate-slow-bob' : ''}
                    ${playerState === 'INVESTIGATING' ? 'scale-90 translate-y-2' : ''}
                    ${playerState === 'SUCCESS' ? 'animate-celebration scale-125' : ''}
                  `}>
                     {/* Success VFX */}
                     {playerState === 'SUCCESS' && (
                       <div className="absolute -top-10 flex flex-col items-center animate-out fade-out zoom-out duration-1000">
                         <div className="bg-green-500 text-white px-2 py-1 rounded-sm text-[8px] font-black uppercase shadow-lg">Evidence Secured!</div>
                         <i className="fa-solid fa-star text-yellow-400 animate-spin text-lg"></i>
                       </div>
                     )}

                     <div className="absolute -top-12 bg-orange-600 px-2 py-0.5 text-[8px] font-black uppercase shadow-lg shadow-orange-900/40">Manikandan</div>
                     
                     {/* State Indicator */}
                     {playerState === 'INVESTIGATING' && (
                        <div className="absolute -top-16 animate-bounce">
                           <i className="fa-solid fa-question text-white text-xs drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]"></i>
                        </div>
                     )}

                     <div className={`w-8 h-8 bg-slate-800 rounded-full border-2 border-orange-600 shadow-xl overflow-hidden mb-1 flex items-center justify-center relative
                       ${playerState === 'INVESTIGATING' ? 'animate-head-scan' : ''}
                     `}>
                        <i className="fa-solid fa-user-tie text-orange-500 text-sm"></i>
                     </div>
                     <div className={`w-10 h-14 bg-slate-900 border-x-2 border-b-2 border-orange-600 rounded-b-lg relative shadow-2xl transition-all duration-500
                       ${playerState === 'INVESTIGATING' ? 'h-10 rotate-3' : ''}
                     `}>
                        <div className="absolute top-1 left-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                        {activeTool && (
                           <div className="absolute -right-4 top-4 bg-black/80 border border-white p-1 rounded-sm animate-pulse">
                              <i className={`fa-solid ${TOOLS.find(t => t.id === activeTool)?.icon} text-[8px] text-white`}></i>
                           </div>
                        )}
                     </div>
                     <div className={`w-12 h-2 bg-black/60 rounded-full mt-2 blur-sm transition-all duration-300
                       ${playerState === 'WALKING' ? 'scale-150 opacity-40' : ''}
                     `}></div>
                  </div>
               </div>
            </div>

            {/* BOTTOM HUD ACTION BAR */}
            <div className="h-48 bg-gradient-to-t from-black to-transparent w-full fixed bottom-0 left-0 z-50 p-6 flex justify-between items-end pointer-events-none">
               <div className="w-32 h-32 bg-slate-900/40 border-2 border-slate-700/50 rounded-full relative pointer-events-auto shadow-inner flex items-center justify-center group transform skew-x-[-12deg]">
                  <div className={`w-12 h-12 bg-orange-600 rounded-full shadow-[0_0_20px_rgba(234,88,12,0.6)] transition-transform ${playerState === 'WALKING' ? 'animate-ping' : ''}`}></div>
                  <div className="absolute text-[8px] font-black uppercase text-slate-700 top-2">Move</div>
                  {showTutorial && (
                    <div className="absolute -top-10 left-full ml-4 whitespace-nowrap bg-black/80 border border-slate-700 p-2 text-[8px] font-black text-orange-400">TAP SCREEN TO MOVE</div>
                  )}
               </div>

               <div className="flex gap-4 items-end pointer-events-auto transform skew-x-[-12deg]">
                  {TOOLS.map((tool) => (
                    <button 
                      key={tool.id}
                      onClick={() => setActiveTool(tool.id)}
                      className={`relative w-16 h-20 transition-all duration-300 border-2 flex flex-col items-center justify-center group ${activeTool === tool.id ? 'bg-orange-600 border-white h-24 translate-y-[-10px] shadow-[0_0_30px_rgba(234,88,12,0.8)]' : 'bg-slate-900 border-slate-700 hover:border-slate-400'}`}
                    >
                       <i className={`fa-solid ${tool.icon} text-xl ${activeTool === tool.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} mb-2`}></i>
                       <span className={`text-[8px] font-black uppercase ${activeTool === tool.id ? 'text-white' : 'text-slate-600'}`}>{tool.name}</span>
                    </button>
                  ))}
               </div>

               <div className="flex flex-col gap-4 pointer-events-auto">
                  <div className="bg-slate-900 border border-slate-700 p-4 transform skew-x-[-12deg] shadow-2xl">
                     <h5 className="text-[10px] font-black text-orange-500 mb-1 uppercase tracking-widest">Zone Location</h5>
                     <p className="text-xl font-black italic tracking-tighter text-white">{currentCase.rooms[currentRoomIdx].name}</p>
                  </div>
                  <button 
                    onClick={nextRoom}
                    className="bg-white text-black px-10 py-4 font-black uppercase tracking-[0.2em] text-sm hover:bg-orange-600 hover:text-white transition-all transform skew-x-[-12deg] shadow-xl"
                  >
                    Next Zone <i className="fa-solid fa-forward ml-2"></i>
                  </button>
                  <button 
                    onClick={() => setGameState('ADVOCATE_ANALYSIS')}
                    className="bg-orange-600 text-white px-10 py-2 font-black uppercase tracking-[0.2em] text-[10px] hover:bg-orange-500 transition-all transform skew-x-[-12deg] shadow-xl"
                  >
                    Finish Search
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* Q&A Modal OVERLAY */}
        {showQA && qaClue && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
             <div className="max-w-xl w-full bg-slate-900 border-4 border-orange-600 p-8 shadow-[0_0_100px_rgba(234,88,12,0.3)] relative overflow-hidden">
                <div className="absolute -right-10 -top-10 text-9xl text-white/5 font-black uppercase -rotate-12 pointer-events-none">EVIDENCE</div>
                
                <div className="flex items-center gap-4 border-b-2 border-slate-800 pb-6 mb-6">
                   <div className="w-16 h-16 bg-orange-600 rounded flex items-center justify-center shadow-xl animate-pulse">
                      <i className="fa-solid fa-fingerprint text-3xl"></i>
                   </div>
                   <div>
                      <h4 className="text-orange-500 font-black text-[10px] uppercase tracking-[0.3em]">Processing Point</h4>
                      <h2 className="text-3xl font-black italic">{qaClue.name}</h2>
                   </div>
                </div>

                <div className="p-6 bg-black border-l-4 border-orange-600 mb-8 shadow-inner">
                   <p className="text-xl font-serif italic text-slate-300 leading-relaxed">"{qaClue.description}"</p>
                </div>

                <div className="space-y-4">
                   <p className="text-[10px] font-black text-center text-slate-500 uppercase tracking-[0.4em] mb-4">Select Equipment to Process</p>
                   {currentLevel?.id === 1 && (
                     <p className="text-[9px] font-bold text-orange-400 text-center animate-pulse mb-2 uppercase">HINT: USE {qaClue.requiredTool.replace('_', ' ')}</p>
                   )}
                   <div className="grid grid-cols-3 gap-3">
                      {TOOLS.map(tool => (
                        <button 
                          key={tool.id}
                          onClick={() => attemptCollection(tool.id)}
                          disabled={isProcessing}
                          className={`flex flex-col items-center gap-2 p-4 bg-slate-800 border-2 border-slate-700 hover:border-orange-600 transition-all group disabled:opacity-50 hover:bg-slate-700 active:scale-95 ${activeTool === tool.id ? 'border-orange-500 shadow-lg' : ''}`}
                        >
                           <i className={`fa-solid ${tool.icon} text-2xl ${activeTool === tool.id ? 'text-orange-500' : 'text-slate-500 group-hover:text-slate-200'}`}></i>
                           <span className="text-[8px] font-black uppercase text-slate-500 group-hover:text-white">{tool.name}</span>
                        </button>
                      ))}
                   </div>
                </div>

                <button 
                  onClick={() => {
                    setShowQA(false);
                    setPlayerState('IDLE');
                  }}
                  className="w-full mt-6 text-[10px] font-black text-slate-600 uppercase hover:text-white transition-colors"
                >
                  DISMISS
                </button>
             </div>
          </div>
        )}

        {gameState === 'ADVOCATE_ANALYSIS' && currentCase && (
          <div className="h-full w-full bg-slate-950 flex flex-col items-center justify-center p-10 overflow-y-auto">
             <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8 animate-in slide-in-from-left duration-500">
                   <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
                      <div className="w-16 h-16 bg-slate-800 border-2 border-orange-600 rounded flex items-center justify-center"><i className="fa-solid fa-scale-balanced text-3xl text-orange-500"></i></div>
                      <div>
                        <h4 className="text-orange-500 font-black text-xs uppercase tracking-widest">Counsel Review</h4>
                        <h2 className="text-4xl font-black italic tracking-tighter">Strategic Analysis</h2>
                      </div>
                   </div>
                   
                   <div className="space-y-3">
                      {inventory.map(ev => (
                        <div key={ev.id} className="p-5 bg-slate-900 border border-slate-800 flex justify-between items-center transform transition-transform hover:scale-105 shadow-xl">
                           <div className="space-y-1">
                              <p className="font-black text-slate-100 uppercase tracking-widest">{ev.name}</p>
                              <p className="text-[9px] text-slate-500 uppercase font-black">{ev.category}</p>
                           </div>
                           <div className="text-right">
                              <div className="text-[10px] font-black text-green-500 mb-1">IMPACT {ev.strength}%</div>
                              <div className={`text-[8px] font-black px-2 py-0.5 border ${ev.isLegal ? 'border-green-800 text-green-500' : 'border-red-900 text-red-600'} uppercase`}>
                                {ev.isLegal ? 'LEGIT' : 'FLAWED'}
                              </div>
                           </div>
                        </div>
                      ))}
                      {inventory.length === 0 && <p className="text-red-600 font-black text-center py-10 animate-pulse uppercase tracking-[0.2em]">WARNING: ZERO EVIDENCE SECURED</p>}
                   </div>
                </div>

                <div className="space-y-8 animate-in slide-in-from-right duration-500">
                   <div className="bg-slate-900 border-2 border-slate-800 p-8 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-2 h-full bg-orange-600"></div>
                      <h3 className="text-xl font-black mb-6 uppercase tracking-widest text-slate-400">SELECT ACCUSED</h3>
                      <div className="space-y-3">
                         {currentCase.suspects.map((s, idx) => (
                           <div 
                            key={idx}
                            onClick={() => setSelectedSuspect(s)}
                            className={`p-5 border transition-all cursor-pointer flex items-center justify-between ${selectedSuspect === s ? 'border-orange-600 bg-orange-600/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}
                           >
                             <div>
                               <p className="font-black text-lg italic text-slate-100">{s.name}</p>
                               <p className="text-[10px] font-black uppercase text-slate-500">{s.role}</p>
                             </div>
                             <div className={`w-4 h-4 rounded-full border-2 ${selectedSuspect === s ? 'bg-orange-600 border-white' : 'border-slate-800'}`}></div>
                           </div>
                         ))}
                      </div>
                   </div>
                   <button 
                    disabled={!selectedSuspect}
                    onClick={() => setGameState('COURTROOM')}
                    className="w-full py-6 bg-white text-black font-black uppercase text-xl tracking-[0.4em] shadow-2xl hover:bg-orange-600 hover:text-white transition-all disabled:opacity-20 active:scale-95"
                   >
                     ENTER TRIAL
                   </button>
                </div>
             </div>
          </div>
        )}

        {gameState === 'COURTROOM' && (
          <div className="h-full w-full bg-black flex flex-col items-center justify-center p-6 text-center space-y-12">
             <div className="space-y-4 animate-in zoom-in-95 duration-1000">
                <h2 className="text-8xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-700">VERDICT PHASE</h2>
                <p className="text-orange-500 font-black tracking-[0.6em] uppercase text-sm">Case Adjourned for Sentencing</p>
             </div>
             
             <div className="relative w-64 h-64 flex items-center justify-center">
                <div className="absolute inset-0 border-8 border-orange-600/20 rounded-full border-t-orange-600 animate-spin"></div>
                <div className="absolute inset-4 border-4 border-white/10 rounded-full border-b-white animate-reverse-spin"></div>
                <i className="fa-solid fa-gavel text-6xl text-white animate-bounce"></i>
             </div>

             <button 
              onClick={fetchVerdict}
              className="px-24 py-6 bg-orange-600 text-white font-black uppercase text-xl tracking-[0.4em] shadow-[0_0_100px_rgba(234,88,12,0.4)] hover:bg-white hover:text-black transition-all active:scale-95"
             >
               FETCH JUDGEMENT
             </button>
          </div>
        )}

        {gameState === 'VERDICT' && verdict && (
          <div className="h-full w-full bg-slate-950 flex flex-col items-center justify-center p-10 space-y-10 animate-in fade-in duration-1000 overflow-y-auto">
             {justUnlocked && (
               <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[70] bg-orange-600 text-white px-8 py-4 font-black uppercase italic tracking-[0.3em] shadow-[0_0_50px_rgba(234,88,12,0.6)] animate-bounce border-2 border-white">
                 MISSION COMPLETE: LEVEL 0{justUnlocked} UNLOCKED!
               </div>
             )}

             <div className={`relative p-8 border-y-8 text-center w-full max-w-4xl transform skew-x-[-12deg] ${verdict.outcome.toUpperCase().includes('CONVICTION') ? 'border-green-600 shadow-[0_0_60px_rgba(22,163,74,0.4)] bg-green-950/20' : 'border-red-600 shadow-[0_0_60px_rgba(220,38,38,0.4)] bg-red-950/20'}`}>
                <h2 className="text-9xl font-black italic tracking-tighter uppercase drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">{verdict.outcome}</h2>
                <p className="mt-4 text-xs font-black uppercase tracking-[1em] text-white/50">Mission Conclusion</p>
             </div>
             
             <div className="max-w-3xl w-full bg-slate-900 border-2 border-slate-800 p-10 shadow-2xl space-y-8 font-serif italic text-3xl leading-snug text-slate-200">
                "{verdict.reasoning}"
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                <div className="p-6 bg-slate-900 border-2 border-slate-800 text-center transform skew-x-[-12deg]">
                   <span className="block text-[10px] font-black text-slate-500 uppercase mb-2">Legal Admissibility</span>
                   <span className="text-4xl font-black text-orange-500">{verdict.legalAccuracy}%</span>
                </div>
                <div className="p-6 bg-slate-900 border-2 border-slate-800 text-center transform skew-x-[-12deg]">
                   <span className="block text-[10px] font-black text-slate-500 uppercase mb-2">Police Ethics</span>
                   <span className="text-4xl font-black text-blue-500">{verdict.integrityScore}%</span>
                </div>
                <div className="p-6 bg-slate-900 border-2 border-slate-800 text-center transform skew-x-[-12deg]">
                   <span className="block text-[10px] font-black text-slate-500 uppercase mb-2">Match Status</span>
                   <span className={`text-sm font-black uppercase ${verdict.outcome.toUpperCase().includes('CONVICTION') ? 'text-green-500' : 'text-red-500'}`}>
                    {verdict.outcome.toUpperCase().includes('CONVICTION') ? 'VICTORY' : 'DEFEATED'}
                   </span>
                </div>
             </div>

             <button 
                onClick={() => {
                  setGameState('LEVEL_SELECT');
                  setInventory([]);
                  setCurrentRoomIdx(0);
                  setVerdict(null);
                  setSelectedSuspect(null);
                  setJustUnlocked(null);
                  setPlayerState('IDLE');
                }}
                className="px-20 py-5 bg-white text-black font-black uppercase text-sm tracking-[0.5em] hover:bg-orange-600 hover:text-white transition-all shadow-2xl active:scale-95"
             >
               BACK TO LOBBY
             </button>
          </div>
        )}
      </main>

      <style>{`
        @keyframes walking-rhythm {
          0%, 100% { transform: translateY(0) rotate(0); }
          25% { transform: translateY(-15px) rotate(5deg); }
          50% { transform: translateY(0) rotate(0); }
          75% { transform: translateY(-15px) rotate(-5deg); }
        }
        @keyframes celebration {
          0% { transform: scale(1); }
          50% { transform: scale(1.4) rotate(15deg); filter: brightness(1.5); }
          100% { transform: scale(1); }
        }
        @keyframes head-scan {
          0%, 100% { transform: rotate(0); }
          25% { transform: rotate(-20deg); }
          75% { transform: rotate(20deg); }
        }
        @keyframes torch-flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
          70% { opacity: 0.9; }
        }
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @keyframes reverse-spin {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes slow-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes slow-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes bounce-heavy {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        .animate-walking-rhythm {
          animation: walking-rhythm 0.4s linear infinite;
        }
        .animate-celebration {
          animation: celebration 0.5s ease-out 3;
        }
        .animate-head-scan {
          animation: head-scan 1s ease-in-out infinite;
        }
        .animate-torch-flicker {
          animation: torch-flicker 0.1s infinite;
        }
        .animate-reverse-spin {
          animation: reverse-spin 3s linear infinite;
        }
        .animate-slow-pulse {
          animation: slow-pulse 10s ease-in-out infinite;
        }
        .animate-slow-bob {
          animation: slow-bob 2s ease-in-out infinite;
        }
        .animate-bounce-heavy {
          animation: bounce-heavy 1s infinite;
        }
        @font-face {
          font-family: 'Crimson Text';
          src: url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        }
        .font-serif {
          font-family: 'Crimson Text', serif;
        }
      `}</style>
    </div>
  );
};

export default App;
