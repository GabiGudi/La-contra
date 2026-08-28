import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  arrancarServidor,
  apagarServidor,
  prepararBase,
  pedir,
  reservar,
  equipo,
  entrarComoAdmin,
  turnoDirecto,
  fechaLocal,
  MANANA,
} from "./ayuda.js";
 
let canchaF7;
let canchaF5;
let complejoId;
 
beforeAll(arrancarServidor);
afterAll(apagarServidor);
 
beforeEach(async () => {
  ({ complejoId, canchaF7, canchaF5 } = await prepararBase());
});
 
describe("reservar un turno", () => {
  it("guarda el turno y devuelve un código de 4 dígitos", async () => {
    const { estado, datos } = await reservar({ canchaId: canchaF7 });
    expect(estado).toBe(201);
    expect(datos.codigo).toMatch(/^\d{4}$/);
    expect(datos.estado).toBe("esperando");
  });
 
  it("con los dos equipos queda confirmado", async () => {
    const { datos } = await reservar({
      canchaId: canchaF7,
      equipoVisitante: equipo("Los Otros", 5, ""),
    });
    expect(datos.estado).toBe("confirmado");
 
    const { datos: lista } = await pedir(`/api/turnos?desde=${MANANA()}&hasta=${MANANA()}`);
    expect(lista[0].visitante.nombre).toBe("Los Otros");
    expect(lista[0].visitante.jugadores).toHaveLength(5);
  });
 
  it("no deja reservar dos veces la misma cancha a la misma hora", async () => {
    await reservar({ canchaId: canchaF7 });
    const segundo = await reservar({ canchaId: canchaF7, equipoLocal: equipo("Los Otros") });
 
    expect(segundo.estado).toBe(409);
    expect(segundo.datos.error).toMatch(/ya está reservado/i);
  });
 
  it("la misma hora en otra cancha sí se puede", async () => {
    await reservar({ canchaId: canchaF7 });
    const otra = await reservar({ canchaId: canchaF5, equipoLocal: equipo("Los Otros") });
    expect(otra.estado).toBe(201);
  });
 
  it("aguanta dos reservas simultáneas: entra una sola", async () => {
    const intentos = Array.from({ length: 5 }, (_, i) =>
      reservar({ canchaId: canchaF7, equipoLocal: equipo("Equipo " + i) })
    );
    const respuestas = await Promise.all(intentos);
 
    expect(respuestas.filter((r) => r.estado === 201)).toHaveLength(1);
    expect(respuestas.filter((r) => r.estado === 409)).toHaveLength(4);
  });
});
 
describe("validaciones al reservar", () => {
  it("pide nombre de equipo, contacto y al menos un jugador", async () => {
    const sinNombre = await reservar({ canchaId: canchaF7, equipoLocal: equipo("", 3) });
    expect(sinNombre.estado).toBe(400);
 
    const sinContacto = await reservar({ canchaId: canchaF7, equipoLocal: equipo("X", 3, "") });
    expect(sinContacto.estado).toBe(400);
 
    const sinJugadores = await reservar({ canchaId: canchaF7, equipoLocal: equipo("X", 0) });
    expect(sinJugadores.estado).toBe(400);
    expect(sinJugadores.datos.error).toMatch(/al menos un jugador/i);
  });
 
  it("en la cancha de 7 entran 7 jugadores, no 8", async () => {
    const justos = await reservar({ canchaId: canchaF7, equipoLocal: equipo("Completo", 7) });
    expect(justos.estado).toBe(201);
 
    const demas = await reservar({
      canchaId: canchaF7,
      hora: 21,
      equipoLocal: equipo("Demasiados", 8),
    });
    expect(demas.estado).toBe(400);
    expect(demas.datos.error).toMatch(/hasta 7/);
  });
 
  it("en la cancha de 5 el tope baja a 5", async () => {
    const seis = await reservar({ canchaId: canchaF5, equipoLocal: equipo("Seis", 6) });
    expect(seis.estado).toBe(400);
    expect(seis.datos.error).toMatch(/hasta 5/);
  });
 
  it("el equipo incompleto se guarda igual", async () => {
    const { estado } = await reservar({ canchaId: canchaF7, equipoLocal: equipo("Faltan", 2) });
    expect(estado).toBe(201);
  });
 
  it("rechaza horarios fuera de la atención del complejo", async () => {
    const temprano = await reservar({ canchaId: canchaF7, hora: 9 });
    expect(temprano.estado).toBe(400);
    expect(temprano.datos.error).toMatch(/abre de/i);
  });
 
  it("rechaza turnos en el pasado", async () => {
    const ayer = await reservar({ canchaId: canchaF7, fecha: fechaLocal(-1) });
    expect(ayer.estado).toBe(400);
    expect(ayer.datos.error).toMatch(/ya pasó/i);
  });
 
  it("rechaza fechas inválidas y canchas inexistentes", async () => {
    const fea = await reservar({ canchaId: canchaF7, fecha: "05/09/2026" });
    expect(fea.estado).toBe(400);
 
    const fantasma = await reservar({ canchaId: 9999 });
    expect(fantasma.estado).toBe(404);
  });
});
 
describe("anotarse de contra", () => {
  it("confirma el partido y devuelve otro código", async () => {
    const { datos: turno } = await reservar({ canchaId: canchaF7 });
 
    const { estado, datos } = await pedir(`/api/turnos/${turno.id}/contra`, {
      metodo: "POST",
      cuerpo: { equipo: equipo("Los Otros", 4, "3564 22-2222") },
    });
 
    expect(estado).toBe(200);
    expect(datos.codigo).toMatch(/^\d{4}$/);
    expect(datos.codigo).not.toBe(turno.codigo);
  });
 
  it("no deja anotarse dos veces", async () => {
    const { datos: turno } = await reservar({ canchaId: canchaF7 });
    await pedir(`/api/turnos/${turno.id}/contra`, {
      metodo: "POST",
      cuerpo: { equipo: equipo("Primero") },
    });
 
    const segundo = await pedir(`/api/turnos/${turno.id}/contra`, {
      metodo: "POST",
      cuerpo: { equipo: equipo("Segundo") },
    });
 
    expect(segundo.estado).toBe(409);
    expect(segundo.datos.error).toMatch(/ya tiene contra/i);
  });
 
  it("con dos equipos anotándose a la vez, entra uno solo", async () => {
    const { datos: turno } = await reservar({ canchaId: canchaF7 });
 
    const respuestas = await Promise.all(
      ["Rojo", "Azul", "Verde"].map((n) =>
        pedir(`/api/turnos/${turno.id}/contra`, { metodo: "POST", cuerpo: { equipo: equipo(n) } })
      )
    );
 
    expect(respuestas.filter((r) => r.estado === 200)).toHaveLength(1);
    expect(respuestas.filter((r) => r.estado === 409)).toHaveLength(2);
  });
 
  it("respeta el cupo de la cancha", async () => {
    const { datos: turno } = await reservar({ canchaId: canchaF5 });
    const { estado } = await pedir(`/api/turnos/${turno.id}/contra`, {
      metodo: "POST",
      cuerpo: { equipo: equipo("Seis", 6) },
    });
    expect(estado).toBe(400);
  });
});
 
describe("mi turno", () => {
  it("lo encuentra con el código del local", async () => {
    const { datos: turno } = await reservar({ canchaId: canchaF7 });
    const { estado, datos } = await pedir("/api/turnos/codigo/" + turno.codigo);
 
    expect(estado).toBe(200);
    expect(datos.es_local).toBe(true);
    expect(datos.local.nombre).toBe("Los Pibes");
  });
 
  it("lo encuentra también con el código del visitante", async () => {
    const { datos: turno } = await reservar({ canchaId: canchaF7 });
    const { datos: contra } = await pedir(`/api/turnos/${turno.id}/contra`, {
      metodo: "POST",
      cuerpo: { equipo: equipo("Los Otros") },
    });
 
    const { datos } = await pedir("/api/turnos/codigo/" + contra.codigo);
    expect(datos.es_local).toBe(false);
    expect(datos.visitante.nombre).toBe("Los Otros");
  });
 
  it("con un código que no existe da 404", async () => {
    const { estado } = await pedir("/api/turnos/codigo/0000");
    expect(estado).toBe(404);
  });
 
  it("el listado público no reparte los códigos", async () => {
    await reservar({ canchaId: canchaF7 });
    const { datos } = await pedir(`/api/turnos?desde=${MANANA()}&hasta=${MANANA()}`);
 
    expect(datos[0].codigo).toBeUndefined();
    expect(datos[0].codigo_visitante).toBeUndefined();
  });
});
 
describe("cancelar", () => {
  it("el local cancela y el turno desaparece", async () => {
    const { datos: turno } = await reservar({ canchaId: canchaF7 });
 
    const { estado, datos } = await pedir("/api/turnos/codigo/" + turno.codigo, { metodo: "DELETE" });
    expect(estado).toBe(200);
    expect(datos.cancelado).toBe("turno");
 
    const { datos: lista } = await pedir(`/api/turnos?desde=${MANANA()}&hasta=${MANANA()}`);
    expect(lista).toHaveLength(0);
  });
 
  it("cancelado el turno, el horario queda libre para otro equipo", async () => {
    const { datos: turno } = await reservar({ canchaId: canchaF7 });
    await pedir("/api/turnos/codigo/" + turno.codigo, { metodo: "DELETE" });
 
    const otro = await reservar({ canchaId: canchaF7, equipoLocal: equipo("Los Nuevos") });
    expect(otro.estado).toBe(201);
  });
 
  it("la contra se baja y el turno vuelve a buscar rival", async () => {
    const { datos: turno } = await reservar({ canchaId: canchaF7 });
    const { datos: contra } = await pedir(`/api/turnos/${turno.id}/contra`, {
      metodo: "POST",
      cuerpo: { equipo: equipo("Los Otros") },
    });
 
    const { datos } = await pedir("/api/turnos/codigo/" + contra.codigo, { metodo: "DELETE" });
    expect(datos.cancelado).toBe("contra");
 
    const { datos: lista } = await pedir(`/api/turnos?desde=${MANANA()}&hasta=${MANANA()}`);
    expect(lista[0].estado).toBe("esperando");
    expect(lista[0].visitante).toBeNull();
  });
 
  it("no se puede cancelar dentro de los 15 minutos", async () => {
    // Un turno que arrancó hace un rato: la ventana ya está cerrada.
    const haceUnRato = new Date();
    haceUnRato.setHours(haceUnRato.getHours() - 1);
 
    await turnoDirecto({
      canchaId: canchaF7,
      fecha: fechaLocal(0),
      hora: haceUnRato.getHours(),
      codigo: "7777",
    });
 
    const { estado, datos } = await pedir("/api/turnos/codigo/7777", { metodo: "DELETE" });
    expect(estado).toBe(409);
    expect(datos.error).toMatch(/15 minutos/);
  });
 
  it("con un código inexistente da 404", async () => {
    const { estado } = await pedir("/api/turnos/codigo/0000", { metodo: "DELETE" });
    expect(estado).toBe(404);
  });
});
 
describe("permisos del admin", () => {
  it("sin token no se listan los turnos del panel ni se borra nada", async () => {
    const { datos: turno } = await reservar({ canchaId: canchaF7 });
 
    const listado = await pedir("/api/turnos/admin");
    expect(listado.estado).toBe(401);
 
    const borrado = await pedir("/api/turnos/" + turno.id, { metodo: "DELETE" });
    expect(borrado.estado).toBe(401);
  });
 
  it("con un token inventado tampoco", async () => {
    const { estado } = await pedir("/api/turnos/admin", { token: "cualquier.cosa" });
    expect(estado).toBe(401);
  });
 
  it("con la clave correcta entra y ve los códigos", async () => {
    await reservar({ canchaId: canchaF7 });
    const token = await entrarComoAdmin();
 
    const { estado, datos } = await pedir("/api/turnos/admin", { token });
    expect(estado).toBe(200);
    expect(datos[0].codigo).toMatch(/^\d{4}$/);
    expect(datos[0].cancha).toBe("Cancha 1");
  });
 
  it("con la clave incorrecta no entra", async () => {
    const { estado } = await pedir("/api/login", { metodo: "POST", cuerpo: { clave: "otra" } });
    expect(estado).toBe(401);
  });
 
  it("el admin borra turnos sin el límite de los 15 minutos", async () => {
    const id = await turnoDirecto({
      canchaId: canchaF7,
      fecha: fechaLocal(0),
      hora: new Date().getHours(),
      codigo: "8888",
    });
 
    const token = await entrarComoAdmin();
    const { estado } = await pedir("/api/turnos/" + id, { metodo: "DELETE", token });
    expect(estado).toBe(200);
  });
 
  it("filtra por estado y por día", async () => {
    await reservar({ canchaId: canchaF7 });
    await reservar({
      canchaId: canchaF5,
      hora: 21,
      equipoVisitante: equipo("Rival", 3, ""),
      equipoLocal: equipo("Armado"),
    });
    const token = await entrarComoAdmin();
 
    const esperando = await pedir("/api/turnos/admin?estado=esperando", { token });
    expect(esperando.datos).toHaveLength(1);
 
    const confirmados = await pedir("/api/turnos/admin?estado=confirmado", { token });
    expect(confirmados.datos).toHaveLength(1);
 
    const otroDia = await pedir(`/api/turnos/admin?desde=${fechaLocal(5)}&hasta=${fechaLocal(5)}`, { token });
    expect(otroDia.datos).toHaveLength(0);
  });
});
 
describe("canchas del admin", () => {
  it("agrega una cancha de 5 o de 7 y rechaza otros tipos", async () => {
    const token = await entrarComoAdmin();
 
    const buena = await pedir("/api/canchas", {
      metodo: "POST",
      token,
      cuerpo: { complejoId, nombre: "Cancha 3", tipo: 5 },
    });
    expect(buena.estado).toBe(201);
 
    const mala = await pedir("/api/canchas", {
      metodo: "POST",
      token,
      cuerpo: { complejoId, nombre: "Cancha 4", tipo: 9 },
    });
    expect(mala.estado).toBe(400);
  });
 
  it("no deja borrar una cancha con turnos, y explica por qué", async () => {
    await reservar({ canchaId: canchaF7 });
    const token = await entrarComoAdmin();
 
    const { estado, datos } = await pedir("/api/canchas/" + canchaF7, { metodo: "DELETE", token });
    expect(estado).toBe(409);
    expect(datos.error).toMatch(/turno\(s\) reservado/i);
  });
 
  it("una cancha sin turnos se borra sin problema", async () => {
    const token = await entrarComoAdmin();
    const { estado } = await pedir("/api/canchas/" + canchaF5, { metodo: "DELETE", token });
    expect(estado).toBe(200);
  });
});