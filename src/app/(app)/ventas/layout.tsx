import { requireRole } from "@/lib/auth/dal";

export default async function VentasLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["ADMIN", "SUPERVISOR"]);
  return <>{children}</>;
}
