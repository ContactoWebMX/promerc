import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const EXT_TO_MEDIA_TYPE: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

export type TicketExtraido = {
  grossKg: number | null;
  pesadorNombre: string | null;
  clienteDestinoReferencia: string | null;
  observaciones: string | null;
};

export async function leerTicketBascula(
  buffer: Buffer,
  mimeType: string,
): Promise<TicketExtraido> {
  const mediaType = EXT_TO_MEDIA_TYPE[mimeType];
  if (!mediaType) {
    throw new Error(`Tipo de imagen no soportado para OCR: ${mimeType}`);
  }

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            grossKg: { type: ["number", "null"] },
            pesadorNombre: { type: ["string", "null"] },
            clienteDestinoReferencia: { type: ["string", "null"] },
            observaciones: { type: ["string", "null"] },
          },
          required: [
            "grossKg",
            "pesadorNombre",
            "clienteDestinoReferencia",
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
            text: "Esta es la foto de un ticket de báscula de una recolección de material de desperdicio (cartón, etc). Extrae: el peso bruto/cargado en kg (GROSS, puede estar escrito a mano o impreso — usa el peso final, no la tara), el nombre de quien pesó (pesador/operador de báscula), el cliente o destino al que va el material (si aparece), y cualquier observación relevante escrita en el ticket. Si un dato no aparece o no es legible, usa null para ese campo.",
          },
        ],
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Respuesta inesperada del modelo de visión.");
  }
  return JSON.parse(block.text) as TicketExtraido;
}
