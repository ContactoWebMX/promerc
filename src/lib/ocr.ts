import "server-only";
import Anthropic, { APIConnectionError, AuthenticationError, PermissionDeniedError } from "@anthropic-ai/sdk";

const client = new Anthropic();

export type OcrErrorReason = "sin_configurar" | "red" | "formato" | "desconocido";

export class OcrError extends Error {
  reason: OcrErrorReason;
  constructor(reason: OcrErrorReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

function clasificarError(err: unknown): OcrError {
  if (err instanceof OcrError) return err;
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return new OcrError(
      "sin_configurar",
      "El servicio de lectura automática no está configurado (ANTHROPIC_API_KEY). Llena los campos manualmente.",
    );
  }
  if (err instanceof APIConnectionError) {
    return new OcrError(
      "red",
      "No se pudo contactar al servicio de lectura — revisa tu conexión e intenta de nuevo, o llena los campos manualmente.",
    );
  }
  return new OcrError(
    "desconocido",
    "No se pudo leer el ticket automáticamente. Llena los campos manualmente.",
  );
}

const EXT_TO_MEDIA_TYPE: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

export type TicketExtraido = {
  folioTicket: string | null;
  idOperacionBascula: string | null;
  fecha: string | null; // YYYY-MM-DD impresa en el ticket
  hora: string | null; // HH:mm impresa en el ticket
  pesoKg: number | null; // peso impreso — tara o bruto, según el ticket
  pesadorNombre: string | null;
  observaciones: string | null;
};

export async function leerTicketBascula(
  buffer: Buffer,
  mimeType: string,
): Promise<TicketExtraido> {
  const mediaType = EXT_TO_MEDIA_TYPE[mimeType];
  if (!mediaType) {
    throw new OcrError("formato", `Tipo de imagen no soportado para OCR: ${mimeType}`);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new OcrError(
      "sin_configurar",
      "El servicio de lectura automática no está configurado (ANTHROPIC_API_KEY). Llena los campos manualmente.",
    );
  }

  try {
    // Timeout corto a propósito: esto corre junto a la báscula, a veces con
    // señal mala. Si Claude no responde rápido, el operador debe poder
    // seguir llenando el formulario a mano sin quedarse esperando — ver
    // OcrError("red", ...) más abajo, que es a donde cae este timeout.
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              folioTicket: { type: ["string", "null"] },
              idOperacionBascula: { type: ["string", "null"] },
              fecha: { type: ["string", "null"] },
              hora: { type: ["string", "null"] },
              pesoKg: { type: ["number", "null"] },
              pesadorNombre: { type: ["string", "null"] },
              observaciones: { type: ["string", "null"] },
            },
            required: [
              "folioTicket",
              "idOperacionBascula",
              "fecha",
              "hora",
              "pesoKg",
              "pesadorNombre",
              "observaciones",
            ],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") },
            },
            {
              type: "text",
              text: "Esta es la foto de un ticket de báscula de una recolección de material de desperdicio (cartón, etc). Puede ser el ticket de la tara (camión vacío) o el del peso cargado — extrae lo que encuentres: el folio o número de ticket impreso, un ID de operación/báscula si aparece uno distinto del folio, la fecha (YYYY-MM-DD) y hora (HH:mm) impresas, el peso en kg que se muestra (escrito a mano o impreso — el único peso relevante de este ticket), el nombre de quien pesó (pesador/operador de báscula), y cualquier observación relevante escrita en el ticket. Es preferible dejar un campo en null a adivinar: úsalo cada vez que el dato no aparezca, esté tachado/incompleto, o no puedas leerlo con certeza — un valor equivocado es peor que un campo vacío, porque alguien lo va a dar por bueno sin revisarlo. No repitas ni confundas un campo con otro (ej. no pongas el folio en idOperacionBascula ni viceversa si no estás seguro de cuál es cuál).",
            },
          ],
        },
      ],
    }, { timeout: 12_000 });

    const block = response.content[0];
    if (block.type !== "text") {
      throw new OcrError("desconocido", "Respuesta inesperada del modelo de visión.");
    }
    return JSON.parse(block.text) as TicketExtraido;
  } catch (err) {
    throw clasificarError(err);
  }
}

export function combinarFechaHoraTicket(
  fecha?: string | null,
  hora?: string | null,
): Date | null {
  if (!fecha) return null;
  const iso = `${fecha}T${hora || "00:00"}:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
