// Sonidos sintetizados con WebAudio (sin archivos .wav). Para tus grabaciones, ver desk.ts.
let ctx: AudioContext | null = null;

export function audioCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.12) {
  const c = audioCtx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

export const sfx = {
  ring() {
    for (let i = 0; i < 3; i++) {
      tone(880, i * 0.22, 0.12, "square", 0.06);
      tone(660, i * 0.22 + 0.11, 0.1, "square", 0.06);
    }
  },
  good() {
    tone(660, 0, 0.1, "triangle");
    tone(880, 0.1, 0.16, "triangle");
  },
  ok() {
    tone(520, 0, 0.14, "triangle");
  },
  bad() {
    tone(220, 0, 0.18, "sawtooth", 0.09);
    tone(165, 0.14, 0.25, "sawtooth", 0.09);
  },
  done() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.18, "triangle"));
  },
  boss() {
    for (let i = 0; i < 4; i++) tone(i % 2 ? 440 : 587, i * 0.18, 0.15, "square", 0.07);
  },
  over() {
    [392, 330, 262].forEach((f, i) => tone(f, i * 0.2, 0.3, "sawtooth", 0.08));
  },
};

// 0,1 s de silencio: reproducirlo durante un toque «desbloquea» el sonido en iPhone para después.
export const SILENT_AUDIO = "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";
