export const PAYMENT_METHODS = ["cash", "transfer", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};

export const PAYMENT_STATUS_LABELS = {
  completed: "Completado",
  voided: "Anulado",
} as const;

export const REFERENCE_REQUIRED_METHODS: PaymentMethod[] = ["transfer", "card"];

// "membership" lo cubre el flujo normal de Registrar pago / Vender membresía (siempre con
// socio); la Venta rápida (5.3) solo ofrece estos tres, con o sin socio.
export const SELLABLE_CONCEPTS = ["day_pass", "product", "other"] as const;
export type SellableConcept = (typeof SELLABLE_CONCEPTS)[number];
export type PaymentConcept = "membership" | SellableConcept;

export const PAYMENT_CONCEPT_LABELS: Record<PaymentConcept, string> = {
  membership: "Membresía",
  day_pass: "Pase del día",
  product: "Producto",
  other: "Otro",
};

export function formatReceiptNumber(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(6, "0")}`;
}
