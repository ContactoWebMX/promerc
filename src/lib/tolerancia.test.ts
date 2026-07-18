import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularDiferenciaPorcentual, excedeTolerancia } from "./tolerancia";

test("2000 vs 1980 kg (1% de diferencia) no excede un umbral de 3%", () => {
  assert.equal(excedeTolerancia(2000, 1980, 3), false);
  assert.ok(calcularDiferenciaPorcentual(2000, 1980) < 3);
});

test("2000 vs 1200 kg (40% de diferencia) excede un umbral de 3%", () => {
  assert.equal(excedeTolerancia(2000, 1200, 3), true);
});

test("diferencia exactamente en el umbral no excede (estrictamente mayor)", () => {
  assert.equal(excedeTolerancia(1000, 970, 3), false); // 3.0% exacto
});

test("peso vendido en 0 no revienta (evita división por cero)", () => {
  assert.equal(calcularDiferenciaPorcentual(0, 100), 0);
});
