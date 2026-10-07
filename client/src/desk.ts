import { audioFile, reactionFor, SILENCE_REPLY, TRUST_DEAL, TRUST_START, TRUST_WIN, type CallDef } from "./calls";
import { CAST } from "./config";
import { audioCtx, sfx } from "./audio";
import { faceFile } from "./characters";
import { matchOption, VoiceInput } from "./voice";

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* sin almacenamiento */
    }
  },
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ROUND_MS = 10000;

// Escritorio dentro del juego: ventana de llamada, tu cámara y el medidor de tu voz.
// La webcam y el micrófono solo se activan si el jugador pulsa el botón.
export class DeskUI {
  active = false;
  /** Avisa de cuándo el jugador está hablando por teléfono (para mover la cabeza del avatar). */
  onTalk: (talking: boolean) => void = () => {};
  private talk(on: boolean) {
    $("d-avatar").classList.toggle("talking", on);
    this.onTalk(on);
  }
  private onKey: ((e: KeyboardEvent) => void) | null = null;
  private stream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private meterTimer = 0;
  private clockTimer = 0;
  private audioEl: HTMLAudioElement | null = null;
  private voice = new VoiceInput();
  private voiceOn = store.get("cc.voice") === "1";
  current: CallDef | null = null; // llamada en curso (la usa también la prueba de humo)
  roundIdx = 0;

  /** Devuelve los puntos (0-9) o null si el jugador se levanta a mitad de llamada. */
  run(call: CallDef, castIdx: number): Promise<number | null> {
    this.active = true;
    const root = $("desk");
    root.classList.remove("hidden");
    $("c-product").textContent = call.scam;
    $("c-emoji").textContent = call.emoji;
    $("c-name").textContent = call.customer;
    $("c-say").textContent = "Marcando…";
    $("c-reply").classList.add("hidden");
    $("c-result").classList.add("hidden");
    $("c-options").innerHTML = "";
    const who = CAST[castIdx % CAST.length];
    const alias = (text: string) => text.replaceAll("{alias}", who.alias);
    // webcam falsa: la foto del personaje (si existe) o su inicial
    const url = `faces/${faceFile(who.name)}`;
    $("d-avatar").style.background = `#${who.shirt.toString(16).padStart(6, "0")}`;
    $("d-initial").textContent = who.name.slice(0, 1);
    $("d-face").classList.add("hidden");
    const img = new Image();
    img.onload = () => {
      $("d-initial").textContent = "";
      for (const el of $("d-face").querySelectorAll<HTMLElement>(".top, .jaw")) el.style.backgroundImage = `url("${url}")`;
      $("d-face").classList.remove("hidden");
    };
    img.src = url;
    $("d-esc").classList.remove("hidden");

    const tick = () => {
      const d = new Date();
      $("d-time").textContent = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    };
    tick();
    this.clockTimer = window.setInterval(tick, 10000);

    $("d-cam").onclick = () => void this.toggleCam();
    $("d-mic").onclick = () => void this.toggleMic();
    $("d-voice").onclick = () => this.toggleVoice();
    this.voice.onHeard = () => {};
    this.showVoice();
    if (this.voiceOn) this.voice.start();

    this.current = call;
    this.roundIdx = 0;
    let trust = TRUST_START;
    const showTrust = () => {
      const bar = $("c-trust");
      bar.style.width = `${Math.max(0, Math.min(100, (trust / TRUST_WIN) * 100))}%`;
      bar.className = trust >= TRUST_DEAL ? "hi" : trust >= 40 ? "mid" : "lo";
    };
    showTrust();

    return new Promise<number | null>((resolve) => {
      let locked = false;
      let timer = 0;
      let startAt = 0;
      let finished = false;

      const end = (v: number | null) => {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        this.stopAudio();
        this.talk(false);
        this.current = null;
        this.close();
        resolve(v);
      };

      // trato cerrado o cuelga: frase final del cliente y resultado
      const finish = (deal: boolean) => {
        clearInterval(timer);
        this.talk(false);
        $("c-options").innerHTML = "";
        $("c-timer").style.width = "0%";
        const key = deal ? "trato" : "cuelga";
        const rep = $("c-reply");
        rep.classList.remove("hidden");
        rep.textContent = call.react[key];
        void this.playSeq([audioFile(call.id, key)]);
        const pts = deal ? (trust >= TRUST_WIN ? 9 : 6) : trust >= 40 ? 1 : 0;
        const msg = deal
          ? trust >= TRUST_WIN
            ? "¡Trato cerrado a lo grande! El jefe te deja comer sentado."
            : "Trato cerrado. Tu supervisor te regala una galleta caducada."
          : pts > 0
            ? "Casi pica. Te descuentan el café de esta semana."
            : "Te ha colgado. El sistema te marca en rojo y tu silla pierde una rueda.";
        const r = $("c-result");
        r.classList.remove("hidden");
        r.innerHTML = `<b>${deal ? "🤝 TRATO CERRADO" : "📵 CUELGA"} · +${pts} puntos de cuota</b><br>${msg}<br><button id="c-hang">Colgar (Enter)</button>`;
        deal ? sfx.done() : sfx.bad();
        $("c-hang").onclick = () => end(pts);
        locked = false;
        this.onKey = (e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "Escape") end(pts);
        };
      };

      const pick = (k: number | null) => {
        if (locked) return;
        locked = true;
        clearInterval(timer);
        this.voice.onHeard = () => {};
        const n = this.roundIdx + 1;
        const opt = k === null ? null : call.rounds[this.roundIdx].options[k];
        const delta = opt ? opt.trust : SILENCE_REPLY.trust;
        trust = Math.max(0, trust + delta);
        showTrust();
        const react = opt ? reactionFor(delta) : null;
        const rep = $("c-reply");
        rep.classList.remove("hidden");
        rep.textContent = react ? call.react[react] : SILENCE_REPLY.text;
        delta >= 20 ? sfx.good() : delta > 0 ? sfx.ok() : sfx.bad();
        // primero lo que dice el empleado, después la reacción del cliente
        const said = this.playSeq(react && k !== null ? [audioFile(call.id, `r${n}_op${k + 1}_jugador`), audioFile(call.id, react)] : [SILENCE_REPLY.audio]);
        [...$("c-options").children].forEach((b, i) => {
          (b as HTMLButtonElement).disabled = true;
          if (i === k) b.classList.add(delta >= 20 ? "good" : delta > 0 ? "meh" : "bad");
        });
        void Promise.all([said, new Promise((r) => window.setTimeout(r, 1700))]).then(() => {
          if (finished) return;
          this.roundIdx++;
          if (trust >= TRUST_WIN) finish(true);
          else if (trust <= 0) finish(false);
          else if (this.roundIdx >= call.rounds.length) finish(trust >= TRUST_DEAL);
          else showRound();
        });
      };

      const showRound = () => {
        locked = false;
        const n = this.roundIdx + 1;
        const rd = call.rounds[this.roundIdx];
        $("c-reply").classList.add("hidden");
        $("c-say").textContent = `“${alias(rd.say)}”`;
        void this.playSeq([audioFile(call.id, `r${n}_cliente`)]);
        this.talk(true);
        const opts = $("c-options");
        opts.innerHTML = "";
        rd.options.forEach((o, i) => {
          const b = document.createElement("button");
          b.innerHTML = `<kbd>${i + 1}</kbd> `;
          b.append(alias(o.t));
          b.onclick = () => pick(i);
          opts.appendChild(b);
        });
        startAt = performance.now();
        clearInterval(timer);
        timer = window.setInterval(() => {
          const f = 1 - (performance.now() - startAt) / ROUND_MS;
          $("c-timer").style.width = `${Math.max(0, f * 100)}%`;
          if (f <= 0) pick(null);
        }, 80);
        const texts = rd.options.map((o) => alias(o.t));
        this.voice.onHeard = (heard) => {
          const i = matchOption(heard, texts);
          $("d-heard").textContent = i >= 0 ? `Has dicho: «${heard}»` : `No te he entendido: «${heard}»`;
          if (i >= 0) pick(i);
        };
        this.onKey = (e) => {
          if (e.key >= "1" && e.key <= "3") pick(Number(e.key) - 1);
          else if (e.key === "Escape") end(null);
        };
      };

      sfx.ring();
      this.onKey = (e) => {
        if (e.key === "Escape") end(null);
      };
      window.setTimeout(() => {
        if (!finished) showRound();
      }, 1100);
    });
  }

  handleKey(e: KeyboardEvent): boolean {
    if (!this.active || !this.onKey) return false;
    this.onKey(e);
    e.preventDefault();
    return true;
  }

  /** Reproduce los audios en orden; termina al acabar el último. Si falta un archivo, se lo salta. */
  private async playSeq(urls: string[]) {
    this.stopAudio();
    for (const url of urls) {
      const el = new Audio(`audio/calls/${url}`);
      this.audioEl = el;
      await new Promise<void>((resolve) => {
        el.onended = el.onerror = el.onpause = () => resolve();
        el.play().catch(() => resolve());
      });
      if (this.audioEl !== el) return; // la cortó otro audio o se colgó la llamada
    }
  }

  private toggleVoice() {
    this.voiceOn = !this.voiceOn;
    store.set("cc.voice", this.voiceOn ? "1" : "0");
    if (this.voiceOn) this.voice.start();
    else this.voice.stop();
    this.showVoice();
  }

  private showVoice() {
    const b = $<HTMLButtonElement>("d-voice");
    if (!VoiceInput.supported()) {
      b.disabled = true;
      b.textContent = "Voz no disponible (usa Chrome o Edge)";
      return;
    }
    b.textContent = this.voiceOn ? "🔴 Te escucho: lee una frase" : "Responder con la voz";
    b.classList.toggle("on", this.voiceOn);
    $("d-heard").textContent = this.voiceOn ? "Lee en voz alta la frase que elijas (o di «uno», «dos» o «tres»)." : "";
    this.voice.onError = (msg) => {
      this.voiceOn = false;
      b.textContent = msg;
      b.classList.remove("on");
    };
  }

  private stopAudio() {
    this.audioEl?.pause();
    this.audioEl = null;
  }

  private async toggleCam() {
    const v = $<HTMLVideoElement>("d-video");
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
      v.srcObject = null;
      v.classList.add("hidden");
      $("d-avatar").classList.remove("hidden");
      $("d-cam").textContent = "Activar cámara";
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      v.srcObject = this.stream;
      v.classList.remove("hidden");
      $("d-avatar").classList.add("hidden");
      $("d-cam").textContent = "Apagar cámara";
    } catch {
      $("d-cam").textContent = "Cámara no disponible";
    }
  }

  private async toggleMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
      clearInterval(this.meterTimer);
      $("d-meter").style.width = "0%";
      $("d-mic").textContent = "Activar micro";
      return;
    }
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = audioCtx();
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      ctx.createMediaStreamSource(this.micStream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      this.meterTimer = window.setInterval(() => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (const b of buf) peak = Math.max(peak, Math.abs(b - 128));
        $("d-meter").style.width = `${Math.min(100, (peak / 128) * 160)}%`;
      }, 60);
      $("d-mic").textContent = "Apagar micro";
    } catch {
      $("d-mic").textContent = "Micro no disponible";
    }
  }

  private close() {
    this.active = false;
    this.voice.stop();
    this.onKey = null;
    $("desk").classList.add("hidden");
    clearInterval(this.clockTimer);
    clearInterval(this.meterTimer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.micStream = null;
    const v = $<HTMLVideoElement>("d-video");
    v.srcObject = null;
    v.classList.add("hidden");
    $("d-avatar").classList.remove("hidden");
    $("d-cam").textContent = "Activar cámara";
    $("d-mic").textContent = "Activar micro";
    $("d-meter").style.width = "0%";
  }
}
