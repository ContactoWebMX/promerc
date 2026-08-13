-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('PESAJE_COMPLETADO', 'COMPRA_REGISTRADA', 'VENTA_CERRADA', 'VENTA_REQUIERE_APROBACION');

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "ubicacionId" INTEGER NOT NULL,
    "resumen" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacionDestinatario" (
    "id" SERIAL NOT NULL,
    "notificacionId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "leidoEn" TIMESTAMP(3),
    "requiereCorreo" BOOLEAN NOT NULL,
    "correoEnviadoEn" TIMESTAMP(3),
    "correoIntentos" INTEGER NOT NULL DEFAULT 0,
    "correoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacionDestinatario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaNotificacion" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "ubicacionId" INTEGER,
    "canalInApp" BOOLEAN NOT NULL DEFAULT true,
    "canalCorreo" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReglaNotificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notificacion_entidad_entidadId_idx" ON "Notificacion"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "NotificacionDestinatario_usuarioId_leidoEn_idx" ON "NotificacionDestinatario"("usuarioId", "leidoEn");

-- CreateIndex
CREATE INDEX "NotificacionDestinatario_requiereCorreo_correoEnviadoEn_cor_idx" ON "NotificacionDestinatario"("requiereCorreo", "correoEnviadoEn", "correoIntentos");

-- CreateIndex
CREATE INDEX "ReglaNotificacion_tipo_activo_idx" ON "ReglaNotificacion"("tipo", "activo");

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacionDestinatario" ADD CONSTRAINT "NotificacionDestinatario_notificacionId_fkey" FOREIGN KEY ("notificacionId") REFERENCES "Notificacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacionDestinatario" ADD CONSTRAINT "NotificacionDestinatario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaNotificacion" ADD CONSTRAINT "ReglaNotificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReglaNotificacion" ADD CONSTRAINT "ReglaNotificacion_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "Ubicacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
