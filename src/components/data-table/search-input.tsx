"use client";

import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTableSearchParams } from "./use-table-search-params";

export function SearchInput({
  placeholder = "Buscar…",
  paramKey = "q",
  label = "Buscar",
}: {
  placeholder?: string;
  paramKey?: string;
  label?: string;
}) {
  const { searchParams, setParams } = useTableSearchParams();
  const urlValue = searchParams.get(paramKey) ?? "";
  const [value, setValue] = useState(urlValue);
  const [syncedUrl, setSyncedUrl] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si la URL cambia desde fuera (ej. "Limpiar filtros"), reflejarlo sin useEffect.
  if (urlValue !== syncedUrl) {
    setSyncedUrl(urlValue);
    setValue(urlValue);
  }

  function onChange(v: string) {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParams({ [paramKey]: v.trim() }), 300);
  }

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        type="search"
        inputMode="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => {
            setValue("");
            setParams({ [paramKey]: null });
          }}
          aria-label="Limpiar búsqueda"
        >
          <X />
        </Button>
      )}
    </div>
  );
}
