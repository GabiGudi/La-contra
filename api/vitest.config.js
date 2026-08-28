import { defineConfig } from "vitest/config";
import fs from "node:fs";

/* Lee .env.test y lo mete en el entorno de los tests.
   Sin esto, los tests correrían contra la base de desarrollo
   y te borrarían los turnos de verdad. */
const env = {};
if (fs.existsSync(".env.test")) {
  for (const linea of fs.readFileSync(".env.test", "utf8").split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const corte = limpia.indexOf("=");
    if (corte === -1) continue;
    env[limpia.slice(0, corte).trim()] = limpia.slice(corte + 1).trim();
  }
}

export default defineConfig({
  test: {
    env,
    // Los archivos comparten una sola base, así que van de a uno.
    fileParallelism: false,
  },
});