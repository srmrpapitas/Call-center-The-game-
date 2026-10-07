// Voz del navegador (texto a voz, gratis) para las frases que todavía no tienen audio grabado.
// Cada personaje usa una de las voces en español del dispositivo y su propio tono y velocidad.

export interface VoiceStyle {
  pitch: number;
  rate: number;
}

const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;

function spanishVoices(): SpeechSynthesisVoice[] {
  return synth?.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es")) ?? [];
}
synth?.getVoices(); // en algunos navegadores la lista carga tarde: se pide pronto

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Lee el texto en voz alta; termina al acabar (o si el navegador no tiene voz). */
export function speak(text: string, style: VoiceStyle, who: string): Promise<void> {
  if (!synth || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text.replace(/[«»“”]/g, ""));
    const voices = spanishVoices();
    if (voices.length) u.voice = voices[hash(who) % voices.length];
    u.lang = u.voice?.lang ?? "es-ES";
    u.pitch = style.pitch;
    u.rate = style.rate;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        clearTimeout(guard);
        resolve();
      }
    };
    // por si el navegador no avisa del final
    const guard = window.setTimeout(finish, 2500 + text.length * 110 / style.rate);
    u.onend = u.onerror = finish;
    synth.speak(u);
  });
}

export function stopSpeaking() {
  synth?.cancel();
}
