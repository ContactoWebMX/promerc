import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/card";

const catalogos = [
  { href: "/catalogos/ubicaciones", label: "Ubicaciones" },
  { href: "/catalogos/proveedores", label: "Proveedores" },
  { href: "/catalogos/clientes", label: "Clientes" },
  { href: "/catalogos/articulos", label: "Artículos" },
  { href: "/catalogos/unidades-empaque", label: "Unidades de empaque" },
  { href: "/catalogos/usuarios", label: "Usuarios" },
  { href: "/catalogos/tolerancia", label: "Tolerancia" },
  { href: "/catalogos/centro-aprobacion", label: "Centro de Aprobación (NetSuite)" },
];

export default function CatalogosPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Catálogos" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {catalogos.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="transition-colors hover:border-primary">
              <span className="font-medium">{c.label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
