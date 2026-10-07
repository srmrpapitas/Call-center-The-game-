// Cliente de red: WebSocket contra el Worker. Si no hay servidor, el juego funciona en modo solo.
export type Msg = Record<string, any>;

function serverBase(): string | null {
  const env = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();
  if (env) return env.replace(/\/$/, "").replace(/^http/, "ws");
  if (location.protocol === "http:" || location.protocol === "https:") {
    return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
  }
  return null; // p. ej. tauri:// sin servidor configurado
}

export class Net {
  private ws: WebSocket | null = null;
  onMessage: (m: Msg) => void = () => {};
  onClose: () => void = () => {};

  connect(code: string): Promise<boolean> {
    const base = serverBase();
    if (!base) return Promise.resolve(false);
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };
      let ws: WebSocket;
      try {
        ws = new WebSocket(`${base}/ws/${encodeURIComponent(code)}`);
      } catch {
        return done(false);
      }
      this.ws = ws;
      const timer = setTimeout(() => {
        ws.close();
        done(false);
      }, 5000);
      ws.onopen = () => {
        clearTimeout(timer);
        done(true);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        done(false);
      };
      ws.onmessage = (ev) => {
        try {
          this.onMessage(JSON.parse(ev.data as string));
        } catch {
          /* mensaje inválido */
        }
      };
      ws.onclose = () => {
        done(false);
        this.onClose();
      };
    });
  }

  send(m: Msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
