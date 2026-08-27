import fs from "node:fs";
import path from "node:path";
import { pool } from "./db.js";

const CARPETA = path.resolve("db");

async function migrar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migraciones (
      archivo TEXT PRIMARY KEY,
      fecha   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await pool.query("SELECT archivo FROM migraciones");
  const aplicadas = rows.map((r) => r.archivo);
  const archivos = fs.readdirSync(CARPETA).filter((f) => f.endsWith(".sql")).sort();

  for (const archivo of archivos) {
    if (aplicadas.includes(archivo)) continue;
    const sql = fs.readFileSync(path.join(CARPETA, archivo), "utf8");
    await pool.query(sql);
    await pool.query("INSERT INTO migraciones (archivo) VALUES ($1)", [archivo]);
    console.log("Aplicada:", archivo);
  }

  const { rows: hay } = await pool.query("SELECT id FROM complejos LIMIT 1");
  if (hay.length === 0) {
    const { rows: nuevo } = await pool.query(
      "INSERT INTO complejos (nombre, apertura, cierre) VALUES ($1, $2, $3) RETURNING id",
      ["La Contra", 17, 23]
    );
    await pool.query(
      "INSERT INTO canchas (complejo_id, nombre, tipo) VALUES ($1, $2, $3)",
      [nuevo[0].id, "Cancha 1", 7]
    );
    console.log("Complejo inicial creado.");
  }

  await pool.end();
  console.log("Listo.");
}

migrar().catch((e) => {
  console.error("Falló la migración:", e.message);
  process.exit(1);
});