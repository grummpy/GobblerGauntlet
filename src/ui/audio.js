/** Live Web Audio chiptune. Everything is synthesized; there are no audio files. */

const LEAD = [659.25, 783.99, 880, 783.99, 659.25, 587.33, 659.25, 783.99, 880, 987.77, 880, 783.99, 659.25, 783.99, 587.33, 659.25];
const BASS = [164.81, 196, 146.83, 174.61];

export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;
  let volume = 0.8;
  let live = true;
  let themeOn = false;
  let timer = 0;
  let unlocked = false;

  function context() {
    if (ctx) return ctx;
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      const length = Math.floor(ctx.sampleRate * 0.25);
      noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noise.getChannelData(0);
      let seed = 0x12345678;
      for (let i = 0; i < length; i += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = (seed / 4294967296) * 2 - 1;
      }
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, when, dur, type, gain) {
    const audio = context();
    if (!audio || !live || !master) return;
    try {
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, when);
      amp.gain.setValueAtTime(0.0001, when);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), when + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(amp);
      amp.connect(master);
      osc.start(when);
      osc.stop(when + dur + 0.02);
    } catch {
      /* ignore a voice that the browser rejects */
    }
  }

  function burst(when, dur, gain, freq = 180) {
    const audio = context();
    if (!audio || !live || !noise || !master) return;
    try {
      const src = audio.createBufferSource();
      src.buffer = noise;
      const filter = audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = freq;
      const amp = audio.createGain();
      amp.gain.setValueAtTime(gain, when);
      amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      src.connect(filter);
      filter.connect(amp);
      amp.connect(master);
      src.start(when);
      src.stop(when + dur);
    } catch {
      /* ignore */
    }
  }

  function schedule(when) {
    const audio = context();
    if (!audio || !themeOn) return;
    const step = 0.18;
    for (let i = 0; i < LEAD.length; i += 1) {
      tone(LEAD[i], when + i * step, 0.16, "square", 0.04);
      if (i % 4 === 0) tone(BASS[(i / 4) % BASS.length], when + i * step, 0.5, "triangle", 0.055);
    }
    const dur = LEAD.length * step;
    const wait = Math.max(40, (when + dur - audio.currentTime - 0.08) * 1000);
    timer = setTimeout(() => schedule(audio.currentTime + 0.05), wait);
  }

  return {
    unlock() {
      const audio = context();
      unlocked = true;
      if (audio && audio.state === "suspended") audio.resume().catch(() => {});
    },
    setVolume(value) {
      volume = value;
      if (master) master.gain.value = value;
    },
    setLive(value) {
      live = value;
      if (!live) this.stopTheme();
      else if (unlocked) this.ensureTheme();
    },
    ensureTheme() {
      if (!live || themeOn || !unlocked) return;
      if (!context()) return;
      themeOn = true;
      schedule(context().currentTime + 0.05);
    },
    stopTheme() {
      themeOn = false;
      if (timer) clearTimeout(timer);
      timer = 0;
    },
    countdown(n) {
      const audio = context();
      if (!audio) return;
      const when = audio.currentTime + 0.01;
      tone(n === 0 ? 880 : 440 + n * 40, when, 0.12, "square", 0.07);
    },
    go() {
      const audio = context();
      if (!audio) return;
      const when = audio.currentTime + 0.01;
      tone(523.25, when, 0.1, "square", 0.07);
      tone(659.25, when + 0.08, 0.14, "square", 0.07);
    },
    sfx(type) {
      const audio = context();
      if (!audio || !live) return;
      const when = audio.currentTime + 0.005;
      if (type === "jump") tone(620, when, 0.09, "square", 0.05);
      else if (type === "dash") {
        burst(when, 0.12, 0.08, 900);
        tone(420, when, 0.1, "sawtooth", 0.04);
      } else if (type === "corn") {
        tone(660, when, 0.08, "square", 0.05);
        tone(880, when + 0.07, 0.1, "square", 0.05);
      } else if (type === "hit" || type === "stun" || type === "bump") burst(when, 0.16, 0.1, type === "stun" ? 140 : 240);
      else if (type === "eliminate") {
        tone(392, when, 0.12, "sawtooth", 0.06);
        tone(262, when + 0.1, 0.18, "sawtooth", 0.06);
      } else if (type === "finish") tone(784, when, 0.12, "square", 0.05);
    },
    roundWin() {
      const audio = context();
      if (!audio) return;
      const when = audio.currentTime + 0.02;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
        tone(freq, when + index * 0.09, 0.16, "square", 0.06);
      });
    },
    matchWin() {
      const audio = context();
      if (!audio) return;
      const when = audio.currentTime + 0.02;
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
        tone(freq, when + index * 0.11, 0.2, "square", 0.07);
      });
    },
  };
}
