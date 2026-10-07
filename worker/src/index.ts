// Servidor del juego: un Worker que enruta WebSockets a un Durable Object por sala.
// Cada sala (código de 3 a 8 letras/números) admite hasta MAX_PLAYERS jugadores.
import { EVENTS, SHIFT_MS, scheduleShift, targetFor, type EventKind } from "../../client/src/events";

export interface Env {
  ROOMS: DurableObjectNamespace;
}

const MAX_PLAYERS = 4;
const OVER_MS = 15_000; // pausa entre turnos

type Player = {
  id: number;
  name: string;
  skin: number;
  x: number;
  z: number;
  ry: number;
  m: boolean;
  c: boolean; // hablando por teléfono
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/ws\/([A-Za-z0-9]{3,8})$/);
    if (m) {
      if (req.headers.get("Upgrade") !== "websocket") {
        return new Response("Se esperaba un WebSocket", { status: 426 });
      }
      const id = env.ROOMS.idFromName(m[1].toUpperCase());
      return env.ROOMS.get(id).fetch(req);
    }
    if (url.pathname === "/health") return new Response("ok");
    return new Response("No encontrado", { status: 404 });
  },
};

export class Room implements DurableObject {
  private players = new Map<WebSocket, Player>();
  private nextId = 1;
  private score = 0;
  private phase: "shift" | "over" = "shift";
  private phaseEnd = 0;
  private day = 1;
  private events: { kind: EventKind; at: number }[] = []; // desastres pendientes del turno (hora absoluta)
  private arrive = new Map<EventKind, number>(); // cuándo llegó el jefe o la policía
  private caught = new Set<string>(); // "evento:jugador" ya penalizados

  constructor(private state: DurableObjectState, _env: Env) {}

  async fetch(_req: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    if (this.players.size >= MAX_PLAYERS) {
      server.send(JSON.stringify({ t: "full" }));
      server.close(1000, "full");
      return new Response(null, { status: 101, webSocket: client });
    }

    server.addEventListener("message", (ev) => this.onMessage(server, ev));
    const leave = () => this.onLeave(server);
    server.addEventListener("close", leave);
    server.addEventListener("error", leave);
    return new Response(null, { status: 101, webSocket: client });
  }

  private target(): number {
    return targetFor(this.day, this.players.size);
  }

  private teamMsg() {
    return {
      t: "team",
      score: this.score,
      target: this.target(),
      phase: this.phase,
      day: this.day,
      left: Math.max(0, this.phaseEnd - Date.now()),
    };
  }

  private broadcast(msg: unknown, except?: WebSocket) {
    const data = JSON.stringify(msg);
    for (const ws of this.players.keys()) {
      if (ws !== except) {
        try {
          ws.send(data);
        } catch {
          /* socket cerrado */
        }
      }
    }
  }

  private async onMessage(ws: WebSocket, ev: MessageEvent) {
    if (typeof ev.data !== "string" || ev.data.length > 512) return;
    let msg: any;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    const p = this.players.get(ws);

    if (msg.t === "join" && !p) {
      const first = this.players.size === 0;
      if (first) await this.startShift();
      const np: Player = {
        id: this.nextId++,
        name: String(msg.name ?? "Empleado").slice(0, 14) || "Empleado",
        skin: Math.max(0, Math.min(15, Number(msg.skin) | 0)),
        x: 0,
        z: 0,
        ry: 0,
        m: false,
        c: false,
      };
      this.players.set(ws, np);
      ws.send(
        JSON.stringify({
          t: "welcome",
          id: np.id,
          players: [...this.players.values()].filter((o) => o.id !== np.id),
          team: this.teamMsg(),
        }),
      );
      this.broadcast({ t: "join", p: np }, ws);
      this.broadcast(this.teamMsg());
      return;
    }

    if (!p) return;

    if (msg.t === "s") {
      const x = Number(msg.x);
      const z = Number(msg.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      p.x = Math.max(-30, Math.min(30, x));
      p.z = Math.max(-30, Math.min(30, z));
      p.ry = Number(msg.ry) || 0;
      p.m = !!msg.m;
      p.c = !!msg.c;
      this.broadcast({ t: "s", id: p.id, x: p.x, z: p.z, ry: p.ry, m: p.m, c: p.c }, ws);
    } else if (msg.t === "call" && this.phase === "shift") {
      const pts = Math.max(0, Math.min(9, Number(msg.pts) | 0));
      this.score += pts;
      this.broadcast({ ...this.teamMsg(), by: p.id, pts });
    } else if (msg.t === "caught" && this.phase === "shift") {
      // cada cliente comprueba si su jugador estaba sentado o al teléfono; aquí se valida la ventana
      const kind: EventKind = msg.kind === "police" ? "police" : "boss";
      const at = this.arrive.get(kind);
      const now = Date.now();
      if (!at || now < at - 2000 || now > at + 5000) return;
      const key = `${kind}:${p.id}`;
      if (this.caught.has(key)) return;
      this.caught.add(key);
      const pen = EVENTS[kind].penalty;
      this.score = Math.max(0, this.score - pen);
      this.broadcast({ ...this.teamMsg(), by: p.id, pts: -pen, kind });
    }
  }

  private onLeave(ws: WebSocket) {
    const p = this.players.get(ws);
    if (!p) return;
    this.players.delete(ws);
    this.broadcast({ t: "leave", id: p.id });
    if (this.players.size === 0) {
      this.score = 0;
      this.day = 1;
      this.state.storage.deleteAlarm();
    } else {
      this.broadcast(this.teamMsg());
    }
  }

  private async startShift() {
    const now = Date.now();
    this.phase = "shift";
    this.score = 0;
    this.phaseEnd = now + SHIFT_MS;
    this.events = scheduleShift(this.day).map((e) => ({ kind: e.kind, at: now + e.at }));
    this.arrive.clear();
    this.caught.clear();
    await this.state.storage.setAlarm(this.nextAlarm());
  }

  private nextAlarm(): number {
    return Math.min(this.events[0]?.at ?? Infinity, this.phaseEnd);
  }

  async alarm() {
    if (this.players.size === 0) return;
    const now = Date.now();
    if (this.phase === "shift") {
      // desastres que tocan ahora
      while (this.events.length && this.events[0].at <= now + 50 && now < this.phaseEnd) {
        const { kind } = this.events.shift()!;
        const { warnMs } = EVENTS[kind];
        this.arrive.set(kind, now + warnMs);
        for (const k of this.caught) if (k.startsWith(`${kind}:`)) this.caught.delete(k); // nueva visita, nuevas multas
        this.broadcast({ t: "event", kind, in: warnMs });
      }
      if (now < this.phaseEnd - 50) {
        await this.state.storage.setAlarm(this.nextAlarm());
        return;
      }
      // fin del turno: día siguiente o despido
      const win = this.score >= this.target();
      this.phase = "over";
      this.events = [];
      this.day = win ? this.day + 1 : 1;
      this.phaseEnd = now + OVER_MS;
      await this.state.storage.setAlarm(this.phaseEnd);
      this.broadcast({ ...this.teamMsg(), win });
    } else {
      await this.startShift();
      this.broadcast(this.teamMsg());
    }
  }
}
