// Synthesized sound effects (no audio files needed).

let ac = null;
let out = null;        // master bus: speakers + (optionally) the video recorder
let recDest = null;
let muted = false;
let noiseBuf = null;

function A() {
  if (!ac) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ac = new C();
    out = ac.createGain();
    out.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function noise(dur, type, freq, vol) {
  const a = A();
  if (!a || muted) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.4);
  src.stop(t + dur);
}

function tone(f0, f1, dur, vol, type = 'sine') {
  const a = A();
  if (!a || muted) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur);
}

// Audio track for recording the round as a video.
export function audioStream() {
  const a = A();
  if (!a || !a.createMediaStreamDestination) return null;
  if (!recDest) {
    recDest = a.createMediaStreamDestination();
    out.connect(recDest);
  }
  return recDest.stream;
}

export const sfx = {
  unlock() { A(); },
  shot(gun) {
    if (gun === 'uzi') { noise(0.05, 'highpass', 2200, 0.22); tone(320, 90, 0.05, 0.12, 'square'); }
    else if (gun === 'shotgun') { noise(0.3, 'lowpass', 2400, 0.7); tone(160, 40, 0.2, 0.4, 'square'); }
    else if (gun === 'bazooka') { noise(0.5, 'bandpass', 700, 0.6); tone(90, 300, 0.4, 0.15, 'sawtooth'); }
    else { noise(0.09, 'highpass', 1400, 0.3); tone(240, 60, 0.08, 0.2, 'square'); }
  },
  hit() { noise(0.16, 'lowpass', 1600, 0.45); tone(150, 40, 0.12, 0.3); },
  big() { noise(0.6, 'lowpass', 600, 0.9); tone(100, 28, 0.5, 0.6); },
  tick() { tone(880, 870, 0.07, 0.12, 'square'); },
  go() { tone(440, 990, 0.2, 0.18, 'square'); },
  end() { tone(620, 140, 0.55, 0.2, 'sawtooth'); },
  toggle() { muted = !muted; return muted; },
};
