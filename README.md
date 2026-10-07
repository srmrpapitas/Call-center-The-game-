# Call Center (título provisional)

Cooperativo online 3D de **humor negro** en una centralita de ventas absurda. Hasta 4 jugadores por sala o modo solo.
Todo es ficticio: empresas, clientes y personajes. Las "ventas" son disparatadas y no enseñan ninguna técnica real.

## Estructura

| Carpeta | Qué es |
|---|---|
| `client/` | Juego 3D en el navegador (Three.js + Vite + TypeScript) |
| `worker/` | Servidor en Cloudflare (Worker + Durable Object, una sala por código) |
| `src-tauri/` | Empaquetado a `.exe` de escritorio con Tauri |
| `.github/workflows/` | CI, despliegue del servidor y release del instalador |

## Jugar en local

```bash
npm --prefix client install
npm run dev:client            # http://localhost:5173  (modo solo)

# Con salas online en local (otra terminal):
npm --prefix worker install
npm --prefix client run build
npm run dev:server            # http://localhost:8787  (sirve también el cliente)
```

**El jefe:** una vez por turno, Don Bonifacio sale de Dirección y recorre la oficina. Suena una alarma y tenéis 8 segundos para sentaros en un puesto; quien le pille de pie resta 5 de cuota al equipo.

Controles: `WASD` mover · `Mayús` correr · arrastrar ratón: cámara · rueda: zoom · `E` en un puesto para hacer una llamada · para responder: clic en la frase, `1/2/3` o léela en voz alta (botón «Responder con la voz», en Chrome o Edge) · `Esc` levantarse.

## Coste cero

Funciona con los planes gratuitos de Cloudflare (Workers + Durable Objects), GitHub (repositorio público, Actions y Releases) y Tauri. Los audios van dentro del juego, así que no hay coste por voz.

## Desplegar el servidor

1. En GitHub, **Settings → Secrets and variables → Actions**: añade `CLOUDFLARE_API_TOKEN` (plantilla "Edit Cloudflare Workers") y `CLOUDFLARE_ACCOUNT_ID`.
2. Haz push a `main` (o ejecuta el workflow *Deploy servidor*). Quedará en `https://call-center-server.<tu-cuenta>.workers.dev`, que también sirve el juego web.

## Instalador .exe

1. En **Settings → Secrets and variables → Actions → Variables** crea `SERVER_URL` con la URL del Worker.
2. Crea una etiqueta: `git tag v0.1.0 && git push --tags`.
3. El workflow *Release escritorio* compila con Tauri y adjunta el instalador a la Release.

En local: `npm install && npm run icons && npm run tauri build` (necesita Rust).

## Cómo funcionan las llamadas

Eliges estafador (cada uno con su alias: Mohit es «Steven Myers», Omanga es «Jimmy»…), te sientas y llamas.
Cada respuesta sube o baja la **barra de confianza** del cliente: si llega arriba cierras el trato y te da
sus «datos bancarios»; si cae a cero, te cuelga. Todo es ficticio y absurdo.

## Tus audios y caras

- `npm run guion` genera `GUION-AUDIOS.md` con todas las frases y el nombre de archivo de cada audio.
  Los audios van en `client/public/audio/calls/`.
- Las caras de los personajes van en `client/public/faces/` (mira el README de esa carpeta).

## Pendiente (siguientes fases)

- Voz entre jugadores (WebRTC) y que tu voz llegue a la llamada.
- Clientes con IA en tiempo real (opcional, tiene coste).
- Modelos propios (`.glb`) para los personajes y la oficina.
- Tienda de mejoras y más llamadas.
