export type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export interface Note {
  name: NoteName;
  octave: number;
  frequency: number;
}

export interface Scale {
  name: string;
  intervals: number[]; // semitones from root
}

export interface MusicalSheet {
  title: string;
  notes: string[]; // e.g. ["C4", "E4", "G4"]
}

export interface ComposerResponse {
  melody: string[];
  explanation: string;
  musicalElements: string[];
}

export interface Composer {
  name: string;
  color: string;
  period: string;
  description: string;
  style: string;
}

export interface RecordedNote {
  note: string;
  timestamp: number;
}

export interface Recording {
  id: string;
  name: string;
  date: number;
  notes: RecordedNote[];
}

export interface VisualNote {
  id: number;
  note: string;
  symbol: string;
  baseX: number;
  x: number;
  y: number;
  color: string;
  opacity: number;
  velocity: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  swayPhase: number;
  swayAmplitude: number;
  tail: { x: number, y: number }[];
  pulse: number;
  pulseSpeed: number;
  width: number;
  height: number;
}