# Audios de las llamadas

Pon aquí tus grabaciones en `.mp3`. Cada frase tiene un nombre fijo (por ejemplo `vlad_r1_cliente.mp3`);
la lista completa está en `GUION-AUDIOS.md`, en la raíz del repositorio (`npm run guion` la regenera).

Si falta un archivo, esa frase se muestra solo en texto. Para usar otro nombre o formato (`.wav`, `.ogg`),
rellena en `client/src/calls.ts` el campo `sayAudio` (cliente), `audio` (jugador) o `replyAudio` (respuesta).
