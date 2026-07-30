-- DropForeignKey
ALTER TABLE "Pesaje" DROP CONSTRAINT "Pesaje_articuloId_fkey";

-- AlterTable
ALTER TABLE "Pesaje" ADD COLUMN     "idOperacionBascula" TEXT,
ALTER COLUMN "articuloId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Pesaje" ADD CONSTRAINT "Pesaje_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
