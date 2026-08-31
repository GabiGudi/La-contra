import { Router } from "express";
import { pool } from "../db.js";
import { exigirAdmin } from "../auth.js";

export const rutasNotificaciones = Router();

rutasNotificaciones.use(exigirAdmin);

/** Últimos avisos, con la cantidad de no leídos. */
rutasNotificaciones.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, tipo, texto, turno_id, leida, creado_en
       FROM notificaciones
      ORDER BY creado_en DESC
      LIMIT 50`
  );
  const { rows: cuenta } = await pool.query(
    "SELECT COUNT(*)::int AS nuevas FROM notificaciones WHERE NOT leida"
  );
  res.json({ nuevas: cuenta[0].nuevas, lista: rows });
});

/** Solo el contador: es lo que consulta la campanita cada tanto. */
rutasNotificaciones.get("/nuevas", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS nuevas FROM notificaciones WHERE NOT leida"
  );
  res.json({ nuevas: rows[0].nuevas });
});

rutasNotificaciones.post("/leidas", async (req, res) => {
  await pool.query("UPDATE notificaciones SET leida = true WHERE NOT leida");
  res.json({ ok: true });
});

rutasNotificaciones.delete("/", async (req, res) => {
  await pool.query("DELETE FROM notificaciones");
  res.json({ ok: true });
});