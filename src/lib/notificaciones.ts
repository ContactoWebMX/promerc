// Lógica pura, sin dependencias de servidor — importable desde acciones de
// servidor, route handlers y componentes cliente por igual (mismo criterio
// que src/lib/tolerancia.ts). No lleva "server-only": ese import rompe bajo
// tsx --test (ver Global Constraints de este plan).
import type { TipoNotificacion, RoleUsuario } from "@/generated/prisma/enums";

export const TIPO_NOTIFICACION_LABELS: Record<TipoNotificacion, string> = {
  PESAJE_COMPLETADO: "Pesaje completado",
  COMPRA_REGISTRADA: "Compra registrada",
  VENTA_CERRADA: "Venta cerrada",
  VENTA_REQUIERE_APROBACION: "Requiere tu aprobación",
};

export type ResumenPesajeCompletado = {
  folioTicket: string;
  ubicacionNombre: string;
  proveedorNombre: string;
  articuloNombre: string;
  netoKg: number;
};

export type ResumenCompraRegistrada = {
  folioTicket: string;
  proveedorNombre: string;
  netoKg: number;
  precioUnitarioKg: number;
  importeTotal: number;
};

export type ResumenVentaCerrada = {
  clienteNombre: string;
  pesoReportadoClienteKg: number;
  precioUnitarioKg: number;
  importeTotal: number;
  diferenciaKg: number;
};

export type ResumenVentaRequiereAprobacion = {
  clienteNombre: string;
  pesoVendidoKg: number;
  pesoReportadoClienteKg: number;
  diferenciaKg: number;
  umbralPct: number;
};

type ReglaSimplificada = {
  usuarioId: number;
  canalInApp: boolean;
  canalCorreo: boolean;
};

// Agrupa reglas ya filtradas (por tipo + ubicación, el filtro lo hace quien
// llama con la consulta a Prisma) por usuario, combinando canales con OR —
// si cualquiera de las reglas que aplican a ese usuario tiene un canal en
// true, ese canal queda activo para él.
export function resolverDestinatarios(
  reglas: ReglaSimplificada[],
): Map<number, { inApp: boolean; correo: boolean }> {
  const porUsuario = new Map<number, { inApp: boolean; correo: boolean }>();
  for (const r of reglas) {
    const actual = porUsuario.get(r.usuarioId) ?? { inApp: false, correo: false };
    porUsuario.set(r.usuarioId, {
      inApp: actual.inApp || r.canalInApp,
      correo: actual.correo || r.canalCorreo,
    });
  }
  return porUsuario;
}

// Campos que se ocultan si el destinatario es OPERADOR — mismo criterio que
// ya restringe precios en las pantallas de Compras/Ventas para ese rol.
const CAMPOS_PRECIO_POR_TIPO: Partial<Record<TipoNotificacion, string[]>> = {
  COMPRA_REGISTRADA: ["precioUnitarioKg", "importeTotal"],
  VENTA_CERRADA: ["precioUnitarioKg", "importeTotal"],
};

export function resumenParaRol(
  resumen: Record<string, unknown>,
  tipo: TipoNotificacion,
  role: RoleUsuario,
): Record<string, unknown> {
  if (role !== "OPERADOR") return resumen;
  const camposOcultos = CAMPOS_PRECIO_POR_TIPO[tipo];
  if (!camposOcultos) return resumen;
  const filtrado = { ...resumen };
  for (const campo of camposOcultos) delete filtrado[campo];
  return filtrado;
}
