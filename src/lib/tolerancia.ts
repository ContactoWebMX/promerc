// Funciones puras, sin dependencias de servidor — importables desde
// cualquier contexto (server actions, scripts, tests).

export function calcularDiferenciaPorcentual(
  pesoVendidoKg: number,
  pesoFacturableKg: number,
): number {
  if (pesoVendidoKg === 0) return 0;
  return (Math.abs(pesoVendidoKg - pesoFacturableKg) / pesoVendidoKg) * 100;
}

export function excedeTolerancia(
  pesoVendidoKg: number,
  pesoFacturableKg: number,
  umbralPct: number,
): boolean {
  return calcularDiferenciaPorcentual(pesoVendidoKg, pesoFacturableKg) > umbralPct;
}
