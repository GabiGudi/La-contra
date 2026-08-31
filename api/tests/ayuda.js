import { app } from "../src/app.js";
import { pool } from "../src/db.js";

let servidor;
let base;

/** Levanta la app en un puerto libre. No usa el 3000: así podés tener
    el servidor de desarrollo corriendo mientras testeás. */
export async function arrancarServidor() {
  if (servidor) return base;
  await new Promise((listo) => {
    servidor = app.listen(0, () => {
      base = "http://127.0.0.1:" + servidor.address().port;
      listo();
    });
  });
  return base;
}

export async function apagarServidor() {
  if (servidor) await new Promise((r) => servidor.close(r));
  servidor = null;
  await pool.end();
}

/**
 * Deja la base como recién creada y carga un complejo con dos canchas.
 * Se llama antes de cada test: cada uno arranca del mismo punto y no
 * depende del orden en que corran.
 */
export async function prepararBase({ apertura = 17, cierre = 23 } = {}) {
  await pool.query(
    "TRUNCATE notificaciones, turnos, equipos, jugadores, canchas, complejos RESTART IDENTITY CASCADE"
  );

  const { rows: complejos } = await pool.query(
    "INSERT INTO complejos (nombre, apertura, cierre) VALUES ($1,$2,$3) RETURNING id",
    ["La Contra", apertura, cierre]
  );
  const complejoId = complejos[0].id;

  const { rows: canchas } = await pool.query(
    `INSERT INTO canchas (complejo_id, nombre, tipo)
     VALUES ($1,'Cancha 1',7), ($1,'Cancha 2',5) RETURNING id, tipo`,
    [complejoId]
  );

  return {
    complejoId,
    canchaF7: canchas.find((c) => c.tipo === 7).id,
    canchaF5: canchas.find((c) => c.tipo === 5).id,
  };
}

/** Fecha local en AAAA-MM-DD, sin pasar por UTC. */
export function fechaLocal(diasDesdeHoy = 0) {
  const d = new Date();
  d.setDate(d.getDate() + diasDesdeHoy);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const MANANA = () => fechaLocal(1);

export async function pedir(ruta, { metodo = "GET", cuerpo, token } = {}) {
  const cabeceras = { "Content-Type": "application/json" };
  if (token) cabeceras.Authorization = "Bearer " + token;

  const r = await fetch(base + ruta, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  return { estado: r.status, datos: await r.json().catch(() => null) };
}

export const equipo = (nombre, cantidad = 3, contacto = "3564 55-5555") => ({
  nombre,
  contacto,
  jugadores: Array.from({ length: cantidad }, (_, i) => `${nombre} ${i + 1}`),
});

/** Reserva un turno con valores por defecto, sobreescribibles. */
export const reservar = (extra = {}) =>
  pedir("/api/turnos", {
    metodo: "POST",
    cuerpo: {
      fecha: MANANA(),
      hora: 20,
      equipoLocal: equipo("Los Pibes"),
      ...extra,
    },
  });

export async function entrarComoAdmin() {
  const { datos } = await pedir("/api/login", {
    metodo: "POST",
    cuerpo: { clave: process.env.CLAVE_ADMIN },
  });
  return datos.token;
}

/** Mete un turno directo en la base, salteando las validaciones.
    Sirve para armar situaciones que la API no deja crear, como un
    turno que arranca en pocos minutos. */
export async function turnoDirecto({ canchaId, fecha, hora, codigo = "9999", estado = "esperando" }) {
  const { rows } = await pool.query(
    `INSERT INTO turnos (cancha_id, fecha, hora, estado, codigo)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [canchaId, fecha, hora, estado, codigo]
  );
  const turnoId = rows[0].id;

  const { rows: equipos } = await pool.query(
    "INSERT INTO equipos (turno_id, rol, nombre, contacto) VALUES ($1,'local','Los Pibes','3564') RETURNING id",
    [turnoId]
  );
  await pool.query("INSERT INTO jugadores (equipo_id, nombre) VALUES ($1,'Gabi')", [equipos[0].id]);

  return turnoId;
}