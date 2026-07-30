-- Renombrar en vez de dropear+recrear: preserva los valores históricos de
-- penalizacionKg/penalizacionMotivo ya capturados (11 ventas al momento de
-- este cambio). El signo cambia de significado (antes siempre positivo =
-- penalización manual; ahora positivo = merma, negativo = sobrante) pero el
-- dato crudo ya guardado sigue siendo válido bajo la nueva columna.
ALTER TABLE "Venta" RENAME COLUMN "penalizacionKg" TO "diferenciaKg";
ALTER TABLE "Venta" RENAME COLUMN "penalizacionMotivo" TO "motivoDiferencia";
