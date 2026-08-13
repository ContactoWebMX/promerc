-- AlterTable: agregar como opcional primero para poder rellenar filas existentes
ALTER TABLE "Venta" ADD COLUMN     "fechaOperacion" TIMESTAMP(3);

-- Rellenar con la mejor fecha real conocida para las ventas ya existentes:
-- pesoReportadoEn si ya se reportó, si no createdAt (misma prioridad que ya
-- usaban las listas/exports como respaldo antes de este campo).
UPDATE "Venta" SET "fechaOperacion" = COALESCE("pesoReportadoEn", "createdAt");

ALTER TABLE "Venta" ALTER COLUMN "fechaOperacion" SET NOT NULL;
