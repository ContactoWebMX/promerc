// Lectura de ticket 100% local (Tesseract.js/WASM, corre en el navegador del
// celular) — no llama a Claude ni a ningún servicio externo. Los assets
// (worker, motor WASM y datos de idioma) están self-hosted en
// /public/tesseract/ para que la única red que se necesite sea la que ya
// hace falta para cargar la app; el motor y el idioma se cachean en
// IndexedDB después del primer uso, así que un segundo ticket se puede leer
// incluso sin señal en absoluto.
//
// Respaldo intencionalmente más simple que el OCR con Claude: solo extrae
// peso y folio por patrones de texto, no pesador/cliente/observaciones.
// Sirve para no depender de la nube, no para igualar su precisión —
// revisar siempre los valores antes de guardar.
import { createWorker, OEM, type Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng", OEM.LSTM_ONLY, {
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract/tesseract-core-lstm.wasm.js",
      langPath: "/tesseract/lang-data",
    });
  }
  return workerPromise;
}

export type TicketOffline = {
  pesoKg: number | null;
  folioTicket: string | null;
  textoCrudo: string;
};

export async function leerTicketOffline(file: File): Promise<TicketOffline> {
  const worker = await getWorker();
  const { data } = await worker.recognize(file);
  return {
    pesoKg: extraerPeso(data.text),
    folioTicket: extraerFolio(data.text),
    textoCrudo: data.text,
  };
}

// ponytail: heurística de texto plano (el número más grande visible suele
// ser el peso en kg), no un parser real del layout del ticket — falla si el
// folio o un código tienen más dígitos que el peso. Subir de nivel con un
// parser posicional (coordenadas de cada palabra, que Tesseract sí expone
// en data.words) si en la práctica confunde folio con peso seguido.
function extraerPeso(texto: string): number | null {
  const conKg = texto.match(/(\d{2,6}(?:[.,]\d{1,2})?)\s*k\s*g/i);
  if (conKg) return parseFloat(conKg[1].replace(",", "."));

  const numeros = [...texto.matchAll(/\b(\d{3,6}(?:[.,]\d{1,2})?)\b/g)].map((m) =>
    parseFloat(m[1].replace(",", ".")),
  );
  if (numeros.length === 0) return null;
  return numeros.reduce((max, n) => (n > max ? n : max), numeros[0]);
}

function extraerFolio(texto: string): string | null {
  const conEtiqueta = texto.match(
    /(?:folio|ticket|n[uú]m(?:ero)?|no)[\s:.#-]*([A-Z0-9-]{3,15})/i,
  );
  return conEtiqueta ? conEtiqueta[1] : null;
}
