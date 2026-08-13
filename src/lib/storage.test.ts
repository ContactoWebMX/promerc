import { test } from "node:test";
import assert from "node:assert/strict";
import { tipoImagenValido, TIPOS_FOTO, TIPOS_FIRMA } from "./image-type";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP", "ascii"),
  Buffer.from([0, 0]),
]);

test("tipoImagenValido detecta PNG/JPEG/WEBP por sus primeros bytes, sin importar lo que declare el llamador", () => {
  assert.equal(tipoImagenValido(PNG, TIPOS_FOTO), "image/png");
  assert.equal(tipoImagenValido(JPEG, TIPOS_FOTO), "image/jpeg");
  assert.equal(tipoImagenValido(WEBP, TIPOS_FOTO), "image/webp");
});

test("tipoImagenValido rechaza contenido que no es ninguna de las firmas conocidas (ej. HTML disfrazado de imagen)", () => {
  const html = Buffer.from("<script>alert(1)</script>", "ascii");
  assert.equal(tipoImagenValido(html, TIPOS_FOTO), null);
});

test("tipoImagenValido respeta la lista de permitidos aunque el contenido sea una imagen real", () => {
  // Las firmas digitales solo aceptan PNG (lo que exporta el signature-pad) —
  // un JPEG válido no debe colarse ahí aunque sea una imagen genuina.
  assert.equal(tipoImagenValido(JPEG, TIPOS_FIRMA), null);
  assert.equal(tipoImagenValido(PNG, TIPOS_FIRMA), "image/png");
});
