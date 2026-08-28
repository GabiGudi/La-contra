export const MINUTOS_MINIMOS = 15;
 
const inicioDe = (fecha, hora) =>
  new Date(`${fecha}T${String(hora).padStart(2, "0")}:00:00`);
 
export function minutosParaElTurno(fecha, hora, ahora = new Date()) {
  return Math.floor((inicioDe(fecha, hora).getTime() - ahora.getTime()) / 60000);
}
 
export function yaEmpezo(fecha, hora, ahora = new Date()) {
  return minutosParaElTurno(fecha, hora, ahora) < 0;
}
 
export function puedeCancelar(fecha, hora, ahora = new Date()) {
  return minutosParaElTurno(fecha, hora, ahora) >= MINUTOS_MINIMOS;
}
 
export function fechaValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) return false;
  const [a, m, d] = fecha.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d;
}
 
export function dentroDelHorario(hora, apertura, cierre) {
  return Number.isInteger(hora) && hora >= apertura && hora <= cierre;
}
 
export function cupoValido(cantidadDeJugadores, tipoDeCancha) {
  return cantidadDeJugadores > 0 && cantidadDeJugadores <= tipoDeCancha;
}
 
export function limpiarJugadores(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((j) => String(j || "").trim())
    .filter(Boolean);
}