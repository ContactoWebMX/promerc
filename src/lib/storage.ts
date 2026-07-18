import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// En despliegue standalone (cPanel), process.cwd() apunta a .next/standalone,
// una carpeta que se borra y regenera en cada build — guardar ahí perdería
// las fotos/firmas subidas. STORAGE_ROOT permite apuntar a una ruta estable
// fuera del directorio de build; sin configurar, cae en ./storage (dev).
const STORAGE_ROOT = process.env.STORAGE_ROOT
  ? path.resolve(process.env.STORAGE_ROOT)
  : path.join(/*turbopackIgnore: true*/ process.cwd(), "storage");

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function saveBuffer(buffer: Buffer, mimeType: string, subdir: string) {
  const ext = EXT_BY_MIME[mimeType] ?? "bin";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(STORAGE_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);

  return {
    rutaArchivo: path.join(subdir, filename),
    mimeType,
    tamanoBytes: buffer.byteLength,
  };
}

export async function saveUpload(file: File, subdir: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return saveBuffer(buffer, file.type || "application/octet-stream", subdir);
}

const DATA_URL_RE = /^data:(.+);base64,(.*)$/;

export async function saveDataUrl(dataUrl: string, subdir: string) {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) throw new Error("Imagen inválida.");
  const [, mimeType, base64] = match;
  return saveBuffer(Buffer.from(base64, "base64"), mimeType, subdir);
}

export function readStoredFile(rutaArchivo: string) {
  return readFile(path.join(STORAGE_ROOT, rutaArchivo));
}
