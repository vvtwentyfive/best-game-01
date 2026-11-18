// Procedural WebAudio: every sound effect and the music loop are synthesized
// from oscillators — no audio files, no network. The context starts on the
// first user gesture; headless screenshot runs never create one.
const MUSIC_SCALES = [
  [220.0, 246.94, 293.66, 329.63, 392.0, 440.0],
  [196.0, 220.0, 261.63, 293.66, 349.23, 392.0],
  [174.61, 196.0, 233.08, 261.63, 311.13, 349.23],
];
const MUSIC_PATTERN = [0, 2, 4, 3, 5, 4, 2, 1, 0, 3, 4, 5, 2, 0, 1, 3];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = 0;
  let musicStep = 0;
  let musicRealm = 0;
  let musicOn = false;

  function ensureContext() {
    if (ctx) return true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, volume, slideTo, when) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, volume, lowpass) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function playMusicNote(step) {
    if (!ctx || muted) return;
    const scale = MUSIC_SCALES[musicRealm] || MUSIC_SCALES[0];
    const degree = MUSIC_PATTERN[step % MUSIC_PATTERN.length];
    const freq = scale[degree % scale.length] * (step % 32 >= 16 ? 2 : 1);
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.5, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.34);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(t0);
    osc.stop(t0 + 0.36);
    if (step % 4 === 0) {
      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bass.type = 'sine';
      bass.frequency.value = scale[0] / 2;
      bassGain.gain.setValueAtTime(0.6, t0);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
      bass.connect(bassGain);
      bassGain.connect(musicGain);
      bass.start(t0);
      bass.stop(t0 + 0.52);
    }
  }

  return {
    unlock() {
      if (ensureContext() && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    startMusic(realmIndex) {
      musicOn = true;
      musicRealm = realmIndex;
      musicTimer = 0;
    },
    stopMusic() {
      musicOn = false;
    },
    setRealm(realmIndex) {
      musicRealm = realmIndex;
    },
    updateMusic(dt) {
      if (!musicOn || !ctx || muted) return;
      musicTimer += dt;
      const stepDur = 0.21;
      while (musicTimer >= stepDur) {
        musicTimer -= stepDur;
        playMusicNote(musicStep);
        musicStep += 1;
      }
    },
    playShoot() { tone(880, 0.08, 'square', 0.08, 220); },
    playHit() { tone(180, 0.06, 'sawtooth', 0.1, 90); },
    playEnemyDie() { noiseBurst(0.18, 0.22, 900); tone(320, 0.14, 'triangle', 0.12, 60); },
    playExplosion() { noiseBurst(0.45, 0.4, 500); tone(90, 0.4, 'sine', 0.3, 35); },
    playPickup() { tone(660, 0.09, 'sine', 0.14, 990); tone(990, 0.12, 'sine', 0.12, 1320, 0.07); },
    playShard() { tone(1320, 0.06, 'sine', 0.07, 1760); },
    playLevelUp() {
      tone(523, 0.12, 'triangle', 0.18);
      tone(659, 0.12, 'triangle', 0.18, null, 0.1);
      tone(784, 0.2, 'triangle', 0.2, null, 0.2);
      tone(1047, 0.3, 'triangle', 0.2, null, 0.3);
    },
    playRelic() {
      tone(392, 0.15, 'triangle', 0.18);
      tone(523, 0.15, 'triangle', 0.18, null, 0.12);
      tone(659, 0.15, 'triangle', 0.18, null, 0.24);
      tone(784, 0.35, 'triangle', 0.2, null, 0.36);
    },
    playHurt() { tone(140, 0.18, 'sawtooth', 0.22, 55); noiseBurst(0.1, 0.15, 700); },
    playBossRoar() { tone(65, 0.9, 'sawtooth', 0.3, 45); tone(98, 0.9, 'square', 0.16, 50); noiseBurst(0.6, 0.2, 300); },
    playClick() { tone(700, 0.05, 'sine', 0.12, 500); },
    playDash() { noiseBurst(0.12, 0.14, 2400); },
    playVictory() {
      const notes = [523, 659, 784, 1047, 784, 1047, 1319];
      notes.forEach((n, i) => tone(n, 0.22, 'triangle', 0.2, null, i * 0.14));
    },
    playDefeat() {
      const notes = [392, 370, 349, 311];
      notes.forEach((n, i) => tone(n, 0.3, 'triangle', 0.18, null, i * 0.22));
    },
    playWaveClear() { tone(587, 0.1, 'triangle', 0.14); tone(880, 0.18, 'triangle', 0.14, null, 0.1); },
    playBomb() { noiseBurst(0.7, 0.5, 350); tone(70, 0.6, 'sine', 0.35, 28); },
  };
}
