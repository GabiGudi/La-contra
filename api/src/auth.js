import crypto from "node:crypto";

const HORAS = 12;

const firmar = (datos) =>
  crypto.createHmac("sha256", process.env.SECRETO_TOKEN).update(datos).digest("base64url");

/** Token propio: son veinte líneas y se entiende completo. */
export function emitirToken() {
  const cuerpo = Buffer.from(JSON.stringify({ vence: Date.now() + HORAS * 3600 * 1000 })).toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
}

function tokenValido(token) {
  if (typeof token !== "string" || !token.includes(".")) return false;
  const [cuerpo, firma] = token.split(".");

  const esperada = Buffer.from(firmar(cuerpo));
  const recibida = Buffer.from(String(firma));
  if (esperada.length !== recibida.length) return false;
  if (!crypto.timingSafeEqual(esperada, recibida)) return false;

  try {
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8"));
    return datos.vence > Date.now();
  } catch {
    return false;
  }
}

/** Middleware: corta la request si no vino un token válido. */
export function exigirAdmin(req, res, next) {
  const cabecera = req.get("authorization") || "";
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : null;

  if (!token || !tokenValido(token)) {
    return res.status(401).json({ error: "Necesitás entrar como administrador." });
  }
  next();
}