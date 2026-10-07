// Responder con la voz: el jugador pulsa «Hablar», lee una de las tres frases y se elige la que más
// se parece. Usa el reconocimiento de voz del navegador (Chrome, Edge y Safari; el audio lo procesa
// el servicio del navegador). Escucha una frase por pulsación, que es lo que mejor va en el móvil.

const words = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

const NUMBERS: Record<string, number> = { uno: 0, "1": 0, dos: 1, "2": 1, tres: 2, "3": 2 };

/** Índice de la frase que más se parece a lo que se ha oído, o -1 si no está claro. */
export function matchOption(heard: string, options: string[]): number {
  const said = heard.trim().toLowerCase().replace(/[.!?¡¿]/g, "").replace(/^(la |opcion |opción )/, "");
  if (said in NUMBERS) return NUMBERS[said];
  const got = new Set(words(heard));
  const scores = options.map((o) => {
    const w = words(o);
    return w.length ? w.filter((x) => got.has(x)).length / w.length : 0;
  });
  const best = Math.max(...scores);
  const second = [...scores].sort((a, b) => b - a)[1] ?? 0;
  return best >= 0.3 && best - second >= 0.1 ? scores.indexOf(best) : -1;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Sin permiso para el micrófono: permítelo en el navegador.",
  "service-not-allowed": "El navegador no deja usar la voz. En iPhone: Ajustes › General › Teclado › Activar dictado.",
  "no-speech": "No te he oído. Toca «Hablar» y habla más cerca.",
  "audio-capture": "No encuentro el micrófono.",
  network: "El reconocimiento de voz necesita conexión.",
};

export class VoiceInput {
  private rec: any = null;

  static supported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  /** Escucha una frase. `onPartial` recibe lo que va entendiendo; la promesa da el texto final. */
  listenOnce(onPartial: (text: string) => void): Promise<string> {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return Promise.reject(new Error("Tu navegador no reconoce la voz: usa Chrome, Edge o Safari."));
    this.stop();
    return new Promise((resolve, reject) => {
      const rec = new Ctor();
      this.rec = rec;
      rec.lang = "es-ES";
      rec.continuous = false;
      rec.interimResults = true;
      let text = "";
      rec.onresult = (e: any) => {
        text = Array.from(e.results as ArrayLike<any>, (r) => r[0].transcript).join(" ");
        onPartial(text);
      };
      rec.onerror = (e: any) => reject(new Error(ERRORS[e.error] ?? `Error de voz: ${e.error}`));
      rec.onend = () => {
        if (this.rec === rec) this.rec = null;
        if (text) resolve(text);
        else reject(new Error(ERRORS["no-speech"]));
      };
      try {
        rec.start();
      } catch {
        reject(new Error("No se ha podido empezar a escuchar."));
      }
    });
  }

  get listening() {
    return !!this.rec;
  }

  stop() {
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      rec.onresult = rec.onend = rec.onerror = null;
      rec.abort?.();
    }
  }
}
