// El tipo que declara el cliente (File.type, o el prefijo del data URL) no es
// confiable — es un dato que el propio cliente arma, y decide el
// Content-Type con el que luego se sirve el archivo de vuelta en
// /api/evidencia y /api/firmas. Se ignora y en su lugar se detecta el tipo
// real por los primeros bytes del archivo. Sin "server-only": es lógica pura,
// separada de storage.ts para poder probarla fuera del runtime de Next.
const DETECTORES_MIME: Array<{ mimeType: string; coincide: (b: Buffer) => boolean }> = [
  {
    mimeType: "image/png",
    coincide: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { mimeType: "image/jpeg", coincide: (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) },
  {
    mimeType: "image/webp",
    coincide: (b) =>
      b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export const TIPOS_FIRMA = ["image/png"] as const;

export function tipoImagenValido(buffer: Buffer, permitidos: readonly string[]): string | null {
  const mimeType = DETECTORES_MIME.find((d) => d.coincide(buffer))?.mimeType ?? null;
  return mimeType && permitidos.includes(mimeType) ? mimeType : null;
}
