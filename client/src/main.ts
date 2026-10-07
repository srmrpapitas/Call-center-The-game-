import { Game } from "./game";
import { CAST, GAME_TITLE, MAX_PLAYERS } from "./config";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

document.title = GAME_TITLE;
$("title").textContent = GAME_TITLE;

const store = {
  get(k: string, d: string) {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* sin almacenamiento */
    }
  },
};

let skin = Number(store.get("cc.skin", "0")) % CAST.length;
const nameInput = $<HTMLInputElement>("name");
nameInput.value = store.get("cc.name", "");

const cards = $("cast");
CAST.forEach((c, i) => {
  const el = document.createElement("button");
  el.className = "card" + (i === skin ? " sel" : "");
  const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
  el.innerHTML = `<span class="swatch" style="--skin:${hex(c.skin)};--shirt:${hex(c.shirt)}"></span><b>${c.name}</b><small>${c.role}</small><em>${c.quirk}</em>`;
  el.onclick = () => {
    skin = i;
    [...cards.children].forEach((x, j) => x.classList.toggle("sel", j === i));
  };
  cards.appendChild(el);
});

const canvas = $<HTMLCanvasElement>("scene");
const game = new Game(canvas);
(window as any).__game = game;

const randomCode = () => {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
};

async function go(code: string | null) {
  const name = (nameInput.value.trim() || CAST[skin].name).slice(0, 14);
  store.set("cc.name", nameInput.value.trim());
  store.set("cc.skin", String(skin));
  $("menu").classList.add("hidden");
  $("loading").classList.remove("hidden");
  const res = await game.start({ name, skin, code });
  $("loading").classList.add("hidden");
  if (code && !res.online) {
    const t = $("toast");
    t.textContent = "No hay servidor disponible: jugando en modo solo";
    t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 4000);
  }
}

$("btn-create").onclick = () => void go(randomCode());
$("btn-join").onclick = () => {
  const code = $<HTMLInputElement>("code").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,8}$/.test(code)) {
    $("code").classList.add("err");
    return;
  }
  void go(code);
};
$("btn-solo").onclick = () => void go(null);
$("max").textContent = String(MAX_PLAYERS);
