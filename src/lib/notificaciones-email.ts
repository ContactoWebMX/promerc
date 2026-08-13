import "server-only";
import { prisma } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";
import { resumenParaRol, TIPO_NOTIFICACION_LABELS } from "@/lib/notificaciones";
import type { TipoNotificacion, RoleUsuario } from "@/generated/prisma/enums";

const RUTA_POR_ENTIDAD: Record<string, string> = {
  Pesaje: "/pesajes",
  Compra: "/compras",
  Venta: "/ventas",
};

// La evidencia relevante depende del tipo de entidad — Compra no tiene
// evidencia propia, hereda la del Pesaje que la originó (ver spec, sección
// "Evidencia adjunta en el correo").
async function resolverEvidenciaAdjunta(entidad: string, entidadId: number) {
  if (entidad === "Pesaje") {
    return prisma.evidencia.findFirst({
      where: { pesajeId: entidadId, tipo: "TICKET_BASCULA" },
      orderBy: { createdAt: "desc" },
    });
  }
  if (entidad === "Compra") {
    const compra = await prisma.compra.findUnique({ where: { id: entidadId } });
    if (!compra) return null;
    return prisma.evidencia.findFirst({
      where: { pesajeId: compra.pesajeId, tipo: "TICKET_BASCULA" },
      orderBy: { createdAt: "desc" },
    });
  }
  if (entidad === "Venta") {
    return prisma.evidencia.findFirst({
      where: { ventaId: entidadId, tipo: "COMPROBANTE_CLIENTE" },
      orderBy: { createdAt: "desc" },
    });
  }
  return null;
}

const ETIQUETAS_CAMPO: Record<string, string> = {
  folioTicket: "Folio",
  ubicacionNombre: "Ubicación",
  proveedorNombre: "Proveedor",
  clienteNombre: "Cliente",
  articuloNombre: "Artículo",
  netoKg: "Neto (kg)",
  pesoVendidoKg: "Peso vendido (kg)",
  pesoReportadoClienteKg: "Peso reportado (kg)",
  diferenciaKg: "Diferencia (kg)",
  umbralPct: "Umbral de tolerancia (%)",
  precioUnitarioKg: "Precio por kg ($)",
  importeTotal: "Importe total ($)",
};

// Mismo orden en el que aparecen en el diccionario de arriba — cada tipo de
// evento solo trae un subconjunto de estas llaves en su resumen.
const ORDEN_CAMPOS = Object.keys(ETIQUETAS_CAMPO);

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tablaResumen(resumen: Record<string, unknown>): string {
  const filas = ORDEN_CAMPOS.filter((campo) => campo in resumen)
    .map(
      (campo) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;">${ETIQUETAS_CAMPO[campo]}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(resumen[campo])}</td></tr>`,
    )
    .join("");
  return `<table>${filas}</table>`;
}

export async function armarCorreoNotificacion(
  tipo: TipoNotificacion,
  entidad: string,
  entidadId: number,
  resumenCompleto: Record<string, unknown>,
  destinatarioRole: RoleUsuario,
): Promise<{ subject: string; html: string; attachments: { filename: string; content: Buffer }[] }> {
  const resumen = resumenParaRol(resumenCompleto, tipo, destinatarioRole);
  const titulo = TIPO_NOTIFICACION_LABELS[tipo];
  const referencia = String(resumen.folioTicket ?? resumen.clienteNombre ?? `#${entidadId}`);
  const rutaBase = RUTA_POR_ENTIDAD[entidad] ?? "";
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#4338ca;">${titulo}</h2>
      ${tablaResumen(resumen)}
      <p style="margin-top:16px;">
        <a href="${appUrl}${rutaBase}/${entidadId}" style="background:#4338ca;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Ver en PROMERC</a>
      </p>
    </div>
  `;

  const evidencia = await resolverEvidenciaAdjunta(entidad, entidadId);
  let attachments: { filename: string; content: Buffer }[] = [];
  if (evidencia) {
    try {
      attachments = [
        {
          filename: `evidencia.${evidencia.mimeType.split("/")[1] ?? "bin"}`,
          content: await readStoredFile(evidencia.rutaArchivo),
        },
      ];
    } catch (error) {
      console.error(`No se pudo adjuntar evidencia ${evidencia.rutaArchivo}:`, error);
    }
  }

  return { subject: `${titulo} — ${referencia}`, html, attachments };
}
