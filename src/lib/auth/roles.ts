import type { OrgRole } from "./permissions";

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  staff: "Recepción",
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Control total, incluido eliminar el gimnasio.",
  admin: "Gestiona todo excepto eliminar el gimnasio.",
  staff: "Registra socios, vende membresías y cobra. No configura ni anula pagos.",
};
