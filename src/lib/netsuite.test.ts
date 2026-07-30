import { test } from "node:test";
import assert from "node:assert/strict";
import {
  percentEncode,
  construirPayloadOrdenCompra,
  construirPayloadOrdenVenta,
} from "./netsuite";

test("percentEncode escapa los caracteres reservados de OAuth 1.0a que encodeURIComponent no toca", () => {
  assert.equal(percentEncode("a b!c*d'e(f)g"), "a%20b%21c%2Ad%27e%28f%29g");
});

test("construirPayloadOrdenCompra arma entity/subsidiary/item y no incluye lote", () => {
  const payload = construirPayloadOrdenCompra({
    netsuiteVendorId: "123",
    netsuiteItemId: "456",
    netoKg: 980.5,
    precioUnitarioKg: 3.5,
    subsidiaryId: "14",
  });

  assert.deepEqual(payload, {
    entity: { id: "123" },
    subsidiary: { id: "14" },
    item: {
      items: [{ item: { id: "456" }, quantity: 980.5, rate: 3.5 }],
    },
  });
  const json = JSON.stringify(payload).toLowerCase();
  assert.equal(json.includes("lote"), false);
  assert.equal(json.includes("lot"), false);
});

test("construirPayloadOrdenVenta arma entity/subsidiary/item y no incluye lote", () => {
  const payload = construirPayloadOrdenVenta({
    netsuiteCustomerId: "789",
    netsuiteItemId: "456",
    pesoKg: 500,
    precioUnitarioKg: 4.2,
    subsidiaryId: "14",
  });

  assert.deepEqual(payload, {
    entity: { id: "789" },
    subsidiary: { id: "14" },
    item: {
      items: [{ item: { id: "456" }, quantity: 500, rate: 4.2 }],
    },
  });
  const json = JSON.stringify(payload).toLowerCase();
  assert.equal(json.includes("lote"), false);
  assert.equal(json.includes("lot"), false);
});
