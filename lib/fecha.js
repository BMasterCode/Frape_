// El servidor (Render, o tu PC) puede tener el reloj en UTC. Bolivia está en
// UTC-4 todo el año (no tiene horario de verano), así que si el servidor está
// en UTC, entre las 00:00 y las 03:59 UTC todavía es "ayer" en Bolivia. Estas
// funciones siempre calculan la fecha/hora real de Bolivia, sin importar en
// qué zona horaria esté corriendo el servidor.
const ZONA_BOLIVIA = 'America/La_Paz';

function fechaHoyBolivia() {
  // en-CA da el formato YYYY-MM-DD directamente
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA_BOLIVIA });
}

function mesActualBolivia() {
  return fechaHoyBolivia().slice(0, 7);
}

module.exports = { ZONA_BOLIVIA, fechaHoyBolivia, mesActualBolivia };
