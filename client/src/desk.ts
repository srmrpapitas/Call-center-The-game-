import { audioFile, reactionFor, SILENCE_REPLY, TRUST_DEAL, TRUST_START, TRUST_WIN, type CallDef } from "./calls";
import { CAST } from "./config";
import { audioCtx, sfx, SILENT_AUDIO } from "./audio";
import { faceFile } from "./characters";
import { matchOption, VoiceInput } from "./voice";
import { speak, stopSpeaking, type VoiceStyle } from "./tts";

/** Una frase: su audio grabado y, si no existe, el texto que lee la voz del navegador. */
interface Line {
  file: string;
  text: string;
  voice: VoiceStyle;
  who: string;
}
const PLAYER_VOICE: VoiceStyle = { pitch: 1, rate: 1.1 };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ROUND_MS = 25000; // tiempo para contestar en cada ronda

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
  // un único reproductor: en iPhone solo suena lo que reutiliza un elemento ya «desbloqueado» con un toque
  private player = new Audio();
  private voice = new VoiceInput();
  /** Lo que hacer con una frase oída por voz en la ronda actual (también lo usa la prueba de humo). */
  heard: (text: string) => void = () => {};
  current: CallDef | null = null;
  /** Cuelga la llamada en curso desde fuera (apagón, redada). */
  abort: () => void = () => {};
  private virusTimer = 0;
  bankCode = ""; // nº de cuenta que dicta el cliente (lo lee también la prueba de humo) // llamada en curso (la usa también la prueba de humo)
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
    $("bank").classList.add("hidden");
    $("c-talk").parentElement!.classList.remove("hidden");
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
    // en el móvil no hay tecla Esc: tocar el aviso hace lo mismo
    $("d-esc").onclick = () => this.onKey?.(new KeyboardEvent("keydown", { key: "Escape" }));
    if (document.body.classList.contains("touch")) $("d-esc").textContent = "✕ Colgar y levantarse";

    const tick = () => {
      const d = new Date();
      $("d-time").textContent = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    };
    tick();
    this.clockTimer = window.setInterval(tick, 10000);

    $("d-cam").onclick = () => void this.toggleCam();
    $("d-mic").onclick = () => void this.toggleMic();
    $("c-talk").onclick = () => this.talkOnce();
    this.setTalk(false, VoiceInput.supported() ? "" : "Tu navegador no reconoce la voz: usa Chrome, Edge o Safari.");
    $<HTMLButtonElement>("c-talk").disabled = true; // hasta que el cliente conteste

    this.unlockAudio(); // la llamada empieza con un toque o tecla
    this.current = call;
    this.roundIdx = 0;
    const client = (key: string, text: string): Line => ({ file: audioFile(call.id, key), text, voice: call.voice, who: call.id });
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

      this.abort = () => end(null);
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
        this.heard = () => {};
        this.voice.stop();
        this.setTalk(false, "");
        $<HTMLButtonElement>("c-talk").disabled = true;
        this.talk(false);
        $("c-options").innerHTML = "";
        $("c-timer").style.width = "0%";
        const key = deal ? "trato" : "cuelga";
        const rep = $("c-reply");
        rep.classList.remove("hidden");
        rep.textContent = call.react[key];
        $("c-talk").parentElement!.classList.add("hidden");
        if (deal) {
          // nº de cuenta nuevo en cada llamada: el cliente lo dicta después de su frase del trato
          this.bankCode = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join("");
          const digits = [...this.bankCode].join(", ");
          void this.playSeq([client(key, call.react[key]), { file: "general_cuenta.mp3", text: `Apunta: ${digits}`, voice: call.voice, who: call.id }]);
        } else void this.playSeq([client(key, call.react[key])]);
        if (deal) {
          sfx.done();
          void this.openBank(call).then((emptied) => !finished && showResult(true, emptied));
        } else showResult(false, false);
      };

      // trato: 5 (o 7 si la confianza llegó arriba) + 2 si vacías la cuenta; sin trato: 0 o 1
      const showResult = (deal: boolean, emptied: boolean) => {
        $("bank").classList.add("hidden");
        const pts = deal ? (trust >= TRUST_WIN ? 7 : 5) + (emptied ? 2 : 0) : trust >= 40 ? 1 : 0;
        const msg = deal
          ? emptied
            ? "Cuenta vaciada. El jefe te deja comer sentado hoy."
            : "Trato cerrado, pero sin botín. Tu supervisor te regala una galleta caducada."
          : pts > 0
            ? "Casi pica. Te descuentan el café de esta semana."
            : "Te ha colgado. El sistema te marca en rojo y tu silla pierde una rueda.";
        const r = $("c-result");
        r.classList.remove("hidden");
        r.innerHTML = `<b>${deal ? (emptied ? "💸 CUENTA VACIADA" : "🤝 TRATO CERRADO") : "📵 CUELGA"} · +${pts} puntos de cuota</b><br>${msg}<br><button id="c-hang">Colgar (Enter)</button>`;
        if (!deal) sfx.bad();
        $("c-hang").onclick = () => end(pts);
        locked = false;
        this.onKey = (e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "Escape") end(pts);
        };
      };

      // byVoice: si el jugador ya ha dicho la frase con el micro, no se repite su grabación
      const pick = (k: number | null, byVoice = false) => {
        if (locked) return;
        locked = true;
        clearInterval(timer);
        this.heard = () => {};
        this.voice.stop();
        this.setTalk(false);
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
        const said = this.playSeq(
          opt && react && k !== null
            ? [
                ...(byVoice ? [] : [{ file: audioFile(call.id, `r${n}_op${k + 1}_jugador`), text: alias(opt.t), voice: PLAYER_VOICE, who: who.name }]),
                client(react, call.react[react]),
              ]
            : [{ file: SILENCE_REPLY.audio, text: SILENCE_REPLY.text, voice: call.voice, who: call.id }],
        );
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
        void this.playSeq([client(`r${n}_cliente`, alias(rd.say))]);
        this.talk(true);
        const opts = $("c-options");
        opts.innerHTML = "";
        rd.options.forEach((o, i) => {
          const b = document.createElement("button");
          b.innerHTML = `<kbd>${i + 1}</kbd> `;
          b.append(alias(o.t));
          b.onclick = () => {
            this.unlockAudio();
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
        const texts = rd.options.map((o) => alias(o.t));
        this.heard = (heard) => {
          const i = matchOption(heard, texts);
          $("c-heard").textContent = i >= 0 ? `Has dicho: «${heard}»` : `No te he entendido: «${heard}». Repite o toca la frase.`;
          if (i >= 0) pick(i, true);
        };
        $<HTMLButtonElement>("c-talk").disabled = !VoiceInput.supported();
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
  /** Reproduce las frases en orden; si falta la grabación, la lee la voz del navegador. */
  private async playSeq(lines: Line[]) {
    this.stopAudio();
    const seq = ++this.seq;
    const el = this.player;
    for (const line of lines) {
      el.src = `audio/calls/${line.file}`;
      const recorded = await new Promise<boolean>((resolve) => {
        this.cancelLine = () => resolve(true); // stopAudio() la da por terminada
        el.onended = el.onpause = () => resolve(true);
        el.onerror = () => resolve(false);
        el.play().catch(() => resolve(false));
      });
      if (seq !== this.seq) return; // la cortó otra frase o se colgó la llamada
      if (!recorded) await speak(line.text, line.voice, line.who);
      if (seq !== this.seq) return;
    }
  }

  // Escritorio remoto + banco: el cliente dicta su cuenta, buscas la contraseña en su PC y la vacías.
  // Devuelve si se vació.
  private openBank(call: CallDef): Promise<boolean> {
    const BANK_MS = 60000;
    const code = this.bankCode;
    const acct = $<HTMLInputElement>("b-acct");
    const pass = $<HTMLInputElement>("b-pass");
    const msg = $("b-msg");
    $("bank").classList.remove("hidden");
    $("b-login").classList.remove("hidden");
    $("b-account").classList.add("hidden");
    $("b-dict").textContent = `«${code.slice(0, 4)} ${code.slice(4)}»`;
    $("t-name").textContent = call.customer.split(",")[0];
    acct.value = pass.value = "";
    msg.textContent = "Busca la contraseña en su PC y entra en el banco.";

    // pestañas
    const tab = (which: "pc" | "bank") => {
      $("pc").classList.toggle("hidden", which !== "pc");
      $("bankpane").classList.toggle("hidden", which !== "bank");
      $("t-pc").classList.toggle("on", which === "pc");
      $("t-bank").classList.toggle("on", which === "bank");
      if (which === "bank") window.setTimeout(() => (acct.value ? pass : acct).focus(), 50);
    };
    $("t-pc").onclick = () => tab("pc");
    $("t-bank").onclick = () => tab("bank");
    tab("pc");

    // escritorio de la víctima
    const icons = $("pc-icons");
    icons.innerHTML = "";
    $("pc-file").classList.add("hidden");
    for (const f of call.pc.files) {
      const b = document.createElement("button");
      const ic = document.createElement("span");
      ic.textContent = f.icon;
      b.append(ic, f.name);
      b.onclick = () => {
        b.classList.add("seen");
        $("pc-fname").textContent = `${f.icon} ${f.name}`;
        $("pc-ftext").textContent = f.text;
        $("pc-file").classList.remove("hidden");
      };
      icons.appendChild(b);
    }
    $("pc-close").onclick = () => $("pc-file").classList.add("hidden");

    const norm = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, "");
    return new Promise((resolve) => {
      let tries = 3;
      let done = false;
      const startAt = performance.now();
      const timer = window.setInterval(() => {
        const f = 1 - (performance.now() - startAt) / BANK_MS;
        $("b-timer").style.width = `${Math.max(0, f * 100)}%`;
        if (f <= 0) fail("⏰ Se acabó el tiempo. El cliente ha apagado el ordenador.");
      }, 100);
      const fail = (text: string) => {
        if (done) return;
        done = true;
        clearInterval(timer);
        msg.textContent = text;
        sfx.bad();
        window.setTimeout(() => resolve(false), 1800);
      };
      const shake = (el: HTMLElement) => {
        el.classList.remove("shake");
        void el.offsetWidth;
        el.classList.add("shake");
      };
      const enter = () => {
        if (done) return;
        const okAcct = acct.value.replace(/\D/g, "") === code;
        const okPass = norm(pass.value) === norm(call.pc.password);
        if (okAcct && okPass) {
          clearInterval(timer);
          showAccount();
          return;
        }
        tries--;
        if (!okAcct) shake(acct);
        if (!okPass) shake(pass);
        const what = !okAcct && !okPass ? "Cuenta y contraseña incorrectas" : !okAcct ? "Número de cuenta incorrecto" : "Contraseña incorrecta";
        if (tries <= 0) fail("🚫 Demasiados intentos. El banco ha bloqueado la cuenta.");
        else msg.textContent = `${what}. Te quedan ${tries} intentos.`;
      };
      $("b-enter").onclick = enter;
      acct.onkeydown = (e) => e.key === "Enter" && pass.focus();
      pass.onkeydown = (e) => e.key === "Enter" && enter();
      this.onKey = (e) => {
        if (e.key === "Escape") fail("Has colgado sin vaciar la cuenta.");
      };

      const money = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
      const showAccount = () => {
        sfx.good();
        tab("bank");
        $("b-login").classList.add("hidden");
        $("b-account").classList.remove("hidden");
        $("b-owner").textContent = call.customer;
        const bal = $("b-bal");
        bal.textContent = money(call.bank.balance);
        bal.classList.remove("zero");
        $("b-extra").textContent = call.bank.extra;
        msg.textContent = "";
        const btn = $<HTMLButtonElement>("b-empty");
        btn.disabled = false;
        btn.onclick = () => {
          btn.disabled = true;
          if (call.bank.balance <= 0) return fail("🎥 Era una cuenta trampa. Bob ya está subiendo el vídeo.");
          const t0 = performance.now();
          const anim = window.setInterval(() => {
            const f = Math.min(1, (performance.now() - t0) / 1600);
            bal.textContent = money(call.bank.balance * (1 - f));
            if (Math.random() < 0.3) sfx.ok();
            if (f >= 1) {
              clearInterval(anim);
              bal.classList.add("zero");
              done = true;
              msg.textContent = `💰 Botín: ${money(call.bank.balance)}`;
              sfx.done();
              window.setTimeout(() => resolve(true), 1500);
            }
          }, 60);
        };
      };
    });
  }

  // «Hablar»: escucha una frase y elige la opción que más se parece
  private talkOnce() {
    this.unlockAudio();
    if (this.voice.listening) {
      this.voice.stop();
      this.setTalk(false);
      return;
    }
    this.setTalk(true, "Te escucho… lee la frase que elijas (o di «uno», «dos» o «tres»).");
    this.voice
      .listenOnce((partial) => ($("c-heard").textContent = `«${partial}»`))
      .then((text) => {
        this.setTalk(false);
        this.heard(text);
      })
      .catch((err: Error) => this.setTalk(false, err.message));
  }

  private setTalk(on: boolean, msg?: string) {
    const b = $<HTMLButtonElement>("c-talk");
    b.classList.toggle("on", on);
    b.textContent = on ? "🔴 Escuchando… (toca para parar)" : "🎙️ Hablar";
    if (msg !== undefined) $("c-heard").textContent = msg;
  }

  /** Virus: mientras dure, salen ventanas emergentes que hay que cerrar para poder ver la llamada. */
  setVirus(on: boolean) {
    const mon = document.querySelector<HTMLElement>("#desk .monitor")!;
    if (!on) {
      clearInterval(this.virusTimer);
      this.virusTimer = 0;
      mon.querySelectorAll(".popup").forEach((p) => p.remove());
      return;
    }
    if (this.virusTimer) return;
    const ADS = [
      ["🎉 ¡ENHORABUENA!", "Eres el visitante 1.000.000. Has ganado un iPhone 47."],
      ["⚠️ ALERTA", "Tu PC tiene 37 virus. Llama al 900 000 000 (somos nosotros)."],
      ["💊 OFERTA", "Pastillas para crecer… la cuota. Solo hoy."],
      ["👩 Solteras en tu zona", "Quieren hablar contigo de garantías extendidas."],
      ["🪙 CRIPTO", "Invierte en CallCoin. Sube seguro. Bueno, sube."],
      ["🧹 Limpiador PRO", "Hemos encontrado 4.812 problemas. Pagar para ver."],
    ];
    const spawn = () => {
      if (!this.active || mon.querySelectorAll(".popup").length >= 6) return;
      const [title, text] = ADS[Math.floor(Math.random() * ADS.length)];
      const p = document.createElement("div");
      p.className = "popup";
      p.style.left = `${5 + Math.random() * 55}%`;
      p.style.top = `${10 + Math.random() * 55}%`;
      const bar = document.createElement("div");
      bar.className = "popup-bar";
      const b = document.createElement("b");
      b.textContent = title;
      const x = document.createElement("button");
      x.textContent = "✕";
      x.onclick = () => p.remove();
      bar.append(b, x);
      const body = document.createElement("div");
      body.textContent = text;
      p.append(bar, body);
      mon.appendChild(p);
      sfx.bad();
    };
    spawn();
    this.virusTimer = window.setInterval(spawn, 1800);
  }

  private seq = 0;
  private cancelLine = () => {};

  /** Llamar dentro de un toque o clic: deja el sonido y la voz del navegador listos para después. */
  private unlockAudio() {
    const el = this.player;
    if (el.paused) {
      el.src = SILENT_AUDIO;
      void el.play().catch(() => {});
    }
    try {
      speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    } catch {
      /* sin voz del navegador */
    }
  }

  private stopAudio() {
    this.seq++;
    stopSpeaking();
    this.player.onended = this.player.onpause = this.player.onerror = null;
    this.player.pause();
    this.cancelLine();
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
