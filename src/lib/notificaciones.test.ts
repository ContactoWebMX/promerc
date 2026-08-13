import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDestinatarios, resumenParaRol } from "./notificaciones";

test("resolverDestinatarios combina canales del mismo usuario con OR (dos reglas, una in-app y otra correo)", () => {
  const resultado = resolverDestinatarios([
    { usuarioId: 1, canalInApp: true, canalCorreo: false },
    { usuarioId: 1, canalInApp: false, canalCorreo: true },
  ]);
  assert.deepEqual(resultado.get(1), { inApp: true, correo: true });
});

test("resolverDestinatarios mantiene usuarios distintos separados", () => {
  const resultado = resolverDestinatarios([
    { usuarioId: 1, canalInApp: true, canalCorreo: false },
    { usuarioId: 2, canalInApp: false, canalCorreo: true },
  ]);
  assert.deepEqual(resultado.get(1), { inApp: true, correo: false });
  assert.deepEqual(resultado.get(2), { inApp: false, correo: true });
});

test("resolverDestinatarios con una lista vacía regresa un mapa vacío", () => {
  const resultado = resolverDestinatarios([]);
  assert.equal(resultado.size, 0);
});

test("resumenParaRol oculta precioUnitarioKg e importeTotal para OPERADOR en COMPRA_REGISTRADA", () => {
  const resumen = { folioTicket: "7654", proveedorNombre: "ITALIKA", netoKg: 980, precioUnitarioKg: 3, importeTotal: 2940 };
  const resultado = resumenParaRol(resumen, "COMPRA_REGISTRADA", "OPERADOR");
  assert.equal("precioUnitarioKg" in resultado, false);
  assert.equal("importeTotal" in resultado, false);
  assert.equal(resultado.folioTicket, "7654");
});

test("resumenParaRol oculta precio en VENTA_CERRADA para OPERADOR pero no para ADMIN", () => {
  const resumen = { clienteNombre: "ABC", pesoReportadoClienteKg: 500, precioUnitarioKg: 2, importeTotal: 1000, diferenciaKg: 0 };
  const paraOperador = resumenParaRol(resumen, "VENTA_CERRADA", "OPERADOR");
  const paraAdmin = resumenParaRol(resumen, "VENTA_CERRADA", "ADMIN");
  assert.equal("precioUnitarioKg" in paraOperador, false);
  assert.equal(paraAdmin.precioUnitarioKg, 2);
});

test("resumenParaRol no quita nada en tipos sin precio (PESAJE_COMPLETADO)", () => {
  const resumen = { folioTicket: "7654", ubicacionNombre: "ITALIKA", proveedorNombre: "ITALIKA", articuloNombre: "CARTON", netoKg: 980 };
  const resultado = resumenParaRol(resumen, "PESAJE_COMPLETADO", "OPERADOR");
  assert.deepEqual(resultado, resumen);
});
