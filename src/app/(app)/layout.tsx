import { getCurrentUser } from "@/lib/auth/dal";
import { logout } from "@/app/(auth)/login/actions";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const usuario = await getCurrentUser();

  const links =
    usuario.role === "CLIENTE"
      ? []
      : [
          { href: "/pesajes", label: "Pesajes" },
          { href: "/compras", label: "Compras" },
          { href: "/lotes", label: "Lotes" },
          { href: "/ventas", label: "Ventas" },
          ...(usuario.role === "ADMIN" || usuario.role === "SUPERVISOR"
            ? [{ href: "/catalogos", label: "Catálogos" }]
            : []),
        ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppNav
        links={links}
        usuarioNombre={usuario.nombre}
        usuarioRole={usuario.role}
        logoutAction={logout}
      />
      <main className="flex w-full min-w-0 flex-1 flex-col p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
