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

export function formatReceiptNumber(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(6, "0")}`;
}
