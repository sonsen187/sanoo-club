// Procedural Web Audio DJ Sound Effects & Synthesizer
class DJSoundEffects {
  constructor(audioCtx) {
    this.ctx = audioCtx;
    this.enabled = true;
    this.masterGain = null;
  }

  init(audioCtx) {
    if (audioCtx) this.ctx = audioCtx;
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (!this.masterGain && this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // DJ Airhorn (Reggae / Dancehall classic horn)
  playAirhorn() {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;
    const baseFreqs = [466.16, 587.33, 698.46]; // Bb4, D5, F5 chord
    const hornBeeps = [0, 0.12, 0.24, 0.42, 0.65];
    const durations = [0.09, 0.09, 0.14, 0.18, 0.45];

    hornBeeps.forEach((startOffset, i) => {
      const startTime = now + startOffset;
      const dur = durations[i];

      baseFreqs.forEach(freq => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        // Slight pitch scoop at beginning
        osc.frequency.setValueAtTime(freq * 0.94, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq, startTime + 0.03);

        filter.type = 'bandpass';
        filter.frequency.value = freq * 1.5;
        filter.Q.value = 3;

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + dur + 0.05);
      });
    });
  }

  // Vinyl Record Scratch
  playScratch() {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;
    
    // Scratch 1 (Forward)
    this._makeScratch(now, 180, 720, 0.12);
    // Scratch 2 (Back)
    this._makeScratch(now + 0.13, 650, 220, 0.1);
    // Scratch 3 (Quick double)
    this._makeScratch(now + 0.25, 200, 850, 0.08);
    this._makeScratch(now + 0.34, 800, 150, 0.15);
  }

  _makeScratch(startTime, startFreq, endFreq, dur) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + dur);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(startFreq * 2, startTime);
    filter.frequency.exponentialRampToValueAtTime(endFreq * 2, startTime + dur);
    filter.Q.value = 5;

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(0.35, startTime + dur * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
  }

  // Police / Club Siren
  playSiren() {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;
    const dur = 2.0;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    // Frequency modulation for siren wail
    for (let i = 0; i < 4; i++) {
      const cycle = now + i * 0.5;
      osc.frequency.setValueAtTime(600, cycle);
      osc.frequency.linearRampToValueAtTime(1200, cycle + 0.25);
      osc.frequency.linearRampToValueAtTime(600, cycle + 0.5);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.1);
    gain.gain.setValueAtTime(0.25, now + dur - 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  // Deep Sub Bass Drop
  playBassDrop() {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;
    const dur = 1.8;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + dur);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.7, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  // Fireworks Explosion sound
  playFireworks() {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;

    // White noise explosion
    const bufferSize = this.ctx.sampleRate * 1.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 0.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 1.2);
  }

  // Coin / Gift Chime
  playGiftChime() {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio

    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.07;

      osc.type = 'sine';
      osc.frequency.value = f;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  // Crowd Cheering
  playCheer() {
    if (!this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;
    const dur = 2.5;

    // Filtered noise for crowd cheer
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.frequency.linearRampToValueAtTime(950, now + 0.8);
    filter.frequency.linearRampToValueAtTime(500, now + dur);
    filter.Q.value = 1.8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + dur + 0.1);
  }
}

if (typeof window !== 'undefined') {
  window.DJSoundEffects = DJSoundEffects;
}
