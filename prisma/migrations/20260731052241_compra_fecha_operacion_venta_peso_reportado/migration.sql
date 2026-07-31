-- AlterTable: agregar como opcional primero para poder rellenar filas existentes
ALTER TABLE "Compra" ADD COLUMN     "fechaOperacion" TIMESTAMP(3);

-- Rellenar con la fecha real del ticket (Pesaje.netoCapturadoEn) para las
-- compras que ya existen; nunca debería quedar NULL porque una Compra solo
-- se crea cuando su Pesaje ya está COMPLETO (netoCapturadoEn siempre está
-- seteado en ese punto — ver crearCompra).
UPDATE "Compra" c
SET "fechaOperacion" = p."netoCapturadoEn"
FROM "Pesaje" p
WHERE p.id = c."pesajeId" AND p."netoCapturadoEn" IS NOT NULL;

-- Respaldo por si alguna fila histórica no tuviera netoCapturadoEn: usar
-- createdAt de la propia Compra para no dejar NULLs antes de exigir NOT NULL.
UPDATE "Compra" SET "fechaOperacion" = "createdAt" WHERE "fechaOperacion" IS NULL;

ALTER TABLE "Compra" ALTER COLUMN "fechaOperacion" SET NOT NULL;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "pesoReportadoEn" TIMESTAMP(3);

-- Rellenar para ventas históricas que ya reportaron peso (todo lo que no
-- sigue en Borrador), usando updatedAt como mejor aproximación disponible.
UPDATE "Venta" SET "pesoReportadoEn" = "updatedAt" WHERE "estado" != 'BORRADOR';
