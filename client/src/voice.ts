// Responder con la voz: el jugador lee en voz alta una de las tres frases y se elige la que más se
// parece. Usa el reconocimiento de voz del navegador (Chrome y Edge; el audio lo procesa su servicio).

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
  const said = heard.trim().toLowerCase().replace(/^(la |opcion |opción )/, "");
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

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: any) => void) | null;
  start(): void;
  stop(): void;
};

export class VoiceInput {
  private rec: Rec | null = null;
  private wanted = false;
  onHeard: (text: string) => void = () => {};
  onError: (msg: string) => void = () => {};

  static supported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  start() {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor || this.wanted) return;
    this.wanted = true;
    const rec: Rec = new Ctor();
    rec.lang = "es-ES";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      if (r.isFinal) this.onHeard(r[0].transcript);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.wanted = false;
        this.onError("Sin permiso para el micrófono");
      }
    };
    // el navegador corta tras un rato de silencio: se vuelve a arrancar mientras esté activo
    rec.onend = () => {
      if (this.wanted) {
        try {
          rec.start();
        } catch {
          /* ya estaba arrancado */
        }
      }
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      /* ya estaba arrancado */
    }
  }

  stop() {
    this.wanted = false;
    this.rec?.stop();
    this.rec = null;
  }
}
