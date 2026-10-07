import type { CallDef } from "./calls";
import { CAST } from "./config";
import { audioCtx, sfx } from "./audio";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ROUND_MS = 10000;

// Escritorio dentro del juego: ventana de llamada, tu cámara y el medidor de tu voz.
// La webcam y el micrófono solo se activan si el jugador pulsa el botón.
export class DeskUI {
  active = false;
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
    $("d-avatar").style.background = "#" + CAST[castIdx % CAST.length].shirt.toString(16).padStart(6, "0");
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
        this.close();
        resolve(v);
      };

      const showResult = () => {
        clearInterval(timer);
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
        const reply = opt ? opt.reply : "…¿Hola? ¿Sigue usted ahí?";
        const rep = $("c-reply");
        rep.classList.remove("hidden");
        rep.textContent = reply;
        pts === 3 ? sfx.good() : pts === 1 ? sfx.ok() : sfx.bad();
        this.play(opt?.replyAudio);
        [...$("c-options").children].forEach((b, i) => {
          (b as HTMLButtonElement).disabled = true;
          if (i === k) b.classList.add(pts === 3 ? "good" : pts === 1 ? "meh" : "bad");
        });
        window.setTimeout(() => {
          round++;
          if (round >= call.rounds.length) showResult();
          else showRound();
        }, 1700);
      };

      const showRound = () => {
        locked = false;
        const rd = call.rounds[round];
        $("c-reply").classList.add("hidden");
        $("c-say").textContent = `“${rd.say}”`;
        this.play(rd.sayAudio);
        const opts = $("c-options");
        opts.innerHTML = "";
        rd.options.forEach((o, i) => {
          const b = document.createElement("button");
          b.innerHTML = `<kbd>${i + 1}</kbd> ${o.t}`;
          b.onclick = () => {
            this.play(o.audio);
            pick(i);
          };
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
            const i = Number(e.key) - 1;
            this.play(rd.options[i].audio);
            pick(i);
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

  private play(url?: string) {
    this.stopAudio();
    if (!url) return;
    this.audioEl = new Audio(`audio/calls/${url}`);
    void this.audioEl.play().catch(() => {});
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
