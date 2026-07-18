import { getCurrentUser } from "@/lib/auth/dal";

export default async function HomePage() {
  const usuario = await getCurrentUser();

  return (
    <div>
      <h1 className="text-xl font-semibold">Bienvenido, {usuario.nombre}</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Rol: {usuario.role}
      </p>
    </div>
  );
}
