import { AlertTriangle, Ban, CheckCircle2, Clock, Snowflake, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DERIVED_STATUS_LABELS, type DerivedStatus } from "./rules";

const STYLES: Record<DerivedStatus, { className: string; icon: typeof CheckCircle2 }> = {
  al_dia: {
    className: "bg-success/15 text-success-foreground dark:text-success",
    icon: CheckCircle2,
  },
  por_vencer: { className: "bg-warning/20 text-amber-800 dark:text-warning", icon: Clock },
  en_gracia: { className: "bg-warning/20 text-amber-800 dark:text-warning", icon: AlertTriangle },
  vencido: { className: "bg-destructive/10 text-destructive", icon: XCircle },
  congelado: { className: "bg-info/15 text-blue-800 dark:text-info", icon: Snowflake },
  cancelado: { className: "bg-muted text-muted-foreground", icon: Ban },
};

// Color + icono + texto: nunca solo color.
export function SubscriptionStatusBadge({
  status,
  className,
}: {
  status: DerivedStatus;
  className?: string;
}) {
  const { className: styles, icon: Icon } = STYLES[status];
  return (
    <Badge className={cn("gap-1 font-medium", styles, className)}>
      <Icon className="size-3" aria-hidden="true" />
      {DERIVED_STATUS_LABELS[status]}
    </Badge>
  );
}
