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

  // Two stations, each a loop of four chords over a bass root. BAY FM is
  // warm and major (triangle wave, a brisk 520 ms per chord); DUSK FM is
  // minor and slower (sawtooth, 700 ms), for the neon hours.
  const STATIONS = [
    {
      name: 'BAY FM',
      tagline: 'Sunset Over the Bay',
      root: 57,
      wave: 'triangle',
      tempo: 520,
      chords: [
        [0, 4, 7],
        [5, 9, 12],
        [3, 7, 10],
        [10, 2, 5],
      ],
    },
    {
      name: 'DUSK FM',
      tagline: 'Neon Nights',
      root: 52,
      wave: 'sawtooth',
      tempo: 700,
      chords: [
        [0, 3, 7],
        [8, 12, 15],
        [5, 8, 12],
        [10, 13, 17],
      ],
    },
  ];

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function blip(freq, dur, type = 'sine', vol = 0.2, when = 0) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + when;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur);
  }

  // One chord of the current station: each note is a short voice that
  // fades over half a second, so the chords blur into a progression.
  function playChord(notes, root, wave) {
    if (!ctx) return;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = midiToFreq(root + n);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  }

  // The engine: two oscillators (sawtooth + a detuned square) through one
  // gain, started when Dara gets in a car and stopped when he gets out.
  function startEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc2 = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc2.type = 'square';
    engineOsc.frequency.value = 50;
    engineOsc2.frequency.value = 75;
    engineGain.gain.value = 0.03;
    engineOsc.connect(engineGain);
    engineOsc2.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();
  }

  function stopEngine() {
    if (!engineOsc) return;
    try {
      engineOsc.stop();
      engineOsc2.stop();
    } catch {
      // Already stopped; nothing to do.
    }
    engineOsc = null;
    engineOsc2 = null;
    engineGain = null;
  }

  // The two-tone siren: one oscillator whose note alternates every 400 ms
  // between 700 and 950 Hz, louder with more stars.
  function startSiren(wanted) {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenGain = ctx.createGain();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenGain.gain.value = 0.02 + wanted * 0.008;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    sirenOsc.start();
  }

  function stopSiren() {
    if (!sirenOsc) return;
    try {
      sirenOsc.stop();
    } catch {
      // Already stopped.
    }
    sirenOsc = null;
    sirenGain = null;
  }

  function startRadio() {
    if (!ctx || station < 0) return;
    const s = STATIONS[station];
    chordStep = 0;
    radioTimer = setInterval(() => {
      playChord(s.chords[chordStep % s.chords.length], s.root, s.wave);
      chordStep++;
    }, s.tempo);
  }

  function stopRadio() {
    if (radioTimer) {
      clearInterval(radioTimer);
      radioTimer = null;
    }
  }

  return {
    // Called on the first user gesture; everything else no-ops until then.
    unlock() {
      if (!ctx) {
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch {
          ctx = null;
        }
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    engineStart() {
      startEngine();
    },
    engineStop() {
      stopEngine();
    },
    // The engine note rises with speed; the gain swells with it.
    setEngine(speed, topSpeed) {
      if (!ctx || !engineOsc) return;
      const ratio = Math.min(1, Math.abs(speed) / topSpeed);
      engineOsc.frequency.value = 40 + ratio * 140;
      engineOsc2.frequency.value = 60 + ratio * 210;
      engineGain.gain.value = 0.02 + ratio * 0.06;
    },
    // Two-tone siren, louder with more stars. The tone alternates every
    // 400 ms between 700 and 950 Hz.
    setSiren(wanted) {
      if (!ctx) return;
      if (wanted <= 0) {
        stopSiren();
        return;
      }
      startSiren(wanted);
      const tone = Math.floor(ctx.currentTime / 0.4) % 2 === 0 ? 700 : 950;
      sirenOsc.frequency.value = tone;
      sirenGain.gain.value = 0.02 + wanted * 0.008;
    },
    // The car-alarm wail when a car is stolen: two rising beeps.
    alarm() {
      blip(880, 0.15, 'square', 0.15);
      blip(1174, 0.15, 'square', 0.15, 0.18);
    },
    // A short noise burst for a gunshot.
    gunshot() {
      if (!ctx) return;
      const dur = 0.12;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    },
    // Two rising notes when a pickup lands.
    pickup() {
      blip(660, 0.12, 'sine', 0.2);
      blip(880, 0.15, 'sine', 0.2, 0.1);
    },
    // A little cash-register arpeggio when a job pays out.
    payout() {
      blip(523, 0.1, 'sine', 0.2);
      blip(659, 0.1, 'sine', 0.2, 0.09);
      blip(784, 0.18, 'sine', 0.25, 0.18);
    },
    // Cycle off -> BAY FM -> DUSK FM -> off.
    toggleRadio() {
      station = station + 1 > 1 ? -1 : station + 1;
      stopRadio();
      if (station >= 0) startRadio();
      return this.radioLabel();
    },
    radioLabel() {
      if (station < 0) return 'RADIO OFF — press M';
      const s = STATIONS[station];
      return `♪ ${s.name} — ${s.tagline}`;
    },
  };
}
