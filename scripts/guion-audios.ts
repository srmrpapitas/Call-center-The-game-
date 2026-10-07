// Genera GUION-AUDIOS.md: todas las frases de las llamadas con el nombre de archivo de cada audio.
// Uso: npm run guion  (Node 22.18 o superior)
import { writeFileSync } from "node:fs";
import { CALLS, SILENCE_REPLY, audioFile } from "../client/src/calls.ts";

const pts = (p: number) => (p === 3 ? "buena (3)" : p === 1 ? "floja (1)" : "mala (0)");
const total = CALLS.reduce((n, c) => n + c.rounds.length * 7, 1);
const out: string[] = [
  "# Guion de audios",
  "",
  "Generado con `npm run guion` a partir de `client/src/calls.ts`. No lo edites a mano.",
  "",
  `Hay **${total} frases**. Graba cada una en un archivo \`.mp3\` con el nombre exacto de la columna *Archivo* y`,
  "mételo en `client/public/audio/calls/`. Las que no grabes se quedan en texto, así que puedes ir poco a poco.",
  "",
  "- **Cliente**: lo que dice el cliente al empezar cada ronda.",
  "- **Jugador**: la respuesta que elige el empleado (opción 1, 2 o 3).",
  "- **Respuesta**: cómo reacciona el cliente a esa opción.",
  "",
  "## General",
  "",
  "| Archivo | Quién | Frase |",
  "|---|---|---|",
  `| \`${SILENCE_REPLY.audio}\` | Cualquier cliente | ${SILENCE_REPLY.text} (si se acaba el tiempo) |`,
  "",
];
for (const c of CALLS) {
  out.push(`## ${c.emoji} ${c.customer} — ${c.product}`, "", "| Archivo | Quién | Frase |", "|---|---|---|");
  c.rounds.forEach((r, i) => {
    const n = i + 1;
    out.push(`| \`${audioFile(c.id, n, "cliente")}\` | **Cliente** (ronda ${n}) | ${r.say} |`);
    r.options.forEach((o, k) => {
      out.push(`| \`${audioFile(c.id, n, "jugador", k + 1)}\` | Jugador, opción ${k + 1} · ${pts(o.pts)} | ${o.t} |`);
      out.push(`| \`${audioFile(c.id, n, "respuesta", k + 1)}\` | Cliente responde a la ${k + 1} | ${o.reply} |`);
    });
  });
  out.push("");
}
writeFileSync(new URL("../GUION-AUDIOS.md", import.meta.url), out.join("\n"));
console.log(`GUION-AUDIOS.md: ${total} frases`);
