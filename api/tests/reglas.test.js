import { describe, it, expect } from "vitest";
import {
  minutosParaElTurno,
  yaEmpezo,
  puedeCancelar,
  fechaValida,
  dentroDelHorario,
  cupoValido,
  limpiarJugadores,
  MINUTOS_MINIMOS,
} from "../src/reglas.js";
 
/* Un sábado cualquiera a las 20:40. Fijando el reloj, los tests dan
   siempre lo mismo, se corran hoy o dentro de dos años. */
const SABADO_20_40 = new Date(2026, 8, 5, 20, 40, 0);
const SABADO = "2026-09-05";
 
describe("cuánto falta para el turno", () => {
  it("cuenta los minutos que quedan", () => {
    expect(minutosParaElTurno(SABADO, 21, SABADO_20_40)).toBe(20);
    expect(minutosParaElTurno(SABADO, 22, SABADO_20_40)).toBe(80);
  });
 
  it("da negativo si el turno ya arrancó", () => {
    expect(minutosParaElTurno(SABADO, 20, SABADO_20_40)).toBe(-40);
  });
 
  it("reconoce el turno que ya empezó", () => {
    expect(yaEmpezo(SABADO, 20, SABADO_20_40)).toBe(true);
    expect(yaEmpezo(SABADO, 21, SABADO_20_40)).toBe(false);
    expect(yaEmpezo("2026-09-06", 9, SABADO_20_40)).toBe(false);
  });
});
 
describe("cancelar hasta 15 minutos antes", () => {
  it("deja cancelar con tiempo de sobra", () => {
    expect(puedeCancelar(SABADO, 22, SABADO_20_40)).toBe(true);
    expect(puedeCancelar("2026-09-12", 21, SABADO_20_40)).toBe(true);
  });
 
  it("deja cancelar justo en el límite de los 15", () => {
    const faltan15 = new Date(2026, 8, 5, 20, 45, 0);
    expect(minutosParaElTurno(SABADO, 21, faltan15)).toBe(MINUTOS_MINIMOS);
    expect(puedeCancelar(SABADO, 21, faltan15)).toBe(true);
  });
 
  it("corta un minuto después del límite", () => {
    const faltan14 = new Date(2026, 8, 5, 20, 46, 0);
    expect(puedeCancelar(SABADO, 21, faltan14)).toBe(false);
  });
 
  it("no deja cancelar un turno que ya empezó", () => {
    expect(puedeCancelar(SABADO, 20, SABADO_20_40)).toBe(false);
  });
});
 
describe("fechas", () => {
  it("acepta el formato del calendario", () => {
    expect(fechaValida("2026-09-05")).toBe(true);
  });
 
  it("rechaza días que no existen", () => {
    expect(fechaValida("2026-02-30")).toBe(false);
    expect(fechaValida("2026-13-01")).toBe(false);
  });
 
  it("rechaza otros formatos y vacíos", () => {
    expect(fechaValida("05/09/2026")).toBe(false);
    expect(fechaValida("")).toBe(false);
    expect(fechaValida(undefined)).toBe(false);
  });
});
 
describe("horario de atención", () => {
  it("acepta las horas dentro del rango, bordes incluidos", () => {
    expect(dentroDelHorario(20, 20, 22)).toBe(true);
    expect(dentroDelHorario(22, 20, 22)).toBe(true);
    expect(dentroDelHorario(21, 20, 22)).toBe(true);
  });
 
  it("rechaza las de afuera", () => {
    expect(dentroDelHorario(19, 20, 22)).toBe(false);
    expect(dentroDelHorario(23, 20, 22)).toBe(false);
  });
 
  it("rechaza lo que no es una hora entera", () => {
    expect(dentroDelHorario(20.5, 20, 22)).toBe(false);
    expect(dentroDelHorario("21", 20, 22)).toBe(false);
  });
});
 
describe("cupo por tipo de cancha", () => {
  it("en la de 7 entran hasta 7", () => {
    expect(cupoValido(7, 7)).toBe(true);
    expect(cupoValido(8, 7)).toBe(false);
  });
 
  it("en la de 5 entran hasta 5", () => {
    expect(cupoValido(5, 5)).toBe(true);
    expect(cupoValido(6, 5)).toBe(false);
  });
 
  it("el equipo incompleto es válido: se reserva primero y se completa después", () => {
    expect(cupoValido(1, 7)).toBe(true);
    expect(cupoValido(3, 5)).toBe(true);
  });
 
  it("sin jugadores no vale", () => {
    expect(cupoValido(0, 7)).toBe(false);
  });
});
 
describe("limpieza de la lista de jugadores", () => {
  it("saca espacios de más", () => {
    expect(limpiarJugadores(["  Gabi ", "Nico"])).toEqual(["Gabi", "Nico"]);
  });
 
  it("descarta vacíos y espacios sueltos", () => {
    expect(limpiarJugadores(["Gabi", "", "   ", "Nico"])).toEqual(["Gabi", "Nico"]);
  });
 
  it("aguanta que no venga una lista", () => {
    expect(limpiarJugadores(undefined)).toEqual([]);
    expect(limpiarJugadores("Gabi")).toEqual([]);
    expect(limpiarJugadores(null)).toEqual([]);
  });
});