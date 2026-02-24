import React, { useState, useEffect, useCallback, useRef } from 'react';
import PianoKey from './components/PianoKey';
import { audioEngine } from './services/audioEngine';
import { KEYBOARD_MAP, NOTE_NAMES, MUSICAL_SHEETS, SCALES } from './constants';
import { MusicalSheet, RecordedNote, ComposerResponse, Scale, NoteName, VisualNote, Recording } from './types';
import { generateMelodyContinuation } from './services/geminiService';
import { 
  Circle, Square, X, Sparkles, 
  Loader2, Plus, Minus, 
  Trash2, Play, Download, 
  Sliders, Globe
} from 'lucide-react';

const VISUAL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const STORAGE_KEY = 'virtuoso_studio_v27';

const App: React.FC = () => {
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const activeNotesRef = useRef<Map<string, number>>(new Map()); 
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<MusicalSheet | null>(null);
  const [selectedScale, setSelectedScale] = useState<Scale>(SCALES[0]); 
  const [selectedRoot, setSelectedRoot] = useState<NoteName>('C');
  const [transpose, setTranspose] = useState<number>(0);
  const [finePitch, setFinePitch] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResponse, setAiResponse] = useState<ComposerResponse | null>(null);
  const [noteHistory, setNoteHistory] = useState<string[]>([]);
  const [currentRecordingNotes, setCurrentRecordingNotes] = useState<RecordedNote[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [exportFormat, setExportFormat] = useState<'wav' | 'mp4'>('mp4');
  const [isExporting, setIsExporting] = useState(false);
  const [savedRecordings, setSavedRecordings] = useState<Recording[]>([]);
  const [activeFooterTab, setActiveFooterTab] = useState<'sheets' | 'recordings'>('sheets');

  const visualNotesRef = useRef<VisualNote[]>([]);
  const exportVisualNotesRef = useRef<VisualNote[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const playbackRef = useRef<{
    active: boolean;
    notes: RecordedNote[];
    startTime: number;
    audioIdx: number;
    visualIdx: number;
    audioOffset: number;
  }>({
    active: false,
    notes: [],
    startTime: 0,
    audioIdx: 0,
    visualIdx: 0,
    audioOffset: 0
  });

  const isExportingRef = useRef(false);

  // High-performance visual note generator
  const createVisualNote = (note: string, width: number, height: number, velocity: number = 10): VisualNote | null => {
    const allKeys: string[] = [];
    [3, 4].forEach(oct => NOTE_NAMES.forEach(name => allKeys.push(`${name}${oct}`)));
    const whiteKeys = allKeys.filter(k => !k.includes('#'));
    const octave = parseInt(note.slice(-1));
    const name = note.slice(0, -1);
    const baseNote = name[0];
    const whiteIdx = whiteKeys.indexOf(`${baseNote}${octave}`);
    if (whiteIdx === -1) return null;

    const keyWidth = width / whiteKeys.length;
    let x = whiteIdx * keyWidth + keyWidth / 2;
    if (name.includes('#')) x += keyWidth * 0.5;

    return {
      id: Math.random(),
      note,
      symbol: '', baseX: x, x, y: height * 0.72,
      color: VISUAL_COLORS[Math.floor(Math.random() * VISUAL_COLORS.length)],
      opacity: 1.0, 
      velocity,
      size: 0, rotation: 0, rotationSpeed: 0, swayPhase: 0, swayAmplitude: 0,
      tail: [], pulse: 0, pulseSpeed: 0, width: keyWidth * 0.8, height: 160
    };
  };

  const addVisualNote = useCallback((note: string, width: number, height: number) => {
    const vn = createVisualNote(note, width, height, 12);
    if (!vn) return;
    visualNotesRef.current.push(vn);
    if (visualNotesRef.current.length > 50) visualNotesRef.current.shift();
  }, []);

  const drawFrame = (ctx: CanvasRenderingContext2D, width: number, height: number, notesList: VisualNote[], isMP4: boolean = false) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Draw falling blocks
    for (let i = 0; i < notesList.length; i++) {
      const n = notesList[i];
      n.y -= n.velocity;
      if (!isMP4) n.opacity -= 0.015;
      
      ctx.globalAlpha = isMP4 ? 0.9 : n.opacity;
      ctx.fillStyle = n.color;
      
      const rx = n.x - n.width/2;
      const ry = n.y;
      const rw = n.width;
      const rh = n.height;
      
      if (isMP4) {
        ctx.fillRect(rx, ry, rw, rh);
      } else {
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(rx, ry, rw, rh, 4);
        } else {
          ctx.rect(rx, ry, rw, rh);
        }
        ctx.fill();
      }
    }
    
    ctx.globalAlpha = 1.0;

    // simplistic Keyboard Overlay for recorded files
    if (isMP4) {
      const keyboardY = height * 0.72;
      const keyboardH = height - keyboardY;
      const allKeys: string[] = [];
      [3, 4].forEach(oct => NOTE_NAMES.forEach(name => allKeys.push(`${name}${oct}`)));
      const whiteKeys = allKeys.filter(k => !k.includes('#'));
      const keyWidth = width / whiteKeys.length;

      // Draw White Keys
      whiteKeys.forEach((note, i) => {
        const isActive = activeNotesRef.current.has(note);
        ctx.fillStyle = isActive ? '#444' : '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.fillRect(i * keyWidth, keyboardY, keyWidth, keyboardH);
        ctx.strokeRect(i * keyWidth, keyboardY, keyWidth, keyboardH);
      });

      // Draw Black Keys
      const blackKeyH = keyboardH * 0.65;
      const blackKeyW = keyWidth * 0.7;
      whiteKeys.forEach((note, i) => {
        const name = note.slice(0, -1);
        const octave = note.slice(-1);
        const sharpNotes = ['C', 'D', 'F', 'G', 'A'];
        if (sharpNotes.includes(name)) {
          const sharpNoteName = `${name}#${octave}`;
          const isActive = activeNotesRef.current.has(sharpNoteName);
          ctx.fillStyle = isActive ? '#ffcc00' : '#000';
          ctx.fillRect((i * keyWidth) + (keyWidth - blackKeyW / 2), keyboardY, blackKeyW, blackKeyH);
        }
      });
    } else {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, height * 0.72, width, 1);
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      const now = Date.now();
      let changed = false;

      // Clean up key highlights automatically
      for (const [note, expiry] of activeNotesRef.current.entries()) {
        if (now >= expiry) {
          activeNotesRef.current.delete(note);
          changed = true;
        }
      }

      // Main playback engine logic
      if (playbackRef.current.active) {
        const p = playbackRef.current;
        const elapsed = now - p.startTime;

        while (p.audioIdx < p.notes.length && p.notes[p.audioIdx].timestamp <= elapsed + 150) {
          audioEngine.scheduleNote(audioEngine.getFrequency(p.notes[p.audioIdx].note), p.audioOffset + (p.notes[p.audioIdx].timestamp / 1000));
          p.audioIdx++;
        }

        while (p.visualIdx < p.notes.length && p.notes[p.visualIdx].timestamp <= elapsed) {
          const n = p.notes[p.visualIdx].note;
          activeNotesRef.current.set(n, now + 180);
          addVisualNote(n, 1280, 720);
          changed = true;
          p.visualIdx++;
        }

        if (p.visualIdx >= p.notes.length && activeNotesRef.current.size === 0) {
          p.active = false;
          setIsPlayingBack(false);
          changed = true;
        }
      }

      if (changed) setActiveNotes(new Set(activeNotesRef.current.keys()));

      // Canvas Rendering
      if (canvasRef.current && !isExportingRef.current) {
        const ctx = canvasRef.current.getContext('2d', { alpha: false });
        if (ctx) {
          visualNotesRef.current = visualNotesRef.current.filter(n => n.opacity > 0.05 && n.y + n.height > -100);
          drawFrame(ctx, 1280, 720, visualNotesRef.current, false);
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [addVisualNote]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSavedRecordings(JSON.parse(saved));
  }, []);

  useEffect(() => { 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRecordings)); 
  }, [savedRecordings]);

  useEffect(() => {
    audioEngine.setTranspose(transpose);
    audioEngine.setFinePitch(finePitch);
  }, [transpose, finePitch]);

  const playNote = useCallback((note: string, skipHistory = false) => {
    audioEngine.playNote(audioEngine.getFrequency(note));
    const now = Date.now();
    activeNotesRef.current.set(note, now + 200);
    setActiveNotes(new Set(activeNotesRef.current.keys()));
    addVisualNote(note, 1280, 720);
    if (!skipHistory) setNoteHistory(prev => [...prev.slice(-12), note]);
    if (isRecording && recordingStartTime && !skipHistory) {
      setCurrentRecordingNotes(prev => [...prev, { note, timestamp: now - recordingStartTime }]);
    }
  }, [isRecording, recordingStartTime, addVisualNote]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const note = KEYBOARD_MAP[e.key.toLowerCase()];
    if (note && !e.repeat) playNote(note);
  }, [playNote]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const stopAll = useCallback(() => {
    playbackRef.current.active = false;
    setIsPlayingBack(false);
    setIsExporting(false);
    isExportingRef.current = false;
    activeNotesRef.current.clear();
    setActiveNotes(new Set());
    visualNotesRef.current = [];
    exportVisualNotesRef.current = [];
  }, []);

  const previewPerformance = (notes: RecordedNote[]) => {
    if (notes.length === 0 || isExporting) return;
    stopAll();
    audioEngine.init();
    playbackRef.current = {
      active: true,
      notes,
      startTime: Date.now(),
      audioIdx: 0,
      visualIdx: 0,
      audioOffset: audioEngine.getCurrentTime() + 0.1
    };
    setIsPlayingBack(true);
  };

  const exportRecording = async (rec: Recording) => {
    if (rec.notes.length === 0 || isExporting || isPlayingBack) return;
    try {
      stopAll();
      setIsExporting(true);
      isExportingRef.current = true;
      const audioStream = audioEngine.getAudioStream();
      if (!audioStream) throw new Error("Audio setup failed");

      let mediaRecorder: MediaRecorder;
      const chunks: Blob[] = [];
      let mimeType = '';

      if (exportFormat === 'mp4') {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 1280; offCanvas.height = 720;
        const offCtx = offCanvas.getContext('2d', { alpha: false });
        const renderLoop = () => {
          if (!isExportingRef.current || !offCtx) return;
          exportVisualNotesRef.current = exportVisualNotesRef.current.filter(n => n.y + n.height > -100);
          drawFrame(offCtx, 1280, 720, exportVisualNotesRef.current, true);
          requestAnimationFrame(renderLoop);
        };
        renderLoop();
        const videoStream = offCanvas.captureStream(30);
        const combined = new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
        
        const videoTypes = ['video/mp4;codecs=h264', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
        mimeType = videoTypes.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
        mediaRecorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 6000000 });
      } else {
        const audioTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
        mimeType = audioTypes.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
        mediaRecorder = new MediaRecorder(audioStream, { mimeType });
      }

      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        isExportingRef.current = false;
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = exportFormat === 'wav' ? 'webm' : (mimeType.includes('mp4') ? 'mp4' : 'webm');
        a.download = `piano_performance_${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setIsExporting(false);
        stopAll();
      };

      mediaRecorder.start();
      const wallStart = Date.now();
      const audioOffset = audioEngine.getCurrentTime() + 0.2;
      let audioIdx = 0;
      let visualIdx = 0;

      const syncLoop = () => {
        if (!isExportingRef.current) return;
        const elapsed = Date.now() - wallStart;
        
        while (audioIdx < rec.notes.length && rec.notes[audioIdx].timestamp <= elapsed + 250) {
          audioEngine.scheduleNote(audioEngine.getFrequency(rec.notes[audioIdx].note), audioOffset + (rec.notes[audioIdx].timestamp / 1000));
          audioIdx++;
        }
        
        while (visualIdx < rec.notes.length && rec.notes[visualIdx].timestamp <= elapsed) {
          const n = rec.notes[visualIdx].note;
          activeNotesRef.current.set(n, Date.now() + 180);
          const vn = createVisualNote(n, 1280, 720, 10);
          if (vn) exportVisualNotesRef.current.push(vn);
          visualIdx++;
        }

        const lastNoteEnd = (rec.notes[rec.notes.length - 1]?.timestamp || 0) + 2000;
        if (visualIdx < rec.notes.length || elapsed < lastNoteEnd) {
          requestAnimationFrame(syncLoop);
        } else {
          if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        }
      };
      requestAnimationFrame(syncLoop);
    } catch (err) {
      console.error("Export failed:", err);
      setIsExporting(false);
      isExportingRef.current = false;
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setRecordingStartTime(null);
      if (currentRecordingNotes.length > 0) {
        const entry: Recording = { id: `r-${Date.now()}`, name: `Performance ${new Date().toLocaleTimeString()}`, date: Date.now(), notes: currentRecordingNotes };
        setSavedRecordings(prev => [entry, ...prev]);
      }
    } else {
      stopAll();
      audioEngine.init();
      setIsRecording(true);
      setCurrentRecordingNotes([]);
      setRecordingStartTime(Date.now());
    }
  };

  const isInSelectedScale = useCallback((noteName: string) => {
    const noteIdx = NOTE_NAMES.indexOf(noteName as NoteName);
    const rootIdx = NOTE_NAMES.indexOf(selectedRoot);
    const interval = (noteIdx - rootIdx + 12) % 12;
    return selectedScale.intervals.includes(interval);
  }, [selectedScale, selectedRoot]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#000000] text-zinc-100 overflow-hidden font-sans select-none">
      <div className={`transition-all duration-300 ease-in-out bg-zinc-900 border-b border-white/5 overflow-hidden ${isExporting || isGenerating || selectedSheet || aiResponse ? 'h-16' : 'h-0'}`}>
        <div className="h-full w-full flex items-center px-10 gap-8">
          {isExporting ? (
            <div className="flex items-center gap-3 text-cyan-400 font-bold uppercase tracking-widest text-[9px]">
              <Loader2 className="animate-spin w-5 h-5" /> Encoding Final Render...
            </div>
          ) : (
            <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {(aiResponse?.melody || selectedSheet?.notes || []).map((n, i) => (
                <div key={i} className={`flex-shrink-0 px-4 py-1.5 rounded border text-[9px] font-bold transition-all ${activeNotes.has(n) ? 'bg-white text-black border-white shadow-md' : 'border-white/5 text-zinc-600'}`}>{n}</div>
              ))}
            </div>
          )}
          {(selectedSheet || aiResponse) && !isExporting && (
            <button onClick={() => { setSelectedSheet(null); setAiResponse(null); }} className="p-1.5 bg-zinc-800 rounded hover:bg-zinc-700 text-zinc-400"><X size={16} /></button>
          )}
        </div>
      </div>

      <main className="flex-1 relative flex flex-col justify-end items-stretch overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-75 pointer-events-none" width={1280} height={720} />

        {/* Matrix Controls for Pitch and Scale */}
        <div className="absolute top-8 left-8 z-50 flex gap-4">
          <div className="bg-zinc-900/80 backdrop-blur-3xl p-4 rounded-xl border border-white/5 shadow-2xl w-44 flex flex-col gap-3">
            <span className="text-[7px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5"><Sliders size={10} /> Pitch Transpose</span>
            <div className="flex items-center justify-between">
              <button onClick={() => setTranspose(t => Math.max(-12, t-1))} className="p-1.5 bg-zinc-800 rounded hover:bg-zinc-700 active:scale-95 transition-transform"><Minus size={12} /></button>
              <div className="font-mono text-amber-500 text-[10px] font-bold">{transpose > 0 ? `+${transpose}` : transpose}</div>
              <button onClick={() => setTranspose(t => Math.min(12, t+1))} className="p-1.5 bg-zinc-800 rounded hover:bg-zinc-700 active:scale-95 transition-transform"><Plus size={12} /></button>
            </div>
          </div>
          
          <div className="bg-zinc-900/80 backdrop-blur-3xl p-4 rounded-xl border border-white/5 shadow-2xl w-64 flex flex-col gap-3">
            <span className="text-[7px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5"><Globe size={10} /> Scale Matrix</span>
            <div className="flex gap-2">
              <select value={selectedRoot} onChange={e => setSelectedRoot(e.target.value as NoteName)} className="bg-zinc-800 text-[8px] font-bold p-1.5 rounded border border-white/5 outline-none flex-1 hover:border-zinc-600 transition-colors">
                {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={selectedScale.name} onChange={e => setSelectedScale(SCALES.find(s => s.name === e.target.value) || SCALES[0])} className="bg-zinc-800 text-[8px] font-bold p-1.5 rounded border border-white/5 outline-none flex-[2] hover:border-zinc-600 transition-colors">
                {SCALES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex w-full h-[58%] px-[2vw] pb-[2vh] relative z-20 overflow-hidden perspective-500">
          <div className="flex w-full h-full transform-gpu origin-bottom">
            {[3, 4].map(octave => NOTE_NAMES.map(name => {
              const note = `${name}${octave}`;
              return <PianoKey 
                key={note} 
                note={note} 
                isBlack={name.includes('#')} 
                isActive={activeNotes.has(note)} 
                isInScale={isInSelectedScale(name)} 
                onPress={() => playNote(note)} 
              />;
            }))}
          </div>
        </div>
      </main>

      <footer className="h-[32%] bg-[#080808] border-t border-white/5 px-10 py-5 flex gap-8 z-40">
        <div className="flex flex-col gap-2 pr-8 border-r border-white/5 shrink-0 justify-center items-center">
          <button onClick={toggleRecording} className={`w-16 h-16 rounded-full flex items-center justify-center border-[3px] transition-all duration-200 ${isRecording ? 'bg-red-600 border-red-400 scale-105 shadow-[0_0_20px_rgba(220,38,38,0.5)]' : 'bg-zinc-900 border-zinc-800 text-zinc-700'}`}>
            {isRecording ? <Square fill="white" size={20} /> : <Circle fill="currentColor" size={28} />}
          </button>
          <div className="flex gap-1.5 w-full">
            <select value={exportFormat} onChange={e => setExportFormat(e.target.value as any)} className="flex-1 bg-zinc-900 text-[8px] font-bold uppercase tracking-widest px-2 py-1.5 rounded border border-white/5 outline-none">
              <option value="wav">WAV</option>
              <option value="mp4">MP4</option>
            </select>
            <button onClick={() => exportRecording({ id: 't', name: 'P', date: 0, notes: currentRecordingNotes })} disabled={currentRecordingNotes.length === 0 || isRecording} className="p-1.5 bg-zinc-800 text-amber-500 rounded border border-amber-500/5 active:scale-90 shadow-sm"><Download size={14} /></button>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex gap-6 border-b border-white/5 pb-2">
            {['composer sheets', 'my vault'].map(tab => (
              <button key={tab} onClick={() => setActiveFooterTab(tab === 'my vault' ? 'recordings' : 'sheets' as any)} className={`text-[9px] font-bold uppercase tracking-widest pb-1 relative transition-colors ${activeFooterTab === (tab === 'my vault' ? 'recordings' : 'sheets') ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>
                {tab}
                {activeFooterTab === (tab === 'my vault' ? 'recordings' : 'sheets') && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-x-auto no-scrollbar flex gap-4 items-start py-2">
            {activeFooterTab === 'sheets' && MUSICAL_SHEETS.map((s, i) => (
              <button key={i} onClick={() => setSelectedSheet(s)} className={`px-6 py-3 rounded-lg border whitespace-nowrap text-[8px] font-bold tracking-widest transition-all ${selectedSheet?.title === s.title ? 'bg-white text-black border-white shadow-lg scale-95' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:bg-zinc-800'}`}>{s.title}</button>
            ))}
            {activeFooterTab === 'recordings' && savedRecordings.map(r => (
              <div key={r.id} className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl min-w-[200px] flex flex-col justify-between shadow-sm">
                <span className="text-[8px] font-bold truncate text-zinc-500 mb-2 uppercase tracking-tighter">{r.name}</span>
                <div className="flex gap-1.5">
                  <button onClick={() => previewPerformance(r.notes)} className="flex-1 py-1.5 bg-zinc-800 rounded text-[7px] font-black hover:text-cyan-400 transition-colors flex items-center justify-center gap-1 uppercase tracking-widest"><Play size={10} fill="currentColor" /> PLAY</button>
                  <button onClick={() => setSavedRecordings(p => p.filter(x => x.id !== r.id))} className="p-1.5 bg-zinc-800 rounded hover:text-red-500"><Trash2 size={10} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-l border-white/5 pl-8 justify-center shrink-0">
          <button onClick={async () => { if (noteHistory.length < 3) return; setIsGenerating(true); const res = await generateMelodyContinuation(noteHistory); if (res) setAiResponse(res); setIsGenerating(false); }} className="bg-amber-500 text-black px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[8px] hover:bg-amber-400 flex items-center gap-2 transition-all disabled:opacity-20 active:scale-95 shadow-xl" disabled={isGenerating}>
            {isGenerating ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Sparkles size={14} />} 
            SYNTH COMPOSE
          </button>
        </div>
      </footer>
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
};

export default App;
