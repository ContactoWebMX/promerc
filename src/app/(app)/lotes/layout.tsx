import { requireRole } from "@/lib/auth/dal";

export default async function LotesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["ADMIN", "SUPERVISOR", "OPERADOR"]);
  return <>{children}</>;
}
