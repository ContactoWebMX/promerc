import Link from "next/link";

const catalogos = [
  { href: "/catalogos/ubicaciones", label: "Ubicaciones" },
  { href: "/catalogos/proveedores", label: "Proveedores" },
  { href: "/catalogos/clientes", label: "Clientes" },
  { href: "/catalogos/articulos", label: "Artículos" },
  { href: "/catalogos/unidades-empaque", label: "Unidades de empaque" },
  { href: "/catalogos/usuarios", label: "Usuarios" },
];

export default function CatalogosPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Catálogos</h1>
      <ul className="flex flex-col gap-2">
        {catalogos.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="underline">
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
