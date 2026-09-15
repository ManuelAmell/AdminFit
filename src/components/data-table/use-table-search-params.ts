"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

// Sincroniza filtros/orden/página con la URL: el server component los lee de searchParams.
export function useTableSearchParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParams = useCallback(
    (
      updates: Record<string, string | number | null | undefined>,
      opts?: { resetPage?: boolean },
    ) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      if (opts?.resetPage !== false && !("page" in updates)) next.delete("page");
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [router, pathname, searchParams],
  );

  return { searchParams, setParams, isPending };
}
