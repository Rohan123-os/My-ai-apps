import React from 'react';

interface PianoKeyProps {
  note: string;
  isBlack: boolean;
  isActive: boolean;
  isInScale: boolean;
  onPress: () => void;
}

const PianoKey: React.FC<PianoKeyProps> = React.memo(({ note, isBlack, isActive, isInScale, onPress }) => {
  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    onPress();
  };

  const notePart = note.slice(0, -1);
  const octavePart = note.slice(-1);
  
  // Mapping notes to their keyboard shortcuts for the labels
  const shortcutMap: Record<string, string> = {
    'C3': 'A', 'C#3': 'W', 'D3': 'S', 'D#3': 'E', 'E3': 'D', 'F3': 'F', 'F#3': 'T', 'G3': 'G', 'G#3': 'Y', 'A3': 'H', 'A#3': 'U', 'B3': 'J',
    'C4': 'K', 'C#4': 'O', 'D4': 'L', 'D#4': 'P', 'E4': ';', 'F4': "'"
  };
  const shortcut = shortcutMap[note] || '';

  return (
    <div 
      className={`
        relative flex flex-col items-center justify-end select-none h-full transition-transform duration-75
        ${isBlack ? 'w-0 z-30' : 'flex-1 z-10'}
        ${isActive ? 'scale-y-[0.98] translate-y-1' : ''}
      `}
    >
      <button
        onMouseDown={handleInteraction}
        onTouchStart={handleInteraction}
        className={`
          relative flex flex-col items-center justify-end transition-all duration-75 select-none outline-none w-full h-full group
          ${isBlack 
            ? `absolute top-0 -left-[1.3vw] w-[2.6vw] h-[62%] 
               bg-gradient-to-b from-[#333] via-[#111] to-[#000] 
               border-x border-b border-black rounded-b-md
               shadow-[0_8px_15px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)]` 
            : `bg-gradient-to-b from-[#fdfdfd] via-[#fff] to-[#e5e5e5] 
               border-r border-zinc-300 rounded-b-lg
               shadow-[0_4px_6px_rgba(0,0,0,0.1),inset_0_-4px_8px_rgba(0,0,0,0.05)]`}
          ${isActive ? (isBlack ? 'brightness-150' : 'bg-zinc-200 shadow-inner') : ''}
          ${!isInScale && !isBlack ? 'opacity-90' : ''}
        `}
      >
        {/* Physical Key Top Highlight */}
        {!isBlack && (
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-white opacity-40" />
        )}

        {/* Note Labels */}
        <div className={`
          flex flex-col items-center pointer-events-none select-none font-mono pb-6
          ${isBlack ? 'text-zinc-300 mb-2' : 'text-zinc-700'}
          ${isActive ? (isBlack ? 'text-amber-300' : 'text-cyan-800') : ''}
        `}>
          <span className="text-[11px] font-black opacity-60 mb-1">{shortcut}</span>
          <div className="flex items-baseline">
            <span className="text-[clamp(12px,1.4vw,18px)] font-black tracking-tight">
              {notePart.replace('#', '')}
              {notePart.includes('#') && <span className="text-[0.7em] relative -top-0.5 ml-0.5">#</span>}
            </span>
            <span className="text-[10px] font-bold opacity-50 ml-0.5">{octavePart}</span>
          </div>
        </div>
        
        {/* Glow indicator */}
        {isActive && (
          <div className={`
            absolute bottom-0 left-0 right-0 h-1 blur-sm
            ${isBlack ? 'bg-amber-400/80' : 'bg-cyan-500/80'}
          `} />
        )}
      </button>
      
      {/* Visual Cue for scale */}
      {isInScale && !isActive && (
        <div className={`
          absolute top-8 w-1.5 h-1.5 rounded-full pointer-events-none
          ${isBlack ? 'bg-amber-500/50' : 'bg-cyan-500/40'}
        `} />
      )}
    </div>
  );
});

export default PianoKey;