// Synthesized sound: no audio files, everything is an oscillator or filtered noise
// through the Web Audio API. The music is a slow two-oscillator pad with a drifting
// filter; the effects are short envelopes. Nothing here is needed for the game to run:
// audio starts on the first user gesture and stays silent until then.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicStarted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.05;
      musicGain.connect(master);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  function startMusic() {
    if (!ctx || musicStarted) return;
    musicStarted = true;
    const pad = (freqA, freqB) => {
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      oscA.type = 'sine';
      oscB.type = 'triangle';
      oscA.frequency.value = freqA;
      oscB.frequency.value = freqB;
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      gain.gain.value = 0.5;
      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(gain);
      gain.connect(musicGain);
      oscA.start();
      oscB.start();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
    };
    pad(110, 164.81);
    pad(220, 277.18);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
      startMusic();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },
    shoot() { tone(880, 0.07, 'square', 0.05, 440); },
    hit() { noise(0.08, 0.12, 900); },
    kill() { tone(220, 0.18, 'sawtooth', 0.09, 55); noise(0.12, 0.08, 1400); },
    hurt() { tone(160, 0.25, 'sawtooth', 0.14, 60); noise(0.2, 0.1, 500); },
    pickup() { tone(1320, 0.09, 'sine', 0.07, 1760); },
    dash() { noise(0.16, 0.1, 2400); },
    levelup() {
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => tone(f, 0.22, 'triangle', 0.1), i * 70);
      });
    },
    boss() { tone(65, 0.9, 'sawtooth', 0.16, 40); noise(0.7, 0.12, 300); },
    waveclear() { [392, 523, 659].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.09), i * 90)); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.1), i * 110)); },
    over() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'sawtooth', 0.08), i * 160)); },
  };
}
