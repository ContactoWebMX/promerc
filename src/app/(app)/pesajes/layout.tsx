import { requireRole } from "@/lib/auth/dal";

export default async function PesajesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);
  return <>{children}</>;
}
