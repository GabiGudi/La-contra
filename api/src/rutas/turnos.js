import { Router } from "express";
import { pool } from "../db.js";
import { exigirAdmin } from "../auth.js";
import { avisar, cuando } from "../notificaciones.js";
import {
  limpiarJugadores,
  fechaValida,
  dentroDelHorario,
  cupoValido,
  yaEmpezo,
  puedeCancelar,
  MINUTOS_MINIMOS,
} from "../reglas.js";

export const rutasTurnos = Router();

/** Código de 4 dígitos. Si el azar repite uno, reintenta. */
async function generarCodigo() {
  for (let intento = 0; intento < 5; intento++) {
    const codigo = String(Math.floor(1000 + Math.random() * 9000));
    const { rows } = await pool.query("SELECT 1 FROM turnos WHERE codigo = $1", [codigo]);
    if (rows.length === 0) return codigo;
  }
  throw new Error("No se pudo generar un código libre");
}

async function guardarEquipo(cliente, turnoId, rol, equipo, jugadores) {
  const { rows } = await cliente.query(
    "INSERT INTO equipos (turno_id, rol, nombre, contacto) VALUES ($1,$2,$3,$4) RETURNING id",
    [turnoId, rol, equipo.nombre.trim(), (equipo.contacto || "").trim()]
  );
  for (const nombre of jugadores) {
    await cliente.query("INSERT INTO jugadores (equipo_id, nombre) VALUES ($1,$2)", [rows[0].id, nombre]);
  }
}

/** Arma la respuesta de un equipo con su lista de jugadores. */
const armarEquipo = (equipo, jugadores) =>
  equipo && {
    nombre: equipo.nombre,
    contacto: equipo.contacto,
    jugadores: jugadores.filter((j) => j.equipo_id === equipo.id).map((j) => j.nombre),
  };

/** Trae equipos y jugadores de una tanda de turnos en dos consultas. */
async function traerEquipos(turnoIds) {
  const { rows: equipos } = await pool.query("SELECT * FROM equipos WHERE turno_id = ANY($1)", [turnoIds]);
  if (equipos.length === 0) return { equipos: [], jugadores: [] };

  const { rows: jugadores } = await pool.query(
    "SELECT * FROM jugadores WHERE equipo_id = ANY($1) ORDER BY id",
    [equipos.map((e) => e.id)]
  );
  return { equipos, jugadores };
}

/* ══════════════════════════════════════════════════════════
   Crear turno
   ══════════════════════════════════════════════════════════ */
rutasTurnos.post("/", async (req, res) => {
  const { canchaId, fecha, hora, equipoLocal, equipoVisitante } = req.body;

  // Todas las validaciones acá arriba: una vez abierta la transacción,
  // solo se escribe, nunca se hace return.
  if (!fechaValida(fecha)) {
    return res.status(400).json({ error: "Fecha inválida." });
  }
  if (!equipoLocal?.nombre?.trim()) {
    return res.status(400).json({ error: "Poné el nombre de tu equipo." });
  }
  if (!equipoLocal?.contacto?.trim()) {
    return res.status(400).json({ error: "Dejá un teléfono de contacto." });
  }

  const jugadoresLocal = limpiarJugadores(equipoLocal.jugadores);
  if (jugadoresLocal.length === 0) {
    return res.status(400).json({ error: "Cargá al menos un jugador." });
  }

  const { rows: canchas } = await pool.query(
    `SELECT c.id, c.nombre, c.tipo, x.apertura, x.cierre
       FROM canchas c JOIN complejos x ON x.id = c.complejo_id
      WHERE c.id = $1`,
    [canchaId]
  );
  if (canchas.length === 0) {
    return res.status(404).json({ error: "Esa cancha no existe." });
  }

  const { tipo: cupo, apertura, cierre } = canchas[0];

  if (!dentroDelHorario(hora, apertura, cierre)) {
    return res.status(400).json({ error: `El complejo abre de ${apertura}:00 a ${cierre}:00.` });
  }

  if (yaEmpezo(fecha, hora)) {
    return res.status(400).json({ error: "Ese horario ya pasó." });
  }

  if (!cupoValido(jugadoresLocal.length, cupo)) {
    return res.status(400).json({
      error: `En una cancha de ${cupo} se anotan hasta ${cupo} jugadores por equipo.`,
    });
  }

  const conVisitante = Boolean(equipoVisitante?.nombre?.trim());
  const jugadoresVisitante = conVisitante ? limpiarJugadores(equipoVisitante.jugadores) : [];

  if (conVisitante && !cupoValido(jugadoresVisitante.length, cupo)) {
    return res.status(400).json({
      error: `El equipo rival tiene que tener entre 1 y ${cupo} jugadores.`,
    });
  }

  const estado = conVisitante ? "confirmado" : "esperando";

  // El turno y sus equipos entran juntos o no entra nada.
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    const codigo = await generarCodigo();
    const { rows: creados } = await cliente.query(
      `INSERT INTO turnos (cancha_id, fecha, hora, estado, codigo)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [canchaId, fecha, hora, estado, codigo]
    );
    const turnoId = creados[0].id;

    await guardarEquipo(cliente, turnoId, "local", equipoLocal, jugadoresLocal);

    if (conVisitante) {
      await guardarEquipo(cliente, turnoId, "visitante", equipoVisitante, jugadoresVisitante);
    }

    const detalle = conVisitante
      ? `${equipoLocal.nombre.trim()} vs ${equipoVisitante.nombre.trim()}`
      : `${equipoLocal.nombre.trim()} (busca contra)`;

    await avisar(cliente, {
      tipo: "reserva",
      turnoId,
      texto: `${detalle} reservó ${canchas[0].nombre} el ${cuando(fecha, hora)}.`,
    });

    await cliente.query("COMMIT");
    res.status(201).json({ id: turnoId, codigo, estado });
  } catch (e) {
    await cliente.query("ROLLBACK");
    // Acá se corta la doble reserva: en el choque real contra la
    // restricción única de la base, no en un if anterior.
    if (e.code === "23505" && String(e.constraint).includes("turno_unico")) {
      return res.status(409).json({ error: "Ese turno ya está reservado. Elegí otro horario." });
    }
    console.error(e);
    res.status(500).json({ error: "No se pudo guardar el turno." });
  } finally {
    cliente.release();
  }
});

/* ══════════════════════════════════════════════════════════
   Listado público. Sin códigos: son la llave de cada turno.
   ══════════════════════════════════════════════════════════ */
rutasTurnos.get("/", async (req, res) => {
  const { desde, hasta } = req.query;

  const { rows: turnos } = await pool.query(
    `SELECT t.id, t.cancha_id, TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha,
            t.hora, t.estado
       FROM turnos t
      WHERE ($1::date IS NULL OR t.fecha >= $1)
        AND ($2::date IS NULL OR t.fecha <= $2)
      ORDER BY t.fecha, t.hora`,
    [desde || null, hasta || null]
  );

  if (turnos.length === 0) return res.json([]);

  const { equipos, jugadores } = await traerEquipos(turnos.map((t) => t.id));

  // El teléfono no va en el listado público: lo ve el que se anota de
  // contra (desde "Mi turno", con su código) y el dueño en su panel.
  const sinTelefono = (equipo) => equipo && { nombre: equipo.nombre, jugadores: equipo.jugadores };

  res.json(
    turnos.map((t) => ({
      ...t,
      local: sinTelefono(armarEquipo(equipos.find((e) => e.turno_id === t.id && e.rol === "local"), jugadores)),
      visitante:
        sinTelefono(armarEquipo(equipos.find((e) => e.turno_id === t.id && e.rol === "visitante"), jugadores)) || null,
    }))
  );
});

/* ══════════════════════════════════════════════════════════
   Listado del admin: con códigos y filtros
   ══════════════════════════════════════════════════════════ */
rutasTurnos.get("/admin", exigirAdmin, async (req, res) => {
  const { estado, desde, hasta } = req.query;

  const { rows: turnos } = await pool.query(
    `SELECT t.id, TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha, t.hora, t.estado,
            t.codigo, t.codigo_visitante, c.nombre AS cancha, c.tipo
       FROM turnos t JOIN canchas c ON c.id = t.cancha_id
      WHERE ($1::text IS NULL OR t.estado = $1)
        AND ($2::date IS NULL OR t.fecha >= $2)
        AND ($3::date IS NULL OR t.fecha <= $3)
      ORDER BY t.fecha, t.hora`,
    [estado || null, desde || null, hasta || null]
  );

  if (turnos.length === 0) return res.json([]);

  const { equipos, jugadores } = await traerEquipos(turnos.map((t) => t.id));

  res.json(
    turnos.map((t) => ({
      ...t,
      local: armarEquipo(equipos.find((e) => e.turno_id === t.id && e.rol === "local"), jugadores),
      visitante: armarEquipo(equipos.find((e) => e.turno_id === t.id && e.rol === "visitante"), jugadores) || null,
    }))
  );
});

/* ══════════════════════════════════════════════════════════
   Anotarse de contra
   ══════════════════════════════════════════════════════════ */
rutasTurnos.post("/:id/contra", async (req, res) => {
  const { equipo } = req.body;

  if (!equipo?.nombre?.trim()) {
    return res.status(400).json({ error: "Poné el nombre de tu equipo." });
  }
  if (!equipo?.contacto?.trim()) {
    return res.status(400).json({ error: "Dejá un teléfono de contacto." });
  }

  const jugadores = limpiarJugadores(equipo.jugadores);
  if (jugadores.length === 0) {
    return res.status(400).json({ error: "Cargá al menos un jugador." });
  }

  const { rows: turnos } = await pool.query(
    `SELECT t.id, t.estado, TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha, t.hora,
            c.tipo, c.nombre AS cancha
       FROM turnos t JOIN canchas c ON c.id = t.cancha_id
      WHERE t.id = $1`,
    [req.params.id]
  );
  if (turnos.length === 0) return res.status(404).json({ error: "Ese turno no existe." });

  const turno = turnos[0];

  if (turno.estado !== "esperando") {
    return res.status(409).json({ error: "Ese turno ya tiene contra." });
  }
  if (!cupoValido(jugadores.length, turno.tipo)) {
    return res.status(400).json({ error: `Se anotan hasta ${turno.tipo} jugadores por equipo.` });
  }
  if (yaEmpezo(turno.fecha, turno.hora)) {
    return res.status(400).json({ error: "Ese turno ya pasó." });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    // La condición del estado viaja dentro del UPDATE: si dos equipos se
    // anotan en el mismo instante, solo uno actualiza la fila.
    const codigoVisitante = await generarCodigo();
    const { rowCount } = await cliente.query(
      `UPDATE turnos SET estado = 'confirmado', codigo_visitante = $2
        WHERE id = $1 AND estado = 'esperando'`,
      [turno.id, codigoVisitante]
    );

    if (rowCount === 0) {
      await cliente.query("ROLLBACK");
      return res.status(409).json({ error: "Otro equipo se anotó primero." });
    }

    await guardarEquipo(cliente, turno.id, "visitante", equipo, jugadores);

    await avisar(cliente, {
      tipo: "contra",
      turnoId: turno.id,
      texto: `${equipo.nombre.trim()} se anotó de contra en ${turno.cancha} el ${cuando(turno.fecha, turno.hora)}. El partido quedó armado.`,
    });

    await cliente.query("COMMIT");

    res.json({ codigo: codigoVisitante });
  } catch (e) {
    await cliente.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "No se pudo anotar el equipo." });
  } finally {
    cliente.release();
  }
});

/* ══════════════════════════════════════════════════════════
   Mi turno: buscar con el código
   ══════════════════════════════════════════════════════════ */
rutasTurnos.get("/codigo/:codigo", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.id, TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha, t.hora, t.estado,
            c.nombre AS cancha, c.tipo,
            (t.codigo = $1) AS es_local
       FROM turnos t JOIN canchas c ON c.id = t.cancha_id
      WHERE t.codigo = $1 OR t.codigo_visitante = $1`,
    [req.params.codigo]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "No encontramos ningún turno con ese código." });
  }

  const turno = rows[0];
  const { equipos, jugadores } = await traerEquipos([turno.id]);

  res.json({
    ...turno,
    local: armarEquipo(equipos.find((e) => e.rol === "local"), jugadores),
    visitante: armarEquipo(equipos.find((e) => e.rol === "visitante"), jugadores) || null,
  });
});

/* ══════════════════════════════════════════════════════════
   Editar la lista de jugadores del equipo propio.
   Se puede hasta que el turno arranca: los nombres cambian a
   último momento y no hay razón para cerrarlo antes.
   ══════════════════════════════════════════════════════════ */
rutasTurnos.put("/codigo/:codigo/jugadores", async (req, res) => {
  const jugadores = limpiarJugadores(req.body?.jugadores);

  const { rows } = await pool.query(
    `SELECT t.id, TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha, t.hora, c.tipo,
            (t.codigo = $1) AS es_local
       FROM turnos t JOIN canchas c ON c.id = t.cancha_id
      WHERE t.codigo = $1 OR t.codigo_visitante = $1`,
    [req.params.codigo]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "No encontramos ningún turno con ese código." });
  }

  const turno = rows[0];

  if (yaEmpezo(turno.fecha, turno.hora)) {
    return res.status(409).json({ error: "El turno ya empezó, no se puede modificar." });
  }

  if (!cupoValido(jugadores.length, turno.tipo)) {
    return res.status(400).json({
      error: `Tenés que anotar entre 1 y ${turno.tipo} jugadores.`,
    });
  }

  // El código decide qué equipo se toca: con el del visitante no se
  // edita el local, y al revés tampoco.
  const rol = turno.es_local ? "local" : "visitante";

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    const { rows: equipos } = await cliente.query(
      "SELECT id FROM equipos WHERE turno_id = $1 AND rol = $2",
      [turno.id, rol]
    );
    if (equipos.length === 0) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ error: "Ese turno no tiene equipo cargado." });
    }

    const equipoId = equipos[0].id;
    await cliente.query("DELETE FROM jugadores WHERE equipo_id = $1", [equipoId]);
    for (const nombre of jugadores) {
      await cliente.query("INSERT INTO jugadores (equipo_id, nombre) VALUES ($1, $2)", [equipoId, nombre]);
    }

    await cliente.query("COMMIT");
    res.json({ jugadores });
  } catch (e) {
    await cliente.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "No se pudieron guardar los jugadores." });
  } finally {
    cliente.release();
  }
});

/* ══════════════════════════════════════════════════════════
   Cancelar el turno propio, hasta 15 minutos antes
   ══════════════════════════════════════════════════════════ */
rutasTurnos.delete("/codigo/:codigo", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.id, TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha, t.hora,
            (t.codigo = $1) AS es_local,
            c.nombre AS cancha,
            (SELECT nombre FROM equipos WHERE turno_id = t.id AND rol = 'local') AS local,
            (SELECT nombre FROM equipos WHERE turno_id = t.id AND rol = 'visitante') AS visitante
       FROM turnos t JOIN canchas c ON c.id = t.cancha_id
      WHERE t.codigo = $1 OR t.codigo_visitante = $1`,
    [req.params.codigo]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "No encontramos ningún turno con ese código." });
  }

  const turno = rows[0];

  if (!puedeCancelar(turno.fecha, turno.hora)) {
    return res.status(409).json({
      error: `Los turnos se pueden cancelar hasta ${MINUTOS_MINIMOS} minutos antes de la hora de juego.`,
    });
  }

  if (turno.es_local) {
    // Se va el que reservó: cae el turno entero y la cancha queda libre.
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      await avisar(cliente, {
        tipo: "cancelacion",
        texto: `${turno.local} canceló el turno de ${turno.cancha} del ${cuando(turno.fecha, turno.hora)}. La cancha quedó libre.`,
      });
      await cliente.query("DELETE FROM turnos WHERE id = $1", [turno.id]);
      await cliente.query("COMMIT");
      return res.json({ cancelado: "turno" });
    } catch (e) {
      await cliente.query("ROLLBACK");
      console.error(e);
      return res.status(500).json({ error: "No se pudo cancelar." });
    } finally {
      cliente.release();
    }
  }

  // Se baja la contra: el turno sigue en pie y vuelve a buscar rival.
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("DELETE FROM equipos WHERE turno_id = $1 AND rol = 'visitante'", [turno.id]);
    await cliente.query(
      "UPDATE turnos SET estado = 'esperando', codigo_visitante = NULL WHERE id = $1",
      [turno.id]
    );
    await avisar(cliente, {
      tipo: "baja_contra",
      turnoId: turno.id,
      texto: `${turno.visitante} se bajó del partido contra ${turno.local} en ${turno.cancha}, ${cuando(turno.fecha, turno.hora)}. El turno volvió a buscar contra.`,
    });
    await cliente.query("COMMIT");
    res.json({ cancelado: "contra" });
  } catch (e) {
    await cliente.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "No se pudo cancelar." });
  } finally {
    cliente.release();
  }
});

/* ══════════════════════════════════════════════════════════
   El admin borra cualquier turno, sin límite de horario
   ══════════════════════════════════════════════════════════ */
rutasTurnos.delete("/:id", exigirAdmin, async (req, res) => {
  const { rowCount } = await pool.query("DELETE FROM turnos WHERE id = $1", [req.params.id]);
  if (rowCount === 0) return res.status(404).json({ error: "Ese turno no existe." });
  res.json({ eliminado: true });
});