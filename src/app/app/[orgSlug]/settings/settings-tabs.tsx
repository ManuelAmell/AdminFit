import Link from "next/link";
import { cn } from "@/lib/utils";

export function SettingsTabs({
  orgSlug,
  active,
}: {
  orgSlug: string;
  active: "team" | "branches";
}) {
  const base = `/app/${orgSlug}/settings`;
  return (
    <nav aria-label="Secciones de configuración" className="border-border flex border-b">
      <Link
        href={`${base}/team`}
        className={cn(
          "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
          active === "team"
            ? "border-primary text-foreground"
            : "text-muted-foreground hover:text-foreground border-transparent",
        )}
      >
        Equipo
      </Link>
      <Link
        href={`${base}/branches`}
        className={cn(
          "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
          active === "branches"
            ? "border-primary text-foreground"
            : "text-muted-foreground hover:text-foreground border-transparent",
        )}
      >
        Sedes
      </Link>
    </nav>
  );
}
