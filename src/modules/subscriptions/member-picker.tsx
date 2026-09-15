"use client";

import { ChevronsUpDown, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { searchMembersForPicker } from "./picker-actions";
import type { MemberPick } from "./queries";

export function memberLabel(m: MemberPick) {
  return `${m.firstName} ${m.lastName}`;
}

export function MemberPicker({
  orgSlug,
  value,
  onChange,
  id,
  invalid,
  disabled,
}: {
  orgSlug: string;
  value: MemberPick | null;
  onChange: (m: MemberPick | null) => void;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberPick[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // El setState ocurre en el callback del timer (fuera del cuerpo del efecto).
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await searchMembersForPicker(orgSlug, query);
        if (!cancelled) setResults(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, query, orgSlug]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid}
            disabled={disabled}
            className="h-10 w-full justify-between font-normal"
          />
        }
      >
        {value ? (
          <span className="flex min-w-0 items-center gap-2">
            <User className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{memberLabel(value)}</span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {value.documentNumber}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">Buscar socio por nombre o documento…</span>
        )}
        <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-1" align="start">
        <Command shouldFilter={false}>
          <div className="p-1">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre o documento"
              className="h-9"
              aria-label="Buscar socio"
            />
          </div>
          <CommandList>
            {!loading && results.length === 0 && (
              <CommandEmpty>
                {query ? "No encontramos socios con ese dato." : "No hay socios registrados."}
              </CommandEmpty>
            )}
            <CommandGroup>
              {results.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.id}
                  data-checked={value?.id === m.id}
                  onSelect={() => {
                    onChange(m);
                    setOpen(false);
                  }}
                  className={cn(m.status !== "active" && "opacity-70")}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{memberLabel(m)}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {m.documentNumber}
                      {m.status !== "active" && " · inactivo"}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
