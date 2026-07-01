const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface NoteResult {
  name: string;
  octave: number;
  frequency: number;
  cents: number;
}

export function frequencyToNote(freq: number): NoteResult {
  if (freq <= 0) return { name: '--', octave: 0, frequency: 0, cents: 0 };

  const midi = 12 * Math.log2(freq / 440) + 69;
  const midiRounded = Math.round(midi);
  const clamped = Math.max(0, Math.min(127, midiRounded));

  const name = NOTE_NAMES[clamped % 12];
  const octave = Math.floor(clamped / 12) - 1;
  const exactFreq = 440 * Math.pow(2, (clamped - 69) / 12);
  const cents = Math.round(1200 * Math.log2(freq / exactFreq));

  return { name, octave, frequency: exactFreq, cents };
}

export function noteFrequency(noteIndex: number, octave: number): number {
  const midi = (octave + 1) * 12 + noteIndex;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function halfStepUp(freq: number): number {
  const midi = 12 * Math.log2(freq / 440) + 69;
  const nextMidi = Math.round(midi) + 1;
  return 440 * Math.pow(2, (nextMidi - 69) / 12);
}

export function halfStepDown(freq: number): number {
  const midi = 12 * Math.log2(freq / 440) + 69;
  const prevMidi = Math.round(midi) - 1;
  return 440 * Math.pow(2, (prevMidi - 69) / 12);
}
