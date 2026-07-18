-- CreateEnum
CREATE TYPE "RoleUsuario" AS ENUM ('ADMIN', 'SUPERVISOR', 'OPERADOR', 'CLIENTE');

-- CreateEnum
CREATE TYPE "EstadoPesaje" AS ENUM ('TARA_CAPTURADA', 'COMPLETO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('ABIERTA', 'CERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'CERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoFirma" AS ENUM ('SALIDA_PROVEEDOR', 'VALIDACION_SUPERVISOR', 'RECEPCION_CLIENTE', 'EXCEPCION_TOLERANCIA');

-- CreateEnum
CREATE TYPE "TipoEvidencia" AS ENUM ('TICKET_BASCULA', 'COMPROBANTE_CLIENTE', 'OTRO');

-- CreateTable
CREATE TABLE "Ubicacion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ubicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "RoleUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ubicacionId" INTEGER,
    "clienteId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "rfc" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "rfc" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Articulo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Articulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadEmpaque" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UnidadEmpaque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transportista" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "placas" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transportista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToleranciaConfig" (
    "id" SERIAL NOT NULL,
    "articuloId" INTEGER,
    "porcentajeUmbral" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToleranciaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" SERIAL NOT NULL,
    "folio" TEXT NOT NULL,
    "folioCorregido" BOOLEAN NOT NULL DEFAULT false,
    "ubicacionId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pesaje" (
    "id" SERIAL NOT NULL,
    "folioTicket" TEXT NOT NULL,
    "ubicacionId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "transportistaId" INTEGER,
    "operadorNombre" TEXT NOT NULL,
    "placas" TEXT NOT NULL,
    "colorCamion" TEXT,
    "tipoCamion" TEXT,
    "pesadorNombre" TEXT NOT NULL,
    "taraKg" DECIMAL(10,2) NOT NULL,
    "taraCapturadaEn" TIMESTAMP(3) NOT NULL,
    "grossKg" DECIMAL(10,2),
    "netoKg" DECIMAL(10,2),
    "netoCapturadoEn" TIMESTAMP(3),
    "clienteDestinoReferencia" TEXT,
    "observaciones" TEXT,
    "motivoAnulacion" TEXT,
    "estado" "EstadoPesaje" NOT NULL DEFAULT 'TARA_CAPTURADA',
    "createdByUsuarioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pesaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PesajeEmpaque" (
    "pesajeId" INTEGER NOT NULL,
    "unidadEmpaqueId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "PesajeEmpaque_pkey" PRIMARY KEY ("pesajeId","unidadEmpaqueId")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" SERIAL NOT NULL,
    "pesajeId" INTEGER NOT NULL,
    "ubicacionId" INTEGER NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "loteId" INTEGER,
    "precioUnitarioKg" DECIMAL(10,2) NOT NULL,
    "importeTotal" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoCompra" NOT NULL DEFAULT 'ABIERTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" SERIAL NOT NULL,
    "ubicacionId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "articuloId" INTEGER NOT NULL,
    "transportistaId" INTEGER,
    "operadorNombre" TEXT,
    "placas" TEXT,
    "pesoVendidoKg" DECIMAL(10,2) NOT NULL,
    "pesoReportadoClienteKg" DECIMAL(10,2),
    "penalizacionKg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "penalizacionMotivo" TEXT,
    "precioUnitarioKg" DECIMAL(10,2) NOT NULL,
    "importeTotal" DECIMAL(12,2) NOT NULL,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'BORRADOR',
    "toleranciaExcedida" BOOLEAN NOT NULL DEFAULT false,
    "createdByUsuarioId" INTEGER NOT NULL,
    "reportadoPorClienteUsuarioId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoteMovimiento" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "pesoAsignadoKg" DECIMAL(10,2) NOT NULL,
    "createdByUsuarioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoteMovimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Firma" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoFirma" NOT NULL,
    "pesajeId" INTEGER,
    "ventaId" INTEGER,
    "nombreFirmante" TEXT NOT NULL,
    "horaFirma" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imagenFirma" TEXT,
    "justificacion" TEXT,
    "capturadaPorUsuarioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidencia" (
    "id" SERIAL NOT NULL,
    "pesajeId" INTEGER,
    "ventaId" INTEGER,
    "tipo" "TipoEvidencia" NOT NULL,
    "rutaArchivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "subidoPorUsuarioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "detalleAnterior" JSONB,
    "detalleNuevo" JSONB,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ubicacion_codigo_key" ON "Ubicacion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Articulo_nombre_key" ON "Articulo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadEmpaque_nombre_key" ON "UnidadEmpaque"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Transportista_nombre_placas_key" ON "Transportista"("nombre", "placas");

-- CreateIndex
CREATE UNIQUE INDEX "ToleranciaConfig_articuloId_key" ON "ToleranciaConfig"("articuloId");

-- CreateIndex
CREATE UNIQUE INDEX "Lote_folio_key" ON "Lote"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "Compra_pesajeId_key" ON "Compra"("pesajeId");

-- CreateIndex
CREATE INDEX "LoteMovimiento_loteId_idx" ON "LoteMovimiento"("loteId");

-- CreateIndex
CREATE INDEX "LoteMovimiento_ventaId_idx" ON "LoteMovimiento"("ventaId");

-- CreateIndex
CREATE INDEX "AuditLog_entidad_entidadId_idx" ON "AuditLog"("entidad", "entidadId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToleranciaConfig" ADD CONSTRAINT "ToleranciaConfig_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pesaje" ADD CONSTRAINT "Pesaje_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pesaje" ADD CONSTRAINT "Pesaje_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pesaje" ADD CONSTRAINT "Pesaje_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pesaje" ADD CONSTRAINT "Pesaje_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "Transportista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pesaje" ADD CONSTRAINT "Pesaje_createdByUsuarioId_fkey" FOREIGN KEY ("createdByUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesajeEmpaque" ADD CONSTRAINT "PesajeEmpaque_pesajeId_fkey" FOREIGN KEY ("pesajeId") REFERENCES "Pesaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesajeEmpaque" ADD CONSTRAINT "PesajeEmpaque_unidadEmpaqueId_fkey" FOREIGN KEY ("unidadEmpaqueId") REFERENCES "UnidadEmpaque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_pesajeId_fkey" FOREIGN KEY ("pesajeId") REFERENCES "Pesaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "Transportista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_createdByUsuarioId_fkey" FOREIGN KEY ("createdByUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_reportadoPorClienteUsuarioId_fkey" FOREIGN KEY ("reportadoPorClienteUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteMovimiento" ADD CONSTRAINT "LoteMovimiento_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteMovimiento" ADD CONSTRAINT "LoteMovimiento_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firma" ADD CONSTRAINT "Firma_pesajeId_fkey" FOREIGN KEY ("pesajeId") REFERENCES "Pesaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firma" ADD CONSTRAINT "Firma_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firma" ADD CONSTRAINT "Firma_capturadaPorUsuarioId_fkey" FOREIGN KEY ("capturadaPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_pesajeId_fkey" FOREIGN KEY ("pesajeId") REFERENCES "Pesaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidencia" ADD CONSTRAINT "Evidencia_subidoPorUsuarioId_fkey" FOREIGN KEY ("subidoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
