// Días y desastres. Lo usan el juego (modo solo) y el servidor (salas online), así que no toca el DOM.
//
// Cada turno es un día. Con la cuota cumplida se pasa al siguiente (más cuota y más caos); si no,
// despiden al equipo y se vuelve al día 1. El jefe pasa dos veces al día; desde el día 2 se suma
// un desastre más por día (hasta 3): redada, virus o apagón.

export type EventKind = "boss" | "police" | "virus" | "blackout";

export const EVENTS: Record<EventKind, { warnMs: number; durMs: number; penalty: number }> = {
  boss: { warnMs: 8000, durMs: 0, penalty: 5 }, // pilla a quien NO esté sentado en un puesto
  police: { warnMs: 8000, durMs: 0, penalty: 8 }, // pilla a quien SÍ esté al teléfono
  virus: { warnMs: 0, durMs: 20000, penalty: 0 }, // ventanas emergentes en el escritorio
  blackout: { warnMs: 0, durMs: 15000, penalty: 0 }, // sin luz: se cortan las llamadas
};

export const SHIFT_MS = 600_000; // 10 minutos por día
export const QUOTA_PER_PLAYER = 20;

/** Cuota del día: +25 % por cada día superado. */
export function targetFor(day: number, players: number): number {
  return Math.round(QUOTA_PER_PLAYER * Math.max(1, players) * (1 + 0.25 * (day - 1)));
}

/** Desastres del turno, con el momento (ms desde que empieza) en que avisan. */
export function scheduleShift(day: number, rand: () => number = Math.random): { kind: EventKind; at: number }[] {
  const kinds: EventKind[] = ["boss", "boss"];
  const pool: EventKind[] = ["police", "virus", "blackout"];
  for (let i = 0; i < Math.min(day - 1, 3); i++) kinds.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  const out: { kind: EventKind; at: number }[] = [];
  for (const kind of kinds) {
    // desde el segundo 30 hasta 30 s antes del final, separados al menos 40 s entre sí
    for (let tries = 0; tries < 50; tries++) {
      const at = 30_000 + rand() * (SHIFT_MS - 60_000);
      if (out.every((e) => Math.abs(e.at - at) >= 40_000)) {
        out.push({ kind, at });
        break;
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
