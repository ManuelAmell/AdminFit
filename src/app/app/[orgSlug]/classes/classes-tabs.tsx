import Link from "next/link";
import { cn } from "@/lib/utils";

export function ClassesTabs({
  orgSlug,
  active,
}: {
  orgSlug: string;
  active: "schedule" | "trainers" | "types";
}) {
  const base = `/app/${orgSlug}/classes`;
  return (
    <nav aria-label="Secciones de clases" className="border-border flex border-b">
      <Link
        href={base}
        className={cn(
          "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
          active === "schedule"
            ? "border-primary text-foreground"
            : "text-muted-foreground hover:text-foreground border-transparent",
        )}
      >
        Agenda de Clases
      </Link>
      <Link
        href={`${base}/trainers`}
        className={cn(
          "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
          active === "trainers"
            ? "border-primary text-foreground"
            : "text-muted-foreground hover:text-foreground border-transparent",
        )}
      >
        Entrenadores
      </Link>
      <Link
        href={`${base}/types`}
        className={cn(
          "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
          active === "types"
            ? "border-primary text-foreground"
            : "text-muted-foreground hover:text-foreground border-transparent",
        )}
      >
        Modalidades
      </Link>
    </nav>
  );
}
