// Sound, all synthesized with WebAudio — no audio files, no network. Two
// procedural radio stations (BAY FM, DUSK FM), an engine hum that follows
// speed, a two-tone siren, skid noise, and the little blips that say "job
// done". The context only starts on a user gesture; screenshots run silent.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = null;
  let station = -1; // -1 off, 0 BAY FM, 1 DUSK FM
  let chordStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    // Engine: two detuned saws through a lowpass, pitch follows speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 58;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();
    // Siren: a square wave that alternates 740 / 980 Hz twice a second.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = 740;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    sirenOsc.start();
    return true;
  }

  function blip(freq, dur, type = 'sine', vol = 0.15, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Two stations, both synthesized. BAY FM: Am – F – C – G, warm triangle
  // pads. DUSK FM: Dm – Bb – F – C, slower sine pads for the late-night
  // drive. Scheduled on a timer so the loop never drifts.
  const STATIONS = [
    {
      name: 'BAY FM ♪',
      wave: 'triangle',
      vol: 0.05,
      chords: [
        [220, 261.6, 329.6],
        [174.6, 220, 261.6],
        [196, 246.9, 293.7],
        [164.8, 196, 246.9],
      ],
    },
    {
      name: 'DUSK FM ♪',
      wave: 'sine',
      vol: 0.06,
      chords: [
        [146.8, 220, 293.7],
        [116.5, 174.6, 233.1],
        [174.6, 220, 261.6],
        [130.8, 196, 261.6],
      ],
    },
  ];
  function playChord() {
    if (!ctx || station < 0) return;
    const st = STATIONS[station];
    const chord = st.chords[chordStep % st.chords.length];
    chordStep++;
    const t = ctx.currentTime;
    for (const f of chord) {
      const o = ctx.createOscillator();
      o.type = st.wave;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(st.vol, t + 0.4);
      g.gain.linearRampToValueAtTime(0.001, t + 2.1);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 2.2);
    }
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = chord[0] / 2;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.07, t);
    bg.gain.linearRampToValueAtTime(0.001, t + 2.1);
    bass.connect(bg);
    bg.connect(ctx.destination);
    bass.start(t);
    bass.stop(t + 2.2);
  }

  return {
    unlock() {
      ensure();
    },
    engineStart() {
      if (ensure() && engineGain) engineGain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.2);
    },
    engineStop() {
      if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    },
    setEngine(speedNorm, sliding) {
      if (!ctx || !engineOsc) return;
      const f = 55 + speedNorm * 140 + (sliding ? 25 : 0);
      engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(f * 1.02, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.03 + speedNorm * 0.05, ctx.currentTime, 0.1);
    },
    setSiren(on) {
      if (!ctx || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.3);
      if (on && sirenOsc) {
        sirenOsc.frequency.value = Math.floor(performance.now() / 450) % 2 ? 740 : 980;
      }
    },
    alarm() {
      if (!ensure()) return;
      for (let i = 0; i < 3; i++) {
        blip(1180, 0.12, 'square', 0.08, i * 0.28);
        blip(880, 0.12, 'square', 0.08, i * 0.28 + 0.14);
      }
    },
    gunshot() {
      if (!ctx) return;
      const dur = 0.12;
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
      blip(160, 0.1, 'square', 0.12);
    },
    pickup() {
      if (!ensure()) return;
      blip(660, 0.12);
      blip(880, 0.16, 'sine', 0.15, 0.09);
    },
    payout() {
      if (!ensure()) return;
      [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.18, 'sine', 0.14, i * 0.09));
    },
    toggleRadio() {
      if (!ensure()) return false;
      // M cycles: off → BAY FM → DUSK FM → off.
      station = station + 1 > 1 ? -1 : station + 1;
      if (station >= 0 && !radioTimer) radioTimer = setInterval(playChord, 2000);
      if (station < 0 && radioTimer) {
        clearInterval(radioTimer);
        radioTimer = null;
      }
      if (station >= 0) playChord();
      return station >= 0;
    },
    radioLabel() {
      return station < 0 ? 'RADIO OFF — press M' : STATIONS[station].name;
    },
  };
}
