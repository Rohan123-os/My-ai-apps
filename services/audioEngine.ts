class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private recorderDestination: MediaStreamAudioDestinationNode | null = null;
  private transpose: number = 0;
  private finePitch: number = 0;

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-24, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);

      this.recorderDestination = this.ctx.createMediaStreamDestination();

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.connect(this.recorderDestination);
    } catch (e) {
      console.error("AudioEngine initialization failed:", e);
    }
  }

  setTranspose(semitones: number) {
    this.transpose = semitones;
  }

  setFinePitch(cents: number) {
    this.finePitch = cents;
  }

  getAudioStream(): MediaStream | null {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.recorderDestination ? this.recorderDestination.stream : null;
  }

  getCurrentTime(): number {
    this.init();
    return this.ctx?.currentTime || 0;
  }

  scheduleNote(frequency: number, time: number) {
    this.init();
    if (!this.ctx || !this.compressor) return;

    const ctx = this.ctx;
    // Calculate final frequency based on global pitch controls
    const totalPitchShift = this.transpose + (this.finePitch / 100);
    const baseFreq = frequency * Math.pow(2, totalPitchShift / 12);

    // Natural Piano Decay: Higher notes have much shorter sustain than lower notes
    const referenceFreq = 261.63; // C4
    const decayFactor = Math.pow(referenceFreq / baseFreq, 0.5);
    const sustainDuration = Math.min(6.0, Math.max(0.4, 2.5 * decayFactor));

    // String Inharmonicity (simulating string stiffness)
    const B = 0.0001; 
    const getHarmonic = (n: number) => baseFreq * n * Math.sqrt(1 + B * n * n);

    const nodes: AudioNode[] = [];

    // Filter that closes over time to simulate natural string damping
    const damperFilter = ctx.createBiquadFilter();
    damperFilter.type = 'lowpass';
    const initialCutoff = Math.min(18000, baseFreq * 14);
    damperFilter.frequency.setValueAtTime(initialCutoff, time);
    damperFilter.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, time + sustainDuration);
    damperFilter.Q.setValueAtTime(1.0, time);

    // Unison detuning and partials
    const partials = [
      { n: 1, gain: 0.8, detune: 0.9, type: 'triangle' as OscillatorType },
      { n: 1, gain: 0.7, detune: -1.4, type: 'triangle' as OscillatorType },
      { n: 2, gain: 0.45, detune: 2.1, type: 'sine' as OscillatorType },
      { n: 3, gain: 0.25, detune: 3.5, type: 'sine' as OscillatorType },
      { n: 4, gain: 0.15, detune: 0.8, type: 'sine' as OscillatorType },
      { n: 5, gain: 0.08, detune: 4.2, type: 'sine' as OscillatorType },
      { n: 6, gain: 0.03, detune: -0.8, type: 'sine' as OscillatorType }
    ];

    partials.forEach(p => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = p.type;
      osc.frequency.setValueAtTime(getHarmonic(p.n), time);
      osc.detune.setValueAtTime(p.detune, time);

      // Amplitude Envelope
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(p.gain, time + 0.004);
      const sustainLevel = p.gain * 0.35;
      gain.gain.exponentialRampToValueAtTime(sustainLevel, time + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + sustainDuration / Math.sqrt(p.n));

      osc.connect(gain);
      gain.connect(damperFilter);
      
      osc.start(time);
      osc.stop(time + sustainDuration + 0.5);
      nodes.push(osc, gain);
    });

    damperFilter.connect(this.compressor!);
    nodes.push(damperFilter);

    // Hammer components
    // 1. Felt click
    const clackBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const clackData = clackBuffer.getChannelData(0);
    for (let i = 0; i < clackData.length; i++) {
        clackData[i] = (Math.random() * 2 - 1) * Math.exp(-i / 180);
    }
    const clackSource = ctx.createBufferSource();
    clackSource.buffer = clackBuffer;
    const clackFilter = ctx.createBiquadFilter();
    clackFilter.type = 'highpass';
    clackFilter.frequency.setValueAtTime(1200, time);
    const clackGain = ctx.createGain();
    clackGain.gain.setValueAtTime(0.1, time);
    clackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    
    clackSource.connect(clackFilter);
    clackFilter.connect(clackGain);
    clackGain.connect(this.compressor!);
    clackSource.start(time);
    nodes.push(clackSource, clackFilter, clackGain);

    // 2. Soundboard thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(baseFreq * 0.5, time);
    thumpGain.gain.setValueAtTime(0.12, time);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    thump.connect(thumpGain);
    thumpGain.connect(this.compressor!);
    thump.start(time);
    thump.stop(time + 0.2);
    nodes.push(thump, thumpGain);

    setTimeout(() => {
      nodes.forEach(n => {
        try { n.disconnect(); } catch (e) {}
      });
    }, (sustainDuration + 1) * 1000);
  }

  async playNote(frequency: number) {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.warn("AudioContext resume failed", e);
      }
    }
    this.scheduleNote(frequency, this.ctx.currentTime);
  }

  getFrequency(note: string): number {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const name = note.slice(0, -1);
    const octave = parseInt(note.slice(-1));
    const index = notes.indexOf(name);
    return 440 * Math.pow(2, (octave - 4) + (index - 9) / 12);
  }
}

export const audioEngine = new AudioEngine();
