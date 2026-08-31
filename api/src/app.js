import express from "express";
import { pool } from "./db.js";
import { rutasTurnos } from "./rutas/turnos.js";
import { rutasNotificaciones } from "./rutas/notificaciones.js";
import { emitirToken, exigirAdmin } from "./auth.js";

export const app = express();
app.use(express.json());

app.get("/api/ping", (req, res) => {
  res.json({ mensaje: "La API está viva" });
});

app.post("/api/login", (req, res) => {
  if (req.body?.clave !== process.env.CLAVE_ADMIN) {
    return res.status(401).json({ error: "Clave incorrecta." });
  }
  res.json({ token: emitirToken() });
});

app.get("/api/complejo", async (req, res) => {
  const { rows: complejos } = await pool.query("SELECT * FROM complejos LIMIT 1");
  const { rows: canchas } = await pool.query(
    "SELECT * FROM canchas WHERE complejo_id = $1 ORDER BY id",
    [complejos[0].id]
  );
  res.json({ ...complejos[0], canchas });
});

app.put("/api/complejo", exigirAdmin, async (req, res) => {
  const { nombre, apertura, cierre } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: "El nombre no puede estar vacío." });
  }
  if (cierre < apertura) {
    return res.status(400).json({ error: "El cierre no puede ser antes de la apertura." });
  }
  const { rows } = await pool.query(
    "UPDATE complejos SET nombre = $1, apertura = $2, cierre = $3 WHERE id = $4 RETURNING *",
    [nombre.trim(), apertura, cierre, req.body.id]
  );
  res.json(rows[0]);
});

app.post("/api/canchas", exigirAdmin, async (req, res) => {
  const { complejoId, nombre, tipo } = req.body;
  if (![5, 7].includes(Number(tipo))) {
    return res.status(400).json({ error: "La cancha tiene que ser de 5 o de 7." });
  }
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: "Poné un nombre para la cancha." });
  }
  const { rows } = await pool.query(
    "INSERT INTO canchas (complejo_id, nombre, tipo) VALUES ($1, $2, $3) RETURNING *",
    [complejoId, nombre.trim(), Number(tipo)]
  );
  res.status(201).json(rows[0]);
});

app.delete("/api/canchas/:id", exigirAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM canchas WHERE id = $1", [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: "Esa cancha no existe." });
    }
    res.json({ eliminada: true });
  } catch (e) {
    // 23503 = hay turnos apuntando a esta cancha (ON DELETE RESTRICT).
    // No es un error del servidor: es una decisión que tiene que tomar
    // el admin, así que se lo contamos.
    if (e.code === "23503") {
      const { rows } = await pool.query(
        "SELECT COUNT(*)::int AS n FROM turnos WHERE cancha_id = $1 AND fecha >= CURRENT_DATE",
        [req.params.id]
      );
      return res.status(409).json({
        error: rows[0].n
          ? `Esa cancha tiene ${rows[0].n} turno(s) reservado(s). Eliminalos antes de darla de baja.`
          : "Esa cancha tiene turnos viejos asociados y no se puede eliminar.",
      });
    }
    throw e;
  }
});

app.use("/api/turnos", rutasTurnos);
app.use("/api/notificaciones", rutasNotificaciones);

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo del pedido no es JSON válido." });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});