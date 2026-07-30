import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { decryptSession, getSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { RoleUsuario } from "@/generated/prisma/enums";

// Fuente real de autorización: se llama en cada Server Action / Route
// Handler / página que toca datos. proxy.ts solo hace el redirect optimista.
export const verifySession = cache(async () => {
  const token = await getSessionCookie();
  const session = await decryptSession(token);

  if (!session?.userId) {
    redirect("/login");
  }

  return session;
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.userId },
    include: { ubicacion: true },
  });

  if (!usuario || !usuario.activo) {
    redirect("/login");
  }

  return usuario;
});

// Para páginas/Server Components: redirige si el rol no alcanza.
export async function requireRole(roles: RoleUsuario[]) {
  const usuario = await getCurrentUser();
  if (!roles.includes(usuario.role)) {
    redirect("/");
  }
  return usuario;
}

// ADMIN/SUPERVISOR ven todas las ubicaciones; el resto solo la propia.
export function canAccessUbicacion(
  usuario: { role: RoleUsuario; ubicacionId: number | null },
  ubicacionId: number | null,
) {
  if (usuario.role === "ADMIN" || usuario.role === "SUPERVISOR") return true;
  return usuario.ubicacionId === ubicacionId;
}
