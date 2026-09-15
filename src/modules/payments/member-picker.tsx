"use client";

import { Search, UserRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { searchMembersAction } from "./actions";

export type PickedMember = {
  id: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  status?: string;
};

export function MemberPicker({
  orgSlug,
  value,
  onChange,
  inputId,
  invalid,
}: {
  orgSlug: string;
  value: PickedMember | null;
  onChange: (member: PickedMember | null) => void;
  inputId?: string;
  invalid?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedMember[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleQueryChange(next: string) {
    setQuery(next);
    if (timer.current) clearTimeout(timer.current);
    if (next.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const rows = await searchMembersAction(orgSlug, next);
        setResults(rows);
        setActive(0);
        setOpen(true);
      });
    }, 250);
  }

  if (value) {
    return (
      <div className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2">
        <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate font-medium">
            {value.firstName} {value.lastName}
          </span>
          <span className="text-muted-foreground text-xs">
            {value.documentType} {value.documentNumber}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          aria-label="Cambiar socio"
        >
          <X />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid}
        autoComplete="off"
        placeholder="Nombre o documento…"
        className="h-11 pl-9"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            onChange(results[active]);
            setOpen(false);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {pending && <Spinner className="absolute top-1/2 right-3 -translate-y-1/2" />}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="bg-popover text-popover-foreground absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border p-1 shadow-md"
        >
          {results.length === 0 ? (
            <li className="text-muted-foreground px-3 py-2 text-sm">
              Sin resultados para “{query}”.
            </li>
          ) : (
            results.map((m, i) => (
              <li
                key={m.id}
                role="option"
                aria-selected={i === active}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
                  i === active && "bg-accent text-accent-foreground",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
              >
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate font-medium">
                    {m.firstName} {m.lastName}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {m.documentType} {m.documentNumber}
                  </span>
                </span>
                {m.status && m.status !== "active" && (
                  <span className="text-warning text-xs">Inactivo</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
