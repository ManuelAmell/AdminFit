export const EXPENSE_CATEGORIES = [
  "rent",
  "utilities",
  "payroll",
  "equipment",
  "maintenance",
  "supplies",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: "Arriendo",
  utilities: "Servicios",
  payroll: "Nómina",
  equipment: "Equipo",
  maintenance: "Mantenimiento",
  supplies: "Insumos",
  other: "Otro",
};

export const EXPENSE_STATUS_LABELS = {
  completed: "Registrado",
  voided: "Anulado",
} as const;
