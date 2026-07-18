import "dotenv/config";
import { hash } from "argon2";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const ubicacion = await prisma.ubicacion.upsert({
    where: { codigo: "MATRIZ" },
    update: {},
    create: { nombre: "Matriz", codigo: "MATRIZ" },
  });

  const passwordHash = await hash("admin1234");
  await prisma.usuario.upsert({
    where: { email: "admin@promerc.local" },
    update: {},
    create: {
      nombre: "Administrador",
      email: "admin@promerc.local",
      passwordHash,
      role: "ADMIN",
      ubicacionId: null,
    },
  });

  await prisma.articulo.upsert({
    where: { nombre: "Cartón" },
    update: {},
    create: { nombre: "Cartón" },
  });

  // Umbral de tolerancia global (articuloId null = fallback). Postgres no
  // permite un upsert único sobre NULL, así que se busca antes de crear.
  const toleranciaGlobal = await prisma.toleranciaConfig.findFirst({
    where: { articuloId: null },
  });
  if (!toleranciaGlobal) {
    await prisma.toleranciaConfig.create({
      data: { articuloId: null, porcentajeUmbral: 3.0 },
    });
  }

  await prisma.unidadEmpaque.upsert({
    where: { nombre: "Paca Grande" },
    update: {},
    create: { nombre: "Paca Grande" },
  });
  await prisma.unidadEmpaque.upsert({
    where: { nombre: "Paca Chica" },
    update: {},
    create: { nombre: "Paca Chica" },
  });

  console.log("Seed listo:", { ubicacion: ubicacion.codigo });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
