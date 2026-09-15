"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORG_ROLES, type OrgRole } from "@/lib/auth/permissions";
import { ROLE_LABELS } from "@/lib/auth/roles";

const items = ORG_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));

export function RoleSelect({
  id,
  value,
  onValueChange,
  disabled,
  allowOwner = false,
  className,
}: {
  id?: string;
  value: OrgRole;
  onValueChange: (role: OrgRole) => void;
  disabled?: boolean;
  allowOwner?: boolean;
  className?: string;
}) {
  const options = allowOwner ? items : items.filter((i) => i.value !== "owner");
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(v) => v && onValueChange(v as OrgRole)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} aria-label="Rol">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
