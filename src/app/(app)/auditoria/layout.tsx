import { requireRole } from "@/lib/auth/dal";

export default async function AuditoriaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["ADMIN", "SUPERVISOR"]);
  return <>{children}</>;
}
