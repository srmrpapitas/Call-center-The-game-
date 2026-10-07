// Prueba de humo: juega en modo solo y con dos jugadores contra el Worker local.
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = "smoke-out";
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || "http://localhost:8787";
const results = [];
const note = (ok, msg) => {
  results.push({ ok, msg });
  console.log(`${ok ? "::notice::OK" : "::error::FALLO"} ${msg}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

async function newPage(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(BASE);
  return { page, errors, name };
}

try {
  // ---- Jugador A: crear sala ----
  const A = await newPage("A");
  await A.page.screenshot({ path: `${OUT}/01-menu.png` });
  await A.page.fill("#name", "Ana");
  await A.page.click("#btn-create");
  await A.page.waitForSelector("#hud:not(.hidden)", { timeout: 15000 });
  await sleep(1500);
  const room = (await A.page.textContent("#h-room")).trim();
  note(/^Sala [A-Z0-9]{4}$/.test(room), `Sala online creada: ${room}`);
  await A.page.screenshot({ path: `${OUT}/02-juego-A.png` });

  // ---- Jugador B: unirse ----
  const B = await newPage("B");
  await B.page.fill("#name", "Beto");
  await B.page.fill("#code", room.replace("Sala ", ""));
  await B.page.click("#btn-join");
  await B.page.waitForSelector("#hud:not(.hidden)", { timeout: 15000 });
  await sleep(2000);
  const pa = (await A.page.textContent("#h-players")).trim();
  const pb = (await B.page.textContent("#h-players")).trim();
  note(pa.includes("2") && pb.includes("2"), `Ambos ven 2 jugadores (A: ${pa}, B: ${pb})`);

  // ---- A camina y B lo ve moverse ----
  const before = await B.page.evaluate(() => {
    const g = window.__game;
    return [...g.others.values()].map((r) => [r.av.group.position.x, r.av.group.position.z]);
  });
  await A.page.keyboard.down("d");
  await sleep(1200);
  await A.page.keyboard.up("d");
  await sleep(500);
  const after = await B.page.evaluate(() => {
    const g = window.__game;
    return [...g.others.values()].map((r) => [r.av.group.position.x, r.av.group.position.z]);
  });
  const moved = before[0] && after[0] && Math.hypot(after[0][0] - before[0][0], after[0][1] - before[0][1]) > 1;
  note(!!moved, `B ve a A moverse (${JSON.stringify(before[0])} -> ${JSON.stringify(after[0])})`);
  await B.page.screenshot({ path: `${OUT}/03-juego-B-ve-a-A.png` });

  // ---- A atiende una llamada ----
  await A.page.evaluate(() => {
    const g = window.__game;
    const d = g.desks[0];
    g.me.pos.set(d.seat.x, 0, d.seat.z + 0.2);
  });
  await sleep(300);
  const prompt = await A.page.isVisible("#prompt");
  note(prompt, "Aparece el aviso [E] junto a un puesto");
  await A.page.keyboard.press("e");
  await sleep(2500);
  note(await A.page.isVisible("#desk"), "Se abre el escritorio de llamada");
  await A.page.screenshot({ path: `${OUT}/04-escritorio.png` });
  // elige siempre la respuesta que más confianza da
  for (let i = 0; i < 3; i++) {
    const best = await A.page.evaluate(() => {
      const ui = window.__game.ui;
      const opts = ui.current.rounds[ui.roundIdx].options;
      return opts.indexOf(opts.reduce((a, b) => (b.trust > a.trust ? b : a)));
    });
    if (i === 0) {
      // por voz: se simula que el reconocimiento oye la frase leída
      await A.page.evaluate((k) => {
        const ui = window.__game.ui;
        ui.heard(document.querySelectorAll("#c-options button")[k].textContent.slice(2));
      }, best);
    } else if (i === 1) await A.page.click(`#c-options button:nth-child(${best + 1})`);
    else await A.page.keyboard.press(String(best + 1));
    // la ronda siguiente llega cuando el cliente termina de hablar (con audios puede tardar)
    await A.page.waitForFunction(
      (n) =>
        !document.querySelector("#c-result").classList.contains("hidden") ||
        !document.querySelector("#bank").classList.contains("hidden") ||
        (window.__game.ui.roundIdx === n && document.querySelectorAll("#c-options button:not([disabled])").length === 3),
      i + 1,
      { timeout: 40000 },
    );
  }
  // banco: escribir el nº de cuenta que dicta el cliente y vaciarla
  await A.page.waitForSelector("#bank:not(.hidden)", { timeout: 40000 });
  const code = await A.page.evaluate(() => window.__game.ui.bankCode);
  await A.page.click("#pc-icons button");
  await A.page.screenshot({ path: `${OUT}/05-pc-remoto.png` });
  await A.page.click("#t-bank");
  await A.page.fill("#b-acct", code);
  await A.page.fill("#b-pass", await A.page.evaluate(() => window.__game.ui.current.pc.password));
  await A.page.click("#b-enter");
  await A.page.waitForSelector("#b-account:not(.hidden)", { timeout: 5000 });
  await A.page.screenshot({ path: `${OUT}/05-banco.png` });
  await A.page.click("#b-empty");
  await A.page.waitForSelector("#c-result:not(.hidden)", { timeout: 15000 });
  await sleep(300);
  await A.page.screenshot({ path: `${OUT}/05-resultado.png` });
  const result = (await A.page.textContent("#c-result")).replace(/\s+/g, " ").trim();
  note(/(CUENTA VACIADA|TRATO CERRADO).*puntos de cuota/.test(result), `Trato cerrado y banco (voz, clic y tecla): ${result.slice(0, 80)}`);
  await A.page.keyboard.press("Enter");
  await sleep(1500);
  const scoreA = await A.page.textContent("#h-score");
  const scoreB = await B.page.textContent("#h-score");
  note(scoreA === scoreB && !/ 0\//.test(scoreA), `Cuota de equipo sincronizada (A: ${scoreA}, B: ${scoreB})`);
  await B.page.screenshot({ path: `${OUT}/06-juego-B-cuota.png` });

  for (const p of [A, B]) {
    const real = p.errors.filter((e) => !/favicon|Failed to load resource/.test(e));
    note(real.length === 0, `Sin errores de consola en ${p.name}${real.length ? ": " + real.slice(0, 2).join(" | ") : ""}`);
  }

  // ---- Modo solo ----
  const S = await newPage("S");
  await S.page.click("#btn-solo");
  await S.page.waitForSelector("#hud:not(.hidden)", { timeout: 15000 });
  await sleep(1000);
  note((await S.page.textContent("#h-room")).trim() === "Solo", "Modo solo funciona");
  await S.page.screenshot({ path: `${OUT}/07-solo.png` });

  // ---- Ronda del jefe (forzada): de pie se pierde cuota ----
  await S.page.evaluate(() => {
    const g = window.__game;
    g.team.score = 10;
    g.startEvent("boss", 1500);
  });
  await sleep(500);
  note(await S.page.isVisible("#boss-alert"), "Aparece el aviso de que viene el jefe");
  await S.page.screenshot({ path: `${OUT}/08-aviso-jefe.png` });
  await sleep(2000);
  const bossScore = await S.page.evaluate(() => window.__game.team.score);
  const bossToast = (await S.page.textContent("#toast")).trim();
  note(bossScore === 5 && /pillado/.test(bossToast), `El jefe pilla al jugador de pie (cuota 10 -> ${bossScore}: ${bossToast})`);
  await S.page.screenshot({ path: `${OUT}/09-jefe-paseando.png` });

  // ---- Desastres: redada (de pie no pasa nada), virus en una llamada y apagón ----
  await S.page.evaluate(() => window.__game.startEvent("police", 800));
  await sleep(1500);
  const policeScore = await S.page.evaluate(() => window.__game.team.score);
  note(policeScore === 5, `Redada: si no estás al teléfono no pierdes cuota (${policeScore})`);
  await S.page.evaluate(() => {
    const g = window.__game;
    const d = g.desks[1];
    g.me.pos.set(d.seat.x, 0, d.seat.z + 0.2);
  });
  await sleep(300);
  await S.page.keyboard.press("e");
  await sleep(1500);
  await S.page.evaluate(() => window.__game.startEvent("virus", 0));
  await sleep(2500);
  const popups = await S.page.locator("#desk .popup").count();
  note(popups >= 1, `Virus: salen ventanas emergentes en la llamada (${popups})`);
  await S.page.screenshot({ path: `${OUT}/10-virus.png` });
  await S.page.evaluate(() => window.__game.startEvent("blackout", 0));
  await sleep(1200);
  const deskOpen = await S.page.isVisible("#desk");
  note(!deskOpen, "Apagón: se corta la llamada");
  await S.page.screenshot({ path: `${OUT}/11-apagon.png` });
  const day = (await S.page.textContent("#h-day")).trim();
  note(/Día 1/.test(day), `Se muestra el día (${day})`);
} catch (e) {
  note(false, `Excepción: ${String(e).slice(0, 300)}`);
}
await browser.close();
process.exit(results.some((r) => !r.ok) ? 1 : 0);
