import { NoteName, MusicalSheet, Scale } from './types';

export const SCALES: Scale[] = [
  { name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  { name: 'Harmonic Major', intervals: [0, 2, 4, 5, 7, 8, 11] },
  { name: 'Pentatonic Major', intervals: [0, 2, 4, 7, 9] },
  { name: 'Pentatonic Minor', intervals: [0, 3, 5, 7, 10] },
  { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
  { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
];

export const MUSICAL_SHEETS: MusicalSheet[] = [
  {
    title: 'Minuet in G',
    notes: ['D4', 'G3', 'A3', 'B3', 'C4', 'D4', 'G3', 'G3']
  },
  {
    title: 'Sonata Facile',
    notes: ['C4', 'E4', 'G4', 'B3', 'C4', 'D4', 'C4']
  },
  {
    title: 'Ode to Joy',
    notes: ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4', 'C4', 'C4', 'D4', 'E4']
  },
  {
    title: 'Nocturne Op.9',
    notes: ['Bb3', 'G4', 'F4', 'Eb4', 'D4', 'C4']
  },
  {
    title: 'Clair de Lune',
    notes: ['F4', 'Eb4', 'Db4', 'C4', 'Bb3', 'Ab3']
  }
];

export const NOTE_NAMES: NoteName[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const KEYBOARD_MAP: Record<string, string> = {
  'a': 'C3', 'w': 'C#3', 's': 'D3', 'e': 'D#3', 'd': 'E3', 'f': 'F3', 't': 'F#3', 'g': 'G3', 'y': 'G#3', 'h': 'A3', 'u': 'A#3', 'j': 'B3',
  'k': 'C4', 'o': 'C#4', 'l': 'D4', 'p': 'D#4', ';': 'E4', "'": 'F4'
};