import * as THREE from "three";
import { buildAvatar, animateAvatar, type Avatar } from "./characters";
import { buildWorld, resolveCollisions, type Box, type DeskSpot } from "./world";
import { Net, type Msg } from "./net";
import { DeskUI } from "./desk";
import { pickCall } from "./calls";
import { BOSS, CAST } from "./config";
import { EVENTS, SHIFT_MS, scheduleShift, targetFor, type EventKind } from "./events";
import { sfx, audioCtx } from "./audio";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// Ronda del jefe: sale de su despacho, baja al pasillo central y lo recorre entero.
const BOSS_PATH = [new THREE.Vector2(7.5, -6.6), new THREE.Vector2(7.5, 0), new THREE.Vector2(-11.5, 0)];
const BOSS_SPEED = 3; // m/s

interface Remote {
  id: number;
  name: string;
  av: Avatar;
  tag: HTMLElement;
  tx: number;
  tz: number;
  try_: number;
  moving: boolean;
}

export interface StartOpts {
  name: string;
  skin: number;
  code: string | null; // null = modo solo
}

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  private colliders: Box[] = [];
  private desks: DeskSpot[] = [];
  private me!: { id: number; av: Avatar; pos: THREE.Vector3; ry: number; moving: boolean; name: string; skin: number; tag: HTMLElement };
  private others = new Map<number, Remote>();
  private net = new Net();
  private online = false;
  private team = { score: 0, target: targetFor(1, 1), phase: "shift" as "shift" | "over", endAt: 0, win: false, day: 1 };
  private keys = new Set<string>();
  private stick = { x: 0, y: 0 }; // joystick táctil (-1..1)
  private run = false; // botón táctil de correr
  private yaw = 0;
  private pitch = 0.5;
  private dist = 7.5;
  private ui = new DeskUI();
  private seated: DeskSpot | null = null;
  private seatBlend = 0;
  private nearDesk: DeskSpot | null = null;
  private lastCall: string | undefined;
  private lastSend = 0;
  private clock = new THREE.Clock();
  private running = false;
  private lastPhase = "";
  private toastTimer = 0;
  private boss: Avatar;
  private bossWalkStart = 0; // >0 mientras el jefe recorre la oficina
  private lights!: ReturnType<typeof buildWorld>["lights"];
  // desastres del turno (ver events.ts)
  private pending: { kind: EventKind; at: number }[] = []; // modo solo: los que faltan (hora absoluta)
  private warning: { kind: "boss" | "police"; arriveAt: number } | null = null;
  private virusUntil = 0;
  private blackoutUntil = 0;
  private policeUntil = 0; // luces de la policía en la oficina

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const w = buildWorld(this.scene);
    this.colliders = w.colliders;
    this.desks = w.desks;
    this.lights = w.lights;
    this.boss = buildAvatar(BOSS);
    this.boss.group.scale.setScalar(1.12);
    this.boss.group.visible = false;
    this.scene.add(this.boss.group);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.bindInput();
    this.ui.onTalk = (on) => {
      if (this.me) this.me.av.talking = on;
    };
    // fondo del menú: cámara girando suavemente
    this.camera.position.set(0, 7, 14);
    this.camera.lookAt(0, 1, 0);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private bindInput() {
    window.addEventListener("keydown", (e) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (this.ui.handleKey(e)) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k === "e" && this.running) this.trySit();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    $("prompt").addEventListener("click", () => this.running && this.trySit());
    this.bindTouch();
    window.addEventListener("blur", () => this.keys.clear());
    let drag = false;
    this.canvas.addEventListener("mousedown", () => (drag = true));
    window.addEventListener("mouseup", () => (drag = false));
    window.addEventListener("mousemove", (e) => {
      if (!drag || this.seated) return;
      this.yaw -= e.movementX * 0.005;
      this.pitch = Math.max(0.15, Math.min(1.2, this.pitch + e.movementY * 0.004));
    });
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        this.dist = Math.max(4, Math.min(12, this.dist + e.deltaY * 0.005));
      },
      { passive: true },
    );
  }

  // Móvil y tableta: joystick para andar, arrastrar el dedo para girar la cámara, botón de correr.
  private bindTouch() {
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!touch) return;
    document.body.classList.add("touch");
    const stick = $("stick");
    const knob = stick.querySelector("i") as HTMLElement;
    let stickId: number | null = null;
    const moveStick = (x: number, y: number) => {
      const r = stick.getBoundingClientRect();
      let dx = (x - (r.left + r.width / 2)) / (r.width / 2);
      let dy = (y - (r.top + r.height / 2)) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      this.stick = { x: dx, y: dy };
      knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
    };
    const resetStick = () => {
      stickId = null;
      this.stick = { x: 0, y: 0 };
      knob.style.transform = "";
    };
    stick.addEventListener("pointerdown", (e) => {
      stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      moveStick(e.clientX, e.clientY);
    });
    stick.addEventListener("pointermove", (e) => e.pointerId === stickId && moveStick(e.clientX, e.clientY));
    stick.addEventListener("pointerup", resetStick);
    stick.addEventListener("pointercancel", resetStick);

    const runBtn = $("run-btn");
    runBtn.addEventListener("pointerdown", () => {
      this.run = !this.run;
      runBtn.classList.toggle("on", this.run);
    });

    // cámara: arrastrar con un dedo fuera del joystick
    const last = new Map<number, { x: number; y: number }>();
    this.canvas.addEventListener("touchstart", (e) => {
      for (const t of e.changedTouches) last.set(t.identifier, { x: t.clientX, y: t.clientY });
    }, { passive: true });
    this.canvas.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        const p = last.get(t.identifier);
        if (!p || this.seated) continue;
        this.yaw -= (t.clientX - p.x) * 0.008;
        this.pitch = Math.max(0.15, Math.min(1.2, this.pitch + (t.clientY - p.y) * 0.006));
        last.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }, { passive: true });
    const end = (e: TouchEvent) => {
      for (const t of e.changedTouches) last.delete(t.identifier);
    };
    this.canvas.addEventListener("touchend", end);
    this.canvas.addEventListener("touchcancel", end);
  }

  async start(o: StartOpts): Promise<{ online: boolean }> {
    (document.activeElement as HTMLElement | null)?.blur(); // que las teclas no se queden en el campo del nombre
    audioCtx(); // se crea tras un gesto del usuario
    const av = buildAvatar(o.skin);
    this.scene.add(av.group);
    const tag = this.makeTag(o.name, true);
    this.me = { id: 0, av, pos: new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 2), ry: 0, moving: false, name: o.name, skin: o.skin, tag };
    this.yaw = 0;
    this.team = { score: 0, target: targetFor(1, 1), phase: "shift", endAt: performance.now() + SHIFT_MS, win: false, day: 1 };

    if (o.code) {
      this.net.onMessage = (m) => this.onNet(m);
      this.net.onClose = () => {
        if (this.online) {
          this.online = false;
          this.toast("Conexión perdida: sigues en modo solo");
          $("h-room").textContent = "Solo";
        }
      };
      const ok = await this.net.connect(o.code);
      if (ok) {
        this.online = true;
        this.net.send({ t: "join", name: o.name, skin: o.skin });
        $("h-room").textContent = `Sala ${o.code}`;
      }
    }
    if (!this.online) {
      $("h-room").textContent = "Solo";
      this.scheduleShift();
    }
    this.running = true;
    this.clock.start();
    $("hud").classList.remove("hidden");
    $("stick").classList.remove("hidden");
    $("run-btn").classList.remove("hidden");
    this.updatePlayers();
    return { online: this.online };
  }

  // ---------- red ----------
  private onNet(m: Msg) {
    switch (m.t) {
      case "full":
        this.toast("La sala está llena");
        break;
      case "welcome":
        this.me.id = m.id;
        for (const p of m.players as any[]) this.addRemote(p);
        this.applyTeam(m.team);
        break;
      case "join":
        this.addRemote(m.p);
        this.toast(`${m.p.name} se ha incorporado al turno`);
        break;
      case "leave": {
        const r = this.others.get(m.id);
        if (r) {
          this.scene.remove(r.av.group);
          r.tag.remove();
          this.others.delete(m.id);
          this.updatePlayers();
        }
        break;
      }
      case "s": {
        const r = this.others.get(m.id);
        if (r) {
          r.tx = m.x;
          r.tz = m.z;
          r.try_ = m.ry;
          r.moving = !!m.m;
          r.av.talking = !!m.c;
        }
        break;
      }
      case "team":
        this.applyTeam(m);
        if (m.by && m.by !== this.me.id) {
          const r = this.others.get(m.by);
          if (r && m.pts > 0) this.toast(`${r.name} suma +${m.pts} de cuota`);
          else if (r && m.pts < 0)
            this.toast(m.kind === "police" ? `🚔 La policía ha pillado a ${r.name} al teléfono (${m.pts})` : `El jefe ha pillado a ${r.name} de paseo (${m.pts})`);
        }
        break;
      case "event":
        if (m.kind in EVENTS) this.startEvent(m.kind as EventKind, Number(m.in) || 0);
        break;
    }
  }

  private applyTeam(t: Msg) {
    this.team.score = t.score;
    this.team.target = t.target;
    this.team.phase = t.phase;
    this.team.endAt = performance.now() + t.left;
    this.team.win = !!t.win;
    if (t.day) this.team.day = t.day;
  }

  private addRemote(p: any) {
    const av = buildAvatar(p.skin);
    av.group.position.set(p.x, 0, p.z);
    this.scene.add(av.group);
    this.others.set(p.id, { id: p.id, name: p.name, av, tag: this.makeTag(p.name, false), tx: p.x, tz: p.z, try_: p.ry, moving: false });
    this.updatePlayers();
  }

  private updatePlayers() {
    $("h-players").textContent = `👥 ${this.others.size + 1}`;
  }

  // ---------- interacción ----------
  private trySit() {
    if (this.seated || !this.nearDesk || this.team.phase !== "shift") return;
    if (performance.now() < this.blackoutUntil) return this.toast("🔌 Sin luz no hay llamadas. Espera a que vuelva.");
    const d = this.nearDesk;
    this.seated = d;
    this.me.pos.copy(d.seat);
    this.me.ry = d.ry;
    this.me.moving = false;
    this.seatBlend = 0;
    $("prompt").classList.add("hidden");
    const call = pickCall(this.lastCall);
    this.lastCall = call.id;
    void this.ui.run(call, this.me.skin).then((pts) => {
      if (pts !== null) {
        this.team.score += this.online ? 0 : pts; // en línea lo confirma el servidor
        if (this.online) this.net.send({ t: "call", pts });
        this.toast(pts >= 5 ? `+${pts} de cuota` : pts > 0 ? `+${pts} de cuota (flojo)` : "0 de cuota");
      } else {
        const now = performance.now();
        if (now < this.blackoutUntil) this.toast("🔌 ¡Apagón! Se ha cortado la llamada");
        else if (now >= this.policeUntil) this.toast("Colgaste a mitad de llamada"); // la redada ya avisa
      }
      this.seated = null;
    });
  }

  private toast(text: string) {
    const t = $("toast");
    t.textContent = text;
    t.classList.remove("hidden");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.add("hidden"), 2800);
  }

  private makeTag(name: string, me: boolean): HTMLElement {
    const el = document.createElement("div");
    el.className = "tag" + (me ? " me" : "");
    el.textContent = name;
    $("labels").appendChild(el);
    return el;
  }

  // ---------- bucle ----------
  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    if (!this.running) {
      const a = t * 0.12;
      this.camera.position.set(Math.sin(a) * 15, 7, Math.cos(a) * 15);
      this.camera.lookAt(0, 1.2, 0);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.updateMe(dt, t);
    this.updateOthers(dt, t);
    this.updateTeam();
    this.updateEvents(t);
    this.updateCamera(dt);
    this.updateHud();
    this.updateTags();
    this.updateLeds(t);
    this.renderer.render(this.scene, this.camera);
  }

  private updateMe(dt: number, t: number) {
    const me = this.me;
    me.moving = false;
    if (!this.seated) {
      const k = this.keys;
      const fwd = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0) - this.stick.y;
      const right = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0) + this.stick.x;
      if (Math.hypot(fwd, right) > 0.15) {
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
        const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
        let mx = fx * fwd + rx * right;
        let mz = fz * fwd + rz * right;
        const len = Math.hypot(mx, mz) || 1;
        mx /= len;
        mz /= len;
        const push = Math.min(1, Math.hypot(fwd, right)); // el joystick a medias anda más despacio
        const speed = (k.has("shift") || this.run ? 7.5 : 5) * push;
        me.pos.x += mx * speed * dt;
        me.pos.z += mz * speed * dt;
        resolveCollisions(me.pos, 0.4, this.colliders);
        const target = Math.atan2(mx, mz);
        let diff = target - me.ry;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        me.ry += diff * Math.min(1, dt * 14);
        me.moving = true;
      }
    }
    me.av.group.position.copy(me.pos);
    me.av.group.rotation.y = me.ry;
    animateAvatar(me.av, t, me.moving);

    // escritorio cercano
    this.nearDesk = null;
    if (!this.seated && this.team.phase === "shift") {
      let best = 1.5;
      for (const d of this.desks) {
        const dist = Math.hypot(d.seat.x - me.pos.x, d.seat.z - me.pos.z);
        if (dist < best) {
          best = dist;
          this.nearDesk = d;
        }
      }
    }
    $("prompt").classList.toggle("hidden", !this.nearDesk || performance.now() < this.blackoutUntil);

    // red
    const now = performance.now();
    if (this.online && now - this.lastSend > 70) {
      this.lastSend = now;
      this.net.send({ t: "s", x: +me.pos.x.toFixed(2), z: +me.pos.z.toFixed(2), ry: +me.ry.toFixed(2), m: me.moving, c: me.av.talking });
    }
  }

  private updateOthers(dt: number, t: number) {
    for (const r of this.others.values()) {
      const g = r.av.group;
      g.position.x += (r.tx - g.position.x) * Math.min(1, dt * 12);
      g.position.z += (r.tz - g.position.z) * Math.min(1, dt * 12);
      let diff = r.try_ - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, dt * 12);
      animateAvatar(r.av, t + r.id, r.moving);
    }
  }

  private updateTeam() {
    if (this.online) return;
    const now = performance.now();
    if (now >= this.team.endAt) {
      if (this.team.phase === "shift") {
        // fin del día: día siguiente con más cuota, o despido y vuelta al día 1
        this.team.phase = "over";
        this.team.win = this.team.score >= this.team.target;
        this.team.day = this.team.win ? this.team.day + 1 : 1;
        this.team.endAt = now + 12000;
      } else {
        this.team.phase = "shift";
        this.team.score = 0;
        this.team.win = false;
        this.team.target = targetFor(this.team.day, 1);
        this.team.endAt = now + SHIFT_MS;
        this.scheduleShift();
      }
    }
  }

  // ---------- desastres: jefe, redada, virus y apagón ----------
  private scheduleShift() {
    const now = performance.now();
    this.pending = scheduleShift(this.team.day).map((e) => ({ kind: e.kind, at: now + e.at }));
  }

  private startEvent(kind: EventKind, warnMs: number) {
    if (this.team.phase !== "shift") return;
    const now = performance.now();
    if (kind === "boss" || kind === "police") {
      this.warning = { kind, arriveAt: now + warnMs };
      const alert = $("boss-alert");
      alert.classList.remove("hidden");
      alert.classList.toggle("police", kind === "police");
      kind === "police" ? sfx.siren() : sfx.boss();
    } else if (kind === "virus") {
      this.virusUntil = now + EVENTS.virus.durMs;
      this.toast("🦠 ¡Virus en la red! Cierra las ventanas emergentes para seguir llamando");
      sfx.bad();
    } else {
      this.blackoutUntil = now + EVENTS.blackout.durMs;
      this.toast("🔌 ¡Apagón! Se cortan todas las llamadas");
      sfx.powerDown();
      if (this.seated) this.ui.abort();
    }
  }

  private clearEvents() {
    this.pending = [];
    this.warning = null;
    this.virusUntil = this.blackoutUntil = this.policeUntil = 0;
    this.bossWalkStart = 0;
    this.boss.group.visible = false;
    $("boss-alert").classList.add("hidden");
  }

  // El jefe pilla a quien NO está sentado; la policía, a quien SÍ está al teléfono.
  private arrive(kind: "boss" | "police") {
    $("boss-alert").classList.add("hidden");
    const now = performance.now();
    const pen = EVENTS[kind].penalty;
    let caught: boolean;
    if (kind === "boss") {
      this.bossWalkStart = now;
      this.boss.group.visible = true;
      caught = !this.seated;
      this.toast(caught ? `¡${BOSS.name} te ha pillado de paseo! −${pen} de cuota` : `${BOSS.name} pasa por detrás… y asiente. Te has librado.`);
    } else {
      this.policeUntil = now + 5000;
      caught = !!this.seated;
      if (caught) this.ui.abort();
      this.toast(caught ? `🚔 ¡La policía te ha pillado al teléfono! −${pen} de cuota` : "🚔 La policía registra la oficina… y no encuentra nada. De momento.");
    }
    if (!caught) return;
    sfx.bad();
    if (this.online) this.net.send({ t: "caught", kind });
    else this.team.score = Math.max(0, this.team.score - pen);
  }

  private updateEvents(t: number) {
    const now = performance.now();
    while (!this.online && this.pending.length && now >= this.pending[0].at) {
      const { kind } = this.pending.shift()!;
      this.startEvent(kind, EVENTS[kind].warnMs);
    }
    if (this.warning) {
      const left = Math.ceil((this.warning.arriveAt - now) / 1000);
      if (left > 0) {
        $("boss-alert").textContent =
          this.warning.kind === "boss"
            ? `🚨 ¡Viene ${BOSS.name}! Siéntate en un puesto: ${left} s`
            : `🚔 ¡REDADA! Cuelga y aléjate de los teléfonos: ${left} s`;
      } else {
        const kind = this.warning.kind;
        this.warning = null;
        this.arrive(kind);
      }
    }
    this.ui.setVirus(now < this.virusUntil);

    // luces: apagón, sirenas de la policía o normal
    const dark = now < this.blackoutUntil;
    const siren = now < this.policeUntil || this.warning?.kind === "police";
    const L = this.lights;
    L.hemi.intensity = dark ? 0.12 : 1.05;
    L.sun.intensity = dark ? 0.03 : 0.8;
    L.ceiling.emissive.setHex(dark ? 0x000000 : 0xfff6d6);
    L.hemi.color.setHex(siren ? (Math.sin(t * 12) > 0 ? 0xff3b3b : 0x3b5bff) : 0xdfe8ff);

    // el jefe recorre la oficina
    if (!this.bossWalkStart) return;
    let d = ((now - this.bossWalkStart) / 1000) * BOSS_SPEED;
    const g = this.boss.group;
    for (let i = 1; i < BOSS_PATH.length; i++) {
      const a = BOSS_PATH[i - 1];
      const b = BOSS_PATH[i];
      const len = a.distanceTo(b);
      if (d <= len) {
        const f = d / len;
        g.position.set(a.x + (b.x - a.x) * f, 0, a.y + (b.y - a.y) * f);
        g.rotation.y = Math.atan2(b.x - a.x, b.y - a.y);
        animateAvatar(this.boss, t, true);
        return;
      }
      d -= len;
    }
    this.bossWalkStart = 0;
    g.visible = false;
  }

  private updateCamera(dt: number) {
    const head = new THREE.Vector3(this.me.pos.x, 1.7, this.me.pos.z);
    const cp = Math.cos(this.pitch);
    const free = new THREE.Vector3(
      head.x + Math.sin(this.yaw) * cp * this.dist,
      head.y + Math.sin(this.pitch) * this.dist,
      head.z + Math.cos(this.yaw) * cp * this.dist,
    );
    // mantener la cámara dentro de la sala
    free.x = Math.max(-12.4, Math.min(12.4, free.x));
    free.z = Math.max(-9, Math.min(9, free.z));
    free.y = Math.min(3.6, free.y);
    const goal = this.seated ? 1 : 0;
    this.seatBlend += (goal - this.seatBlend) * Math.min(1, dt * 3);
    const b = this.seatBlend;
    if (this.seated) {
      this.camera.position.lerpVectors(free, this.seated.cam, b);
      const look = new THREE.Vector3().lerpVectors(head, this.seated.look, b);
      this.camera.lookAt(look);
    } else if (b > 0.01) {
      // levantándose: vuelve suavemente
      this.camera.position.lerp(free, Math.min(1, dt * 5));
      this.camera.lookAt(head);
    } else {
      this.camera.position.lerp(free, Math.min(1, dt * 10));
      this.camera.lookAt(head);
    }
  }

  private updateHud() {
    const left = Math.max(0, Math.ceil((this.team.endAt - performance.now()) / 1000));
    const m = Math.floor(left / 60);
    const s = String(left % 60).padStart(2, "0");
    $("h-time").textContent = this.team.phase === "shift" ? `${m}:${s}` : "—";
    const pct = Math.min(100, (this.team.score / this.team.target) * 100);
    $("h-bar").style.width = `${pct}%`;
    $("h-bar").classList.toggle("done", this.team.score >= this.team.target);
    $("h-score").textContent = `Cuota ${this.team.score}/${this.team.target}`;
    $("h-day").textContent = `📅 Día ${this.team.phase === "over" && this.team.win ? this.team.day - 1 : this.team.day}`;

    if (this.team.phase !== this.lastPhase) {
      this.lastPhase = this.team.phase;
      const end = $("end");
      if (this.team.phase === "over") {
        this.clearEvents();
        if (this.seated) this.ui.abort();
        end.classList.remove("hidden");
        const done = this.team.day - 1;
        $("end-title").textContent = this.team.win ? `¡Día ${done} superado!` : "Revisión del jefe: estáis despedidos";
        $("end-text").textContent = this.team.win
          ? `El jefe os felicita con un correo automático y una pizza de ayer. Mañana, día ${this.team.day}: más cuota y más caos.`
          : "El jefe lamenta comunicaros que «el equipo no ha estado a la altura». Vuelta al día 1 con contratos nuevos (los mismos).";
        this.team.win ? sfx.done() : sfx.over();
      } else {
        end.classList.add("hidden");
        if (this.running) this.toast("Nuevo turno. ¡A vender!");
      }
    }
  }

  private updateTags() {
    const v = new THREE.Vector3();
    const place = (el: HTMLElement, p: THREE.Vector3) => {
      v.set(p.x, 2.9, p.z).project(this.camera);
      const vis = v.z < 1;
      el.style.display = vis ? "block" : "none";
      el.style.transform = `translate(-50%,-100%) translate(${((v.x + 1) / 2) * window.innerWidth}px, ${((1 - v.y) / 2) * window.innerHeight}px)`;
    };
    place(this.me.tag, this.me.pos);
    for (const r of this.others.values()) place(r.tag, r.av.group.position);
  }

  private updateLeds(t: number) {
    for (const d of this.desks) {
      const mat = d.led.material as THREE.MeshLambertMaterial;
      const free = this.team.phase === "shift" && d !== this.seated;
      const on = free && Math.sin(t * 6 + d.id) > 0;
      mat.emissive.setHex(on ? 0xff2a2a : free ? 0x113311 : 0x000000);
      mat.color.setHex(on ? 0xff4444 : 0x33dd66);
    }
  }
}

export { CAST };
