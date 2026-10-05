import type { OrgRole } from "./permissions";

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  staff: "Recepción",
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Control total, incluido eliminar el gimnasio y ver la nómina.",
  admin: "Gestiona todo excepto eliminar el gimnasio y ver la nómina.",
  staff:
    "Registra socios, vende membresías y cobra. No ve ingresos totales, reportes ni configuración — solo sus propios cobros, gastos de caja menor y cierres.",
};
