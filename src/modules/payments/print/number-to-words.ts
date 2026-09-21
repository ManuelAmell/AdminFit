const UNITS = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const TEENS = [
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];
const TENS = [
  "",
  "",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];
const HUNDREDS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];

function below1000(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const h = Math.floor(n / 100);
  const r = n % 100;
  let out = h ? HUNDREDS[h] : "";
  if (r) {
    let t = "";
    if (r < 10) t = UNITS[r];
    else if (r < 20) t = TEENS[r - 10];
    else if (r < 30) t = r === 20 ? "veinte" : `veinti${UNITS[r - 20]}`;
    else t = TENS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNITS[r % 10]}` : "");
    out = out ? `${out} ${t}` : t;
  }
  return out;
}

// Pesos (sin centavos) a letras: 1.250.000 → "un millón doscientos cincuenta mil pesos".
export function pesosToWords(pesos: number): string {
  if (!Number.isFinite(pesos) || pesos < 0) return "";
  if (pesos === 0) return "cero pesos";
  const millions = Math.floor(pesos / 1_000_000);
  const thousands = Math.floor((pesos % 1_000_000) / 1000);
  const rest = pesos % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? "un millón" : `${below1000(millions)} millones`);
  if (thousands) parts.push(thousands === 1 ? "mil" : `${below1000(thousands)} mil`);
  if (rest) parts.push(below1000(rest));
  return `${parts.join(" ").replace(/\buno mil\b/, "un mil")} pesos`;
}
