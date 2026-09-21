import { ShieldAlert } from "lucide-react";
import { stopImpersonating } from "@/app/admin/actions";

export function ImpersonationBanner() {
  return (
    <form
      action={stopImpersonating}
      className="bg-warning/15 text-warning-foreground flex items-center justify-between gap-2 border-b px-4 py-2 text-sm"
    >
      <span className="flex items-center gap-2">
        <ShieldAlert className="size-4" aria-hidden="true" />
        Estás viendo esta cuenta como soporte (superadmin).
      </span>
      <button type="submit" className="font-medium underline underline-offset-4">
        Salir
      </button>
    </form>
  );
}
