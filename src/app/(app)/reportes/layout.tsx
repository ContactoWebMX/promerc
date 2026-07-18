import { requireRole } from "@/lib/auth/dal";

export default async function ReportesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);
  return <>{children}</>;
}
