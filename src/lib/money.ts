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

// Etiquetas cortas para gráficas: "$1,2 M", "$350 mil", "$900". A mano en vez de
// Intl `notation: "compact"`, cuya salida en es-CO cambia entre versiones de ICU.
export function formatCOPShort(cents: number): string {
  const pesos = Math.round(cents / 100);
  const abs = Math.abs(pesos);
  const sign = pesos < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${(m >= 10 ? Math.round(m).toString() : m.toFixed(1)).replace(".", ",")} M`;
  }
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)} mil`;
  return `${sign}$${abs}`;
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

const thousandsFormatter = new Intl.NumberFormat("es-CO");

// Para inputs de monto controlados: formatea con separador de miles mientras se escribe
// ("150000" → "150.000"). Usar en el `onChange` del input, junto con `parsePesosInput`
// para obtener los centavos al enviar.
export function formatPesosLive(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return thousandsFormatter.format(Number(digits));
}
