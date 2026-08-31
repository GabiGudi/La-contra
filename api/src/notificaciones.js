/**
 * Registra un aviso para el dueño.
 *
 * `ejecutor` puede ser el pool o un cliente dentro de una transacción:
 * cuando el aviso acompaña a una escritura (crear un turno), conviene que
 * viaje en la misma transacción y entre o no entre junto con ella.
 *
 * El texto se arma acá y se guarda ya escrito. Es información duplicada a
 * propósito: si mañana borran el turno o cambian el nombre de la cancha,
 * el aviso sigue diciendo lo que pasó ese día.
 */
export async function avisar(ejecutor, { tipo, texto, turnoId = null }) {
  await ejecutor.query(
    "INSERT INTO notificaciones (tipo, texto, turno_id) VALUES ($1, $2, $3)",
    [tipo, texto, turnoId]
  );
}

/** "sábado 5/9 a las 21:00" a partir de la fecha y la hora del turno. */
export function cuando(fecha, hora) {
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = new Date(a, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
  });
  return `${dia} a las ${String(hora).padStart(2, "0")}:00`;
}