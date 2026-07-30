-- AlterEnum
ALTER TYPE "EstadoPesaje" ADD VALUE 'CARGA_REGISTRADA';

-- AlterTable
ALTER TABLE "Pesaje" ADD COLUMN     "loteId" INTEGER;

-- AddForeignKey
ALTER TABLE "Pesaje" ADD CONSTRAINT "Pesaje_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
