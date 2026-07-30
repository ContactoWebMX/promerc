-- AlterTable
ALTER TABLE "Articulo" ADD COLUMN     "netsuiteItemId" TEXT;

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "netsuiteCustomerId" TEXT;

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "netsuiteOrderId" TEXT,
ADD COLUMN     "netsuiteOrderNumber" TEXT,
ADD COLUMN     "netsuiteSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN     "netsuiteVendorId" TEXT;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "netsuiteOrderId" TEXT,
ADD COLUMN     "netsuiteOrderNumber" TEXT,
ADD COLUMN     "netsuiteSyncedAt" TIMESTAMP(3);
