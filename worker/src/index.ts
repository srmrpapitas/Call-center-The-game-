// Servidor del juego: un Worker que enruta WebSockets a un Durable Object por sala.
// Cada sala (código de 3 a 8 letras/números) admite hasta MAX_PLAYERS jugadores.

export interface Env {
  ROOMS: DurableObjectNamespace;
}

const MAX_PLAYERS = 4;
const SHIFT_MS = 240_000; // duración del turno
const OVER_MS = 15_000; // pausa entre turnos
const QUOTA_PER_PLAYER = 30;

type Player = {
  id: number;
  name: string;
  skin: number;
  x: number;
  z: number;
  ry: number;
  m: boolean;
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
    return QUOTA_PER_PLAYER * Math.max(1, this.players.size);
  }

  private teamMsg() {
    return {
      t: "team",
      score: this.score,
      target: this.target(),
      phase: this.phase,
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
      this.broadcast({ t: "s", id: p.id, x: p.x, z: p.z, ry: p.ry, m: p.m }, ws);
    } else if (msg.t === "call" && this.phase === "shift") {
      const pts = Math.max(0, Math.min(9, Number(msg.pts) | 0));
      this.score += pts;
      this.broadcast({ ...this.teamMsg(), by: p.id, pts });
    }
  }

  private onLeave(ws: WebSocket) {
    const p = this.players.get(ws);
    if (!p) return;
    this.players.delete(ws);
    this.broadcast({ t: "leave", id: p.id });
    if (this.players.size === 0) {
      this.score = 0;
      this.state.storage.deleteAlarm();
    } else {
      this.broadcast(this.teamMsg());
    }
  }

  private async startShift() {
    this.phase = "shift";
    this.score = 0;
    this.phaseEnd = Date.now() + SHIFT_MS;
    await this.state.storage.setAlarm(this.phaseEnd);
  }

  async alarm() {
    if (this.players.size === 0) return;
    if (this.phase === "shift") {
      this.phase = "over";
      this.phaseEnd = Date.now() + OVER_MS;
      await this.state.storage.setAlarm(this.phaseEnd);
      this.broadcast({ ...this.teamMsg(), win: this.score >= this.target() });
    } else {
      await this.startShift();
      this.broadcast(this.teamMsg());
    }
  }
}
