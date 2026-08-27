import { Router } from "express";
import { pool } from "../db.js";

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

function limpiarJugadores(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((j) => String(j || "").trim())
    .filter(Boolean);
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

rutasTurnos.post("/", async (req, res) => {
  const { canchaId, fecha, hora, equipoLocal, equipoVisitante } = req.body;

  // ── Validaciones. Todas acá arriba: una vez abierta la transacción,
  //    solo se escribe, nunca se hace return.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) {
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
    `SELECT c.id, c.tipo, x.apertura, x.cierre
       FROM canchas c JOIN complejos x ON x.id = c.complejo_id
      WHERE c.id = $1`,
    [canchaId]
  );
  if (canchas.length === 0) {
    return res.status(404).json({ error: "Esa cancha no existe." });
  }

  const { tipo: cupo, apertura, cierre } = canchas[0];

  if (hora < apertura || hora > cierre) {
    return res.status(400).json({ error: `El complejo abre de ${apertura}:00 a ${cierre}:00.` });
  }

  const inicio = new Date(`${fecha}T${String(hora).padStart(2, "0")}:00:00`);
  if (inicio.getTime() < Date.now()) {
    return res.status(400).json({ error: "Ese horario ya pasó." });
  }

  if (jugadoresLocal.length > cupo) {
    return res.status(400).json({
      error: `En una cancha de ${cupo} se anotan hasta ${cupo} jugadores por equipo.`,
    });
  }

  const conVisitante = Boolean(equipoVisitante?.nombre?.trim());
  const jugadoresVisitante = conVisitante ? limpiarJugadores(equipoVisitante.jugadores) : [];

  if (jugadoresVisitante.length > cupo) {
    return res.status(400).json({ error: `El equipo rival supera los ${cupo} jugadores.` });
  }

  const estado = conVisitante ? "confirmado" : "esperando";

  // ── Escritura. El turno y sus equipos entran juntos o no entra nada.
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

    await cliente.query("COMMIT");
    res.status(201).json({ id: turnoId, codigo, estado });
  } catch (e) {
    await cliente.query("ROLLBACK");
    if (e.code === "23505" && String(e.constraint).includes("turno_unico")) {
      return res.status(409).json({ error: "Ese turno ya está reservado. Elegí otro horario." });
    }
    console.error(e);
    res.status(500).json({ error: "No se pudo guardar el turno." });
  } finally {
    cliente.release();
  }
});

rutasTurnos.get("/", async (req, res) => {
  const { desde, hasta } = req.query;

  const { rows: turnos } = await pool.query(
    `SELECT t.id, t.cancha_id, TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha,
            t.hora, t.estado, t.codigo
       FROM turnos t
      WHERE ($1::date IS NULL OR t.fecha >= $1)
        AND ($2::date IS NULL OR t.fecha <= $2)
      ORDER BY t.fecha, t.hora`,
    [desde || null, hasta || null]
  );

  if (turnos.length === 0) return res.json([]);

  const ids = turnos.map((t) => t.id);
  const { rows: equipos } = await pool.query("SELECT * FROM equipos WHERE turno_id = ANY($1)", [ids]);
  const { rows: jugadores } = await pool.query(
    "SELECT * FROM jugadores WHERE equipo_id = ANY($1) ORDER BY id",
    [equipos.map((e) => e.id)]
  );

  const armar = (equipo) =>
    equipo && {
      nombre: equipo.nombre,
      contacto: equipo.contacto,
      jugadores: jugadores.filter((j) => j.equipo_id === equipo.id).map((j) => j.nombre),
    };

  res.json(
    turnos.map((t) => ({
      ...t,
      local: armar(equipos.find((e) => e.turno_id === t.id && e.rol === "local")),
      visitante: armar(equipos.find((e) => e.turno_id === t.id && e.rol === "visitante")) || null,
    }))
  );
});

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
    `SELECT t.id, t.estado, TO_CHAR(t.fecha, 'YYYY-MM-DD') AS fecha, t.hora, c.tipo
       FROM turnos t JOIN canchas c ON c.id = t.cancha_id
      WHERE t.id = $1`,
    [req.params.id]
  );
  if (turnos.length === 0) return res.status(404).json({ error: "Ese turno no existe." });

  const turno = turnos[0];
  if (turno.estado !== "esperando") {
    return res.status(409).json({ error: "Ese turno ya tiene contra." });
  }
  if (jugadores.length > turno.tipo) {
    return res.status(400).json({ error: `Se anotan hasta ${turno.tipo} jugadores por equipo.` });
  }

  const inicio = new Date(`${turno.fecha}T${String(turno.hora).padStart(2, "0")}:00:00`);
  if (inicio.getTime() < Date.now()) {
    return res.status(400).json({ error: "Ese turno ya pasó." });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    // La condición del estado va acá adentro, no en un if de arriba:
    // si dos equipos se anotan en el mismo instante, solo uno actualiza
    // la fila y el otro recibe 0 filas afectadas.
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