-- AlterTable
ALTER TABLE "Ubicacion" ADD COLUMN     "netsuiteLocationId" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "netsuiteEmployeeId" TEXT;

-- CreateTable
CREATE TABLE "CentroAprobacion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "netsuiteId" TEXT NOT NULL,
    "predeterminado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CentroAprobacion_pkey" PRIMARY KEY ("id")
);
