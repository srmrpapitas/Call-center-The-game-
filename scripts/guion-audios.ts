// Genera GUION-AUDIOS.md: todas las frases de las llamadas con el nombre de archivo de cada audio.
// Uso: npm run guion  (Node 22.18 o superior)
import { writeFileSync } from "node:fs";
import { CALLS, REACTION_INFO, SILENCE_REPLY, audioFile, type Reaction } from "../client/src/calls.ts";

const tipo = (t: number) => (t >= 20 ? "buena" : t > 0 ? "floja" : "mala");
const clientLines = 1 + CALLS.reduce((n, c) => n + c.rounds.length + Object.keys(c.react).length, 0);
const playerLines = CALLS.reduce((n, c) => n + c.rounds.length * 3, 0);
const out: string[] = [
  "# Guion de audios",
  "",
  "Generado con `npm run guion` a partir de `client/src/calls.ts`. No lo edites a mano.",
  "",
  "Graba cada frase en un `.mp3` con el nombre exacto de la columna *Archivo* y mételo en",
  "`client/public/audio/calls/`. Las que falten se quedan en texto, así que puedes ir poco a poco.",
  "",
  `1. **Clientes: ${clientLines} audios.** Lo que dice cada cliente en cada ronda y sus reacciones.`,
  "   Las reacciones son genéricas: suenan tras cualquier respuesta buena, floja o mala.",
  `2. **Estafadores: ${playerLines} audios (opcionales).** Las frases que elige el jugador. Donde pone`,
  "   *{alias}*, di solo «soy de…» o el alias que quieras: el texto en pantalla pone el del personaje.",
  "",
  "## General",
  "",
  "| Archivo | Frase |",
  "|---|---|",
  `| \`${SILENCE_REPLY.audio}\` | ${SILENCE_REPLY.text} (cualquier cliente, si se acaba el tiempo) |`,
  "",
];
for (const c of CALLS) {
  out.push(`## ${c.emoji} ${c.customer} — ${c.scam}`, "", "### Cliente", "", "| Archivo | Cuándo | Frase |", "|---|---|---|");
  c.rounds.forEach((r, i) => out.push(`| \`${audioFile(c.id, `r${i + 1}_cliente`)}\` | Ronda ${i + 1} | ${r.say} |`));
  for (const k of Object.keys(c.react) as Reaction[]) out.push(`| \`${audioFile(c.id, k)}\` | ${REACTION_INFO[k]} | ${c.react[k]} |`);
  out.push("", "### Estafador (opcional)", "", "| Archivo | Respuesta | Frase |", "|---|---|---|");
  c.rounds.forEach((r, i) =>
    r.options.forEach((o, k) => out.push(`| \`${audioFile(c.id, `r${i + 1}_op${k + 1}_jugador`)}\` | Ronda ${i + 1}, opción ${k + 1} (${tipo(o.trust)}) | ${o.t} |`)),
  );
  out.push("");
}
writeFileSync(new URL("../GUION-AUDIOS.md", import.meta.url), out.join("\n"));
console.log(`GUION-AUDIOS.md: ${clientLines} audios de clientes y ${playerLines} de estafadores`);
