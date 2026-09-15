import {
  AlertTriangle,
  CircleCheck,
  CircleDashed,
  Clock,
  Snowflake,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MEMBERSHIP_STATE_LABELS } from "@/lib/members/labels";
import { cn } from "@/lib/utils";
import type { MembershipState } from "@/modules/members/schema";

const STYLES: Record<MembershipState, { icon: LucideIcon; className: string }> = {
  current: { icon: CircleCheck, className: "bg-success/10 text-success dark:bg-success/15" },
  expiring: { icon: Clock, className: "bg-warning/15 text-warning-foreground dark:text-warning" },
  grace: {
    icon: AlertTriangle,
    className: "bg-warning/15 text-warning-foreground dark:text-warning",
  },
  expired: {
    icon: XCircle,
    className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  },
  frozen: { icon: Snowflake, className: "bg-info/10 text-info dark:bg-info/15" },
  none: { icon: CircleDashed, className: "bg-muted text-muted-foreground" },
};

export function MembershipBadge({
  state,
  className,
}: {
  state: MembershipState;
  className?: string;
}) {
  const { icon: Icon, className: stateClass } = STYLES[state];
  return (
    <Badge variant="secondary" className={cn("gap-1 font-medium", stateClass, className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {MEMBERSHIP_STATE_LABELS[state]}
    </Badge>
  );
}
