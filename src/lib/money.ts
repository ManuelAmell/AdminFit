// Todos los montos se guardan como enteros en centavos. COP no usa decimales en la práctica,
// pero se mantiene la convención para no mezclar unidades.
const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCOP(cents: number): string {
  return copFormatter.format(Math.round(cents / 100));
}

export function pesosToCents(pesos: number): number {
  return Math.round(pesos * 100);
}

export function centsToPesos(cents: number): number {
  return Math.round(cents / 100);
}

// Acepta "1.500.000", "1500000", "$ 1.500.000" → 150000000 centavos.
export function parsePesosInput(input: string): number | null {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;
  return pesosToCents(Number(digits));
}
