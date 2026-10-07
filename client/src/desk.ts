import { audioFile, SILENCE_REPLY, type CallDef } from "./calls";
import { CAST } from "./config";
import { audioCtx, sfx } from "./audio";
import { faceFile } from "./characters";

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

  /** Devuelve los puntos (0-9) o null si el jugador se levanta a mitad de llamada. */
  run(call: CallDef, castIdx: number): Promise<number | null> {
    this.active = true;
    const root = $("desk");
    root.classList.remove("hidden");
    $("c-product").textContent = call.product;
    $("c-emoji").textContent = call.emoji;
    $("c-name").textContent = call.customer;
    $("c-say").textContent = "Marcando…";
    $("c-reply").classList.add("hidden");
    $("c-result").classList.add("hidden");
    $("c-options").innerHTML = "";
    $("d-avatar").textContent = CAST[castIdx % CAST.length].name.slice(0, 1);
    const who = CAST[castIdx % CAST.length];
    $("d-avatar").style.background = `url("faces/${faceFile(who.name)}") center / cover no-repeat, #${who.shirt.toString(16).padStart(6, "0")}`;
    const img = new Image(); // con foto, se quita la inicial
    img.onload = () => ($("d-avatar").textContent = "");
    img.src = `faces/${faceFile(who.name)}`;
    $("d-esc").classList.remove("hidden");

    const tick = () => {
      const d = new Date();
      $("d-time").textContent = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    };
    tick();
    this.clockTimer = window.setInterval(tick, 10000);

    $("d-cam").onclick = () => void this.toggleCam();
    $("d-mic").onclick = () => void this.toggleMic();

    return new Promise<number | null>((resolve) => {
      let total = 0;
      let round = 0;
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
        this.close();
        resolve(v);
      };

      const showResult = () => {
        clearInterval(timer);
        this.talk(false);
        $("c-options").innerHTML = "";
        $("c-timer").style.width = "0%";
        const msg =
          total >= 8 ? "¡Venta cerrada! Tu supervisor te regala una galleta caducada." :
          total >= 5 ? "Venta a medias. Tu supervisor te mira con indiferencia profesional." :
          total >= 2 ? "Casi nada. Te descuentan el café de esta semana." :
          "Desastre. El cliente cuelga y el sistema te marca en rojo.";
        const r = $("c-result");
        r.classList.remove("hidden");
        r.innerHTML = `<b>+${total} puntos de cuota</b><br>${msg}<br><button id="c-hang">Colgar (Enter)</button>`;
        total >= 5 ? sfx.done() : sfx.bad();
        $("c-hang").onclick = () => end(total);
        locked = false;
        this.onKey = (e) => {
          if (e.key === "Enter" || e.key === " ") end(total);
          if (e.key === "Escape") end(total);
        };
      };

      const pick = (k: number | null) => {
        if (locked) return;
        locked = true;
        clearInterval(timer);
        const rd = call.rounds[round];
        const opt = k === null ? null : rd.options[k];
        const pts = opt ? opt.pts : 0;
        total += pts;
        const reply = opt ? opt.reply : SILENCE_REPLY.text;
        const rep = $("c-reply");
        rep.classList.remove("hidden");
        rep.textContent = reply;
        pts === 3 ? sfx.good() : pts === 1 ? sfx.ok() : sfx.bad();
        // primero lo que dice el jugador, después la reacción del cliente
        const said = this.playSeq(
          opt && k !== null
            ? [opt.audio ?? audioFile(call.id, round + 1, "jugador", k + 1), opt.replyAudio ?? audioFile(call.id, round + 1, "respuesta", k + 1)]
            : [SILENCE_REPLY.audio],
        );
        [...$("c-options").children].forEach((b, i) => {
          (b as HTMLButtonElement).disabled = true;
          if (i === k) b.classList.add(pts === 3 ? "good" : pts === 1 ? "meh" : "bad");
        });
        void Promise.all([said, new Promise((r) => window.setTimeout(r, 1700))]).then(() => {
          if (finished) return;
          round++;
          if (round >= call.rounds.length) showResult();
          else showRound();
        });
      };

      const showRound = () => {
        locked = false;
        const rd = call.rounds[round];
        $("c-reply").classList.add("hidden");
        $("c-say").textContent = `“${rd.say}”`;
        void this.playSeq([rd.sayAudio ?? audioFile(call.id, round + 1, "cliente")]);
        this.talk(true);
        const opts = $("c-options");
        opts.innerHTML = "";
        rd.options.forEach((o, i) => {
          const b = document.createElement("button");
          b.innerHTML = `<kbd>${i + 1}</kbd> ${o.t}`;
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
        this.onKey = (e) => {
          if (e.key >= "1" && e.key <= "3") {
            pick(Number(e.key) - 1);
          } else if (e.key === "Escape") end(null);
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
