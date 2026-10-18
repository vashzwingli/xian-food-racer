// Original pentatonic electronic score. No borrowed melody or recording.
export async function composeMusic() {
  const bpm = 112,
    beat = 60 / bpm,
    duration = 16 * 4 * beat,
    offline = new OfflineAudioContext(2, Math.ceil(duration * 44100), 44100),
    bus = offline.createGain(),
    dry = offline.createGain(),
    reverb = offline.createConvolver(),
    wet = offline.createGain(),
    compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.2;
  dry.gain.value = 0.75;
  wet.gain.value = 0.14;
  bus.connect(dry).connect(compressor);
  bus.connect(reverb);
  reverb.connect(wet).connect(compressor);
  compressor.connect(offline.destination);
  let seed = 1789;
  const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed / 4294967296) * 2 - 1;
    },
    impulse = offline.createBuffer(2, 44100 * 1.35, 44100);
  for (let c = 0; c < 2; c++) {
    const d = impulse.getChannelData(c);
    for (let i = 0; i < d.length; i++)
      d[i] = rnd() * Math.pow(1 - i / d.length, 2.7);
  }
  reverb.buffer = impulse;
  const noise = offline.createBuffer(1, 44100, 44100);
  for (let i = 0; i < noise.length; i++) noise.getChannelData(0)[i] = rnd();
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function tone(midi, time, dur, amp, type = "triangle", pan = 0) {
    if (time >= duration) return;
    dur = Math.min(dur, duration - time - 0.005);
    if (dur < 0.02) return;
    const env = offline.createGain(),
      filter = offline.createBiquadFilter(),
      stereo = offline.createStereoPanner();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(type === "sine" ? 1600 : 5200, time);
    filter.frequency.exponentialRampToValueAtTime(600, time + dur);
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(amp, time + 0.008);
    env.gain.exponentialRampToValueAtTime(amp * 0.18, time + dur * 0.72);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    stereo.pan.value = pan;
    env.connect(filter).connect(stereo).connect(bus);
    for (let h = 1; h <= 2; h++) {
      const osc = offline.createOscillator(),
        g = offline.createGain();
      osc.type = h === 1 ? type : "sine";
      osc.frequency.value = hz(midi) * h;
      g.gain.value = h === 1 ? 1 : 0.16;
      osc.connect(g).connect(env);
      osc.start(time);
      osc.stop(time + dur + 0.01);
    }
  }
  function hiss(time, amp, highpass, dur) {
    const n = offline.createBufferSource(),
      g = offline.createGain(),
      filter = offline.createBiquadFilter();
    n.buffer = noise;
    filter.type = "highpass";
    filter.frequency.value = highpass;
    g.gain.setValueAtTime(amp, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    n.connect(filter).connect(g).connect(bus);
    n.start(time);
    n.stop(time + dur);
  }
  function kick(time, amp) {
    const o = offline.createOscillator(),
      g = offline.createGain();
    o.frequency.setValueAtTime(125, time);
    o.frequency.exponentialRampToValueAtTime(43, time + 0.14);
    g.gain.setValueAtTime(amp, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.26);
    o.connect(g).connect(bus);
    o.start(time);
    o.stop(time + 0.28);
  }
  const roots = [36, 33, 41, 43],
    melodies = [
      [72, 74, 76, 79, 76, 74, 72, 69],
      [69, 72, 74, 76, 74, 72, 69, 67],
      [72, 76, 79, 81, 79, 76, 74, 72],
      [74, 76, 79, 74, 72, 69, 67, 69],
    ];
  for (let bar = 0; bar < 16; bar++) {
    const time = bar * 4 * beat,
      root = roots[Math.floor(bar / 2) % 4],
      melody = melodies[Math.floor(bar / 2) % 4];
    for (let b = 0; b < 4; b++) {
      kick(time + b * beat, b === 0 || b === 2 ? 0.2 : 0.075);
      tone(root + (b % 2 ? 12 : 0), time + b * beat, 0.32, 0.14, "sine", 0);
      if (b === 1 || b === 3) {
        hiss(time + b * beat, 0.055, 1100, 0.14);
        tone(50, time + b * beat, 0.12, 0.035, "triangle", 0);
      }
    }
    for (let k = 0; k < 8; k++) {
      hiss(time + (k * beat) / 2, k % 2 ? 0.016 : 0.011, 6800, 0.045);
      if ((bar + k) % 7 !== 0)
        tone(
          melody[(k + (bar % 2) * 2) % 8] + (bar > 7 && k === 6 ? 12 : 0),
          time + (k * beat) / 2,
          0.4,
          k % 2 ? 0.065 : 0.085,
          "triangle",
          ((k % 3) - 1) * 0.22,
        );
    }
    if (bar % 2 === 0)
      for (let note of [root + 12, root + 19, root + 24]) {
        const o = offline.createOscillator(),
          env = offline.createGain();
        o.type = "sine";
        o.frequency.value = hz(note);
        env.gain.setValueAtTime(0.0001, time);
        env.gain.linearRampToValueAtTime(0.026, time + 0.5);
        env.gain.exponentialRampToValueAtTime(
          0.0001,
          Math.min(duration - 0.01, time + beat * 7.5),
        );
        o.connect(env).connect(bus);
        o.start(time);
        o.stop(Math.min(duration, time + beat * 8));
      }
  }
  const result = await offline.startRendering();
  let peak = 0;
  for (let c = 0; c < 2; c++) {
    const d = result.getChannelData(c);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  const scale = 0.76 / (peak || 1);
  for (let c = 0; c < 2; c++) {
    const d = result.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= scale;
  }
  return result;
}
