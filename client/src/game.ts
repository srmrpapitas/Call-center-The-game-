import * as THREE from "three";
import { buildAvatar, animateAvatar, type Avatar } from "./characters";
import { buildWorld, resolveCollisions, type Box, type DeskSpot } from "./world";
import { Net, type Msg } from "./net";
import { DeskUI } from "./desk";
import { pickCall } from "./calls";
import { BOSS, BOSS_MAX_SECONDS, BOSS_MIN_SECONDS, BOSS_PENALTY, BOSS_WARN_SECONDS, CAST, QUOTA_PER_PLAYER, SHIFT_SECONDS } from "./config";
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
  private team = { score: 0, target: QUOTA_PER_PLAYER, phase: "shift" as "shift" | "over", endAt: 0, win: false };
  private keys = new Set<string>();
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
  private bossAt = 0; // modo solo: cuándo suena el aviso (0 = no hay ronda pendiente)
  private bossArrive = 0; // cuándo llega el jefe (0 = sin aviso activo)
  private bossWalkStart = 0; // >0 mientras recorre la oficina

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const w = buildWorld(this.scene);
    this.colliders = w.colliders;
    this.desks = w.desks;
    this.boss = buildAvatar(BOSS);
    this.boss.group.scale.setScalar(1.12);
    this.boss.group.visible = false;
    this.scene.add(this.boss.group);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.bindInput();
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

  async start(o: StartOpts): Promise<{ online: boolean }> {
    audioCtx(); // se crea tras un gesto del usuario
    const av = buildAvatar(o.skin);
    this.scene.add(av.group);
    const tag = this.makeTag(o.name, true);
    this.me = { id: 0, av, pos: new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 2), ry: 0, moving: false, name: o.name, skin: o.skin, tag };
    this.yaw = 0;
    this.team = { score: 0, target: QUOTA_PER_PLAYER, phase: "shift", endAt: performance.now() + SHIFT_SECONDS * 1000, win: false };

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
      this.scheduleBoss();
    }
    this.running = true;
    this.clock.start();
    $("hud").classList.remove("hidden");
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
        }
        break;
      }
      case "team":
        this.applyTeam(m);
        if (m.by && m.by !== this.me.id) {
          const r = this.others.get(m.by);
          if (r && m.pts > 0) this.toast(`${r.name} suma +${m.pts} de cuota`);
          else if (r && m.pts < 0) this.toast(`El jefe ha pillado a ${r.name} de paseo (${m.pts})`);
        }
        break;
      case "boss":
        this.warnBoss(performance.now() + Number(m.in));
        break;
    }
  }

  private applyTeam(t: Msg) {
    this.team.score = t.score;
    this.team.target = t.target;
    this.team.phase = t.phase;
    this.team.endAt = performance.now() + t.left;
    this.team.win = !!t.win;
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
        this.toast("Colgaste a mitad de llamada");
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
    this.updateBoss(t);
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
      const fwd = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0);
      const right = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
      if (fwd || right) {
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
        const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
        let mx = fx * fwd + rx * right;
        let mz = fz * fwd + rz * right;
        const len = Math.hypot(mx, mz) || 1;
        mx /= len;
        mz /= len;
        const speed = k.has("shift") ? 7.5 : 5;
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
    $("prompt").classList.toggle("hidden", !this.nearDesk);

    // red
    const now = performance.now();
    if (this.online && now - this.lastSend > 70) {
      this.lastSend = now;
      this.net.send({ t: "s", x: +me.pos.x.toFixed(2), z: +me.pos.z.toFixed(2), ry: +me.ry.toFixed(2), m: me.moving });
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
        this.team.phase = "over";
        this.team.win = this.team.score >= this.team.target;
        this.team.endAt = now + 12000;
      } else {
        this.team.phase = "shift";
        this.team.score = 0;
        this.team.win = false;
        this.team.endAt = now + SHIFT_SECONDS * 1000;
        this.scheduleBoss();
      }
    }
  }

  // ---------- el jefe ----------
  private scheduleBoss() {
    const s = BOSS_MIN_SECONDS + Math.random() * (BOSS_MAX_SECONDS - BOSS_MIN_SECONDS);
    this.bossAt = performance.now() + s * 1000;
  }

  private warnBoss(arriveAt: number) {
    if (this.team.phase !== "shift") return;
    this.bossArrive = arriveAt;
    $("boss-alert").classList.remove("hidden");
    sfx.boss();
  }

  private clearBoss() {
    this.bossAt = 0;
    this.bossArrive = 0;
    this.bossWalkStart = 0;
    this.boss.group.visible = false;
    $("boss-alert").classList.add("hidden");
  }

  // Al llegar, quien no esté sentado atendiendo una llamada pierde cuota.
  private inspect() {
    $("boss-alert").classList.add("hidden");
    this.bossWalkStart = performance.now();
    this.boss.group.visible = true;
    if (this.seated) {
      this.toast(`${BOSS.name} pasa por detrás… y asiente. Te has librado.`);
      return;
    }
    sfx.bad();
    this.toast(`¡${BOSS.name} te ha pillado de paseo! −${BOSS_PENALTY} de cuota`);
    if (this.online) this.net.send({ t: "caught" });
    else this.team.score = Math.max(0, this.team.score - BOSS_PENALTY);
  }

  private updateBoss(t: number) {
    const now = performance.now();
    if (!this.online && this.bossAt && now >= this.bossAt) {
      this.bossAt = 0;
      this.warnBoss(now + BOSS_WARN_SECONDS * 1000);
    }
    if (this.bossArrive) {
      const left = Math.ceil((this.bossArrive - now) / 1000);
      if (left > 0) {
        $("boss-alert").textContent = `🚨 ¡Viene ${BOSS.name}! Siéntate en un puesto: ${left} s`;
      } else {
        this.bossArrive = 0;
        this.inspect();
      }
    }
    if (!this.bossWalkStart) return;
    // avanzar por el recorrido según la distancia andada
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

    if (this.team.phase !== this.lastPhase) {
      this.lastPhase = this.team.phase;
      const end = $("end");
      if (this.team.phase === "over") {
        this.clearBoss();
        end.classList.remove("hidden");
        $("end-title").textContent = this.team.win ? "¡Cuota cumplida!" : "Revisión del jefe: estáis despedidos";
        $("end-text").textContent = this.team.win
          ? "El jefe os felicita con un correo automático y una pizza de ayer."
          : "El jefe lamenta comunicaros que ‘el equipo no ha estado a la altura’. Siguiente turno en unos segundos.";
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
