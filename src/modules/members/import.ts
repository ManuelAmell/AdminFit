import Papa from "papaparse";
import { memberInputSchema, type MemberValues } from "./schema";

export const CSV_COLUMNS = [
  "tipo_documento",
  "numero_documento",
  "nombres",
  "apellidos",
  "email",
  "telefono",
  "fecha_nacimiento",
  "genero",
  "contacto_emergencia",
  "telefono_emergencia",
  "notas",
] as const;

export const CSV_TEMPLATE =
  CSV_COLUMNS.join(",") +
  "\nCC,1020304050,María,Gómez,maria@ejemplo.com,3001234567,1995-04-12,female,Juan Gómez,3009876543,\n";

const GENDER_ALIASES: Record<string, MemberValues["gender"]> = {
  f: "female",
  femenino: "female",
  female: "female",
  mujer: "female",
  m: "male",
  masculino: "male",
  male: "male",
  hombre: "male",
  otro: "other",
  other: "other",
  "": "unspecified",
};

const FIELD_LABELS: Record<string, string> = {
  documentType: "tipo_documento",
  documentNumber: "numero_documento",
  firstName: "nombres",
  lastName: "apellidos",
  email: "email",
  phone: "telefono",
  birthDate: "fecha_nacimiento",
  gender: "genero",
  emergencyContactName: "contacto_emergencia",
  emergencyContactPhone: "telefono_emergencia",
  notes: "notas",
};

export type ImportRowResult =
  { row: number; ok: true; values: MemberValues } | { row: number; ok: false; errors: string[] };

// Parsea y valida el CSV; no toca la base de datos.
export function parseMembersCsv(text: string): { rows: ImportRowResult[]; headerError?: string } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const headers = parsed.meta.fields ?? [];
  const required = ["numero_documento", "nombres", "apellidos"];
  const missing = required.filter((c) => !headers.includes(c));
  if (missing.length) {
    return { rows: [], headerError: `Faltan columnas obligatorias: ${missing.join(", ")}.` };
  }

  const rows: ImportRowResult[] = parsed.data.map((r, i) => {
    const row = i + 2; // 1 = encabezado
    const genderRaw = (r.genero ?? "").trim().toLowerCase();
    const candidate = {
      documentType: (r.tipo_documento ?? "CC").trim().toUpperCase() || "CC",
      documentNumber: r.numero_documento ?? "",
      firstName: r.nombres ?? "",
      lastName: r.apellidos ?? "",
      email: r.email ?? "",
      phone: r.telefono ?? "",
      birthDate: r.fecha_nacimiento ?? "",
      gender: GENDER_ALIASES[genderRaw] ?? genderRaw,
      emergencyContactName: r.contacto_emergencia ?? "",
      emergencyContactPhone: r.telefono_emergencia ?? "",
      notes: r.notas ?? "",
    };
    const result = memberInputSchema.safeParse(candidate);
    if (result.success) return { row, ok: true, values: result.data };
    return {
      row,
      ok: false,
      errors: result.error.issues.map((iss) => {
        const key = String(iss.path[0] ?? "");
        return `${FIELD_LABELS[key] ?? key}: ${iss.message}`;
      }),
    };
  });

  // Duplicados dentro del mismo archivo.
  const seen = new Map<string, number>();
  return {
    rows: rows.map((r) => {
      if (!r.ok) return r;
      const key = `${r.values.documentType}:${r.values.documentNumber}`;
      const first = seen.get(key);
      if (first) {
        return {
          row: r.row,
          ok: false,
          errors: [`Documento repetido en el archivo (fila ${first}).`],
        };
      }
      seen.set(key, r.row);
      return r;
    }),
  };
}
