/**
 * Procedural WebAudio Kitchen SFX & Upbeat Bistro Synth Loop for Cooking Chaos.
 * Zero external audio files, zero speech synthesis, safe iPadOS unlock.
 */

const STEP_DUR = 0.24; // upbeat ~125 BPM eighth notes

// Cheerful jazzy bistro 4-bar progression: Cmaj7 -> Am7 -> Dm7 -> G7
const CHORDS = [
  [261.63, 329.63, 392.0, 493.88],
  [220.0, 261.63, 329.63, 392.0],
  [293.66, 349.23, 440.0, 523.25],
  [246.94, 293.66, 392.0, 493.88],
];

const BASS = [
  130.81, 0, 164.81, 0, 196.0, 0, 164.81, 0,
  110.0, 0, 130.81, 0, 164.81, 0, 130.81, 0,
  146.83, 0, 174.61, 0, 220.0, 0, 174.61, 0,
  196.0, 0, 146.83, 0, 196.0, 0, 164.81, 146.83,
];

const MELODY = [
  523.25, 0, 659.25, 0, 783.99, 659.25, 587.33, 0,
  523.25, 0, 440.0, 0, 523.25, 0, 0, 0,
  587.33, 0, 659.25, 0, 698.46, 659.25, 587.33, 0,
  783.99, 0, 659.25, 587.33, 523.25, 0, 0, 0,
];

export class KitchenAudio {
  constructor() {
    this.musicOn = true;
    this.sfxOn = true;
    this._ctx = null;
    this._master = null;
    this._sfxGain = null;
    this._musicGain = null;
    this._noiseBuf = null;
    this._unlocked = false;
    this._musicAcc = 0;
    this._musicStep = 0;
  }

  _ensureCtx() {
    if (this._ctx) return this._ctx;
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);

      const sfx = ctx.createGain();
      sfx.gain.value = this.sfxOn ? 0.78 : 0.0;
      sfx.connect(master);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1900;

      const music = ctx.createGain();
      music.gain.value = this.musicOn ? 0.11 : 0.0;
      music.connect(filter);
      filter.connect(master);

      this._ctx = ctx;
      this._master = master;
      this._sfxGain = sfx;
      this._musicGain = music;
      return ctx;
    } catch {
      return null;
    }
  }

  _getNoise() {
    if (!this._ctx) return null;
    if (this._noiseBuf) return this._noiseBuf;
    const sr = this._ctx.sampleRate || 44100;
    const len = Math.floor(sr * 0.5);
    const buf = this._ctx.createBuffer(1, len, sr);
    const ch = buf.getChannelData(0);
    let s = 0x1337c0de;
    for (let i = 0; i < len; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      ch[i] = s / 2147483648 - 1;
    }
    this._noiseBuf = buf;
    return buf;
  }

  unlock() {
    const ctx = this._ensureCtx();
    if (!ctx) return false;
    this._unlocked = true;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return true;
  }

  setMusicOn(v) {
    this.musicOn = Boolean(v);
    if (this._ctx && this._musicGain) {
      const now = this._ctx.currentTime;
      this._musicGain.gain.cancelScheduledValues(now);
      this._musicGain.gain.setTargetAtTime(this.musicOn ? 0.11 : 0.0, now, 0.03);
    }
  }

  setSfxOn(v) {
    this.sfxOn = Boolean(v);
    if (this._ctx && this._sfxGain) {
      const now = this._ctx.currentTime;
      this._sfxGain.gain.cancelScheduledValues(now);
      this._sfxGain.gain.setTargetAtTime(this.sfxOn ? 0.78 : 0.0, now, 0.02);
    }
  }

  getState() {
    return { musicOn: this.musicOn, sfxOn: this.sfxOn, unlocked: this._unlocked };
  }

  stepMusic(dt = 0.016) {
    if (!this.musicOn || !this._unlocked || !this._ctx || this._ctx.state !== 'running') return;
    this._musicAcc += Math.min(Math.max(dt || 0, 0), 0.1);
    while (this._musicAcc >= STEP_DUR) {
      this._musicAcc -= STEP_DUR;
      this._playMusicStep(this._musicStep);
      this._musicStep = (this._musicStep + 1) % 32;
    }
  }

  _tone(dest, freq, type, start, dur, vol, freqEnd = null) {
    const ctx = this._ctx;
    if (!ctx || !dest) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + dur);
    }
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  _noise(dest, start, dur, vol, filterType = 'bandpass', freq = 1200, q = 1.2) {
    const ctx = this._ctx;
    const buf = this._getNoise();
    if (!ctx || !dest || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.setValueAtTime(freq, start);
    flt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(dest);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  _playMusicStep(step) {
    const ctx = this._ctx;
    const now = ctx.currentTime + 0.01;
    const bar = Math.floor(step / 8);
    const beat = step % 8;
    if (beat === 0 || beat === 4) {
      for (const f of CHORDS[bar]) {
        this._tone(this._musicGain, f, 'triangle', now, 0.55, 0.14);
      }
    }
    if (BASS[step] > 0) {
      this._tone(this._musicGain, BASS[step], 'sine', now, 0.2, 0.28);
    }
    if (MELODY[step] > 0) {
      this._tone(this._musicGain, MELODY[step], 'sine', now, 0.24, 0.16);
    }
  }

  // Crisp wooden thwack-thwack chopping sound
  playChop() {
    if (!this.sfxOn || !this._unlocked || !this._ctx || this._ctx.state !== 'running') return;
    const now = this._ctx.currentTime;
    this._tone(this._sfxGain, 320, 'triangle', now, 0.055, 0.35, 110);
    this._noise(this._sfxGain, now, 0.045, 0.28, 'bandpass', 1800, 2.2);
  }

  // Gentle pan sizzle / bubble pop
  playSizzle() {
    if (!this.sfxOn || !this._unlocked || !this._ctx || this._ctx.state !== 'running') return;
    const now = this._ctx.currentTime;
    this._noise(this._sfxGain, now, 0.18, 0.14, 'highpass', 3200, 0.9);
  }

  // Pick up / put down tactile pop
  playPop(pitch = 1.0) {
    if (!this.sfxOn || !this._unlocked || !this._ctx || this._ctx.state !== 'running') return;
    const now = this._ctx.currentTime;
    this._tone(this._sfxGain, 420 * pitch, 'sine', now, 0.08, 0.25, 680 * pitch);
  }

  // Dish plated / cooked ding
  playDing() {
    if (!this.sfxOn || !this._unlocked || !this._ctx || this._ctx.state !== 'running') return;
    const now = this._ctx.currentTime;
    this._tone(this._sfxGain, 880, 'sine', now, 0.22, 0.25);
    this._tone(this._sfxGain, 1318.5, 'sine', now + 0.06, 0.26, 0.22);
  }

  // Cash register ka-ching on serve!
  playServe(mult = 1) {
    if (!this.sfxOn || !this._unlocked || !this._ctx || this._ctx.state !== 'running') return;
    const now = this._ctx.currentTime;
    const boost = 1 + (mult - 1) * 0.08;
    this._tone(this._sfxGain, 1046.5 * boost, 'triangle', now, 0.12, 0.32);
    this._tone(this._sfxGain, 1318.5 * boost, 'triangle', now + 0.07, 0.14, 0.32);
    this._tone(this._sfxGain, 1567.98 * boost, 'sine', now + 0.14, 0.34, 0.35);
    this._noise(this._sfxGain, now + 0.04, 0.08, 0.16, 'highpass', 4800, 1.4);
  }

  // Urgent warning beep (boil over / fire alarm)
  playAlarm(isFire = false) {
    if (!this.sfxOn || !this._unlocked || !this._ctx || this._ctx.state !== 'running') return;
    const now = this._ctx.currentTime;
    if (isFire) {
      this._tone(this._sfxGain, 980, 'sawtooth', now, 0.14, 0.16, 1340);
      this._tone(this._sfxGain, 1340, 'sawtooth', now + 0.15, 0.14, 0.16, 980);
    } else {
      this._tone(this._sfxGain, 860, 'square', now, 0.09, 0.12);
    }
  }

  // White foam extinguisher hiss
  playFoam() {
    if (!this.sfxOn || !this._unlocked || !this._ctx || this._ctx.state !== 'running') return;
    const now = this._ctx.currentTime;
    this._noise(this._sfxGain, now, 0.16, 0.24, 'bandpass', 2600, 0.8);
  }

  // Quick dash whoosh
  playDash() {
    if (!this.sfxOn || !this._unlocked || !this._ctx || this._ctx.state !== 'running') return;
    const now = this._ctx.currentTime;
    this._noise(this._sfxGain, now, 0.14, 0.22, 'bandpass', 900, 1.1);
    this._tone(this._sfxGain, 280, 'sine', now, 0.12, 0.18, 560);
  }

  // Gacha wheel click tick
  playWheelTick(pitch = 1.0) {
    if (!this.sfxOn || !this._unlocked || !this._ctx || this._ctx.state !== 'running') return;
    const now = this._ctx.currentTime;
    this._tone(this._sfxGain, 700 * pitch, 'triangle', now, 0.035, 0.22, 460);
  }

  // Gacha win / Shift complete fanfare
  playFanfare() {
    if (!this.sfxOn || !this._unlocked || !this._ctx || this._ctx.state !== 'running') return;
    const now = this._ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      this._tone(this._sfxGain, n, 'triangle', now + i * 0.09, 0.36, 0.28);
    });
  }
}
