"use client";

import { Filter } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { ClassType, Trainer } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/lib/dates";

export function ScheduleFilter({
  orgSlug,
  classTypes,
  trainers,
}: {
  orgSlug: string;
  classTypes: ClassType[];
  trainers: Trainer[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const currentDate = searchParams.get("date") ?? "";
  const currentTypeId = searchParams.get("classTypeId") ?? "";
  const currentTrainerId = searchParams.get("trainerId") ?? "";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`/app/${orgSlug}/classes?${params.toString()}`);
    });
  }

  function handleSetToday() {
    updateFilter("date", todayISO());
  }

  function handleClearDate() {
    updateFilter("date", "");
  }

  return (
    <div className="bg-card border-border flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Filter className="text-muted-foreground size-4" />
        <span className="text-foreground text-xs font-medium">Filtros:</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant={currentDate === todayISO() ? "default" : "outline"}
          className="h-8 text-xs"
          disabled={pending}
          onClick={handleSetToday}
        >
          Hoy
        </Button>
        {currentDate && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground h-8 text-xs"
            disabled={pending}
            onClick={handleClearDate}
          >
            Todas las fechas
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          className="h-8 w-38 text-xs"
          value={currentDate}
          onChange={(e) => updateFilter("date", e.target.value)}
        />
      </div>

      {classTypes.length > 0 && (
        <select
          className="border-input bg-background text-foreground focus-visible:ring-ring h-8 rounded-md border px-2.5 text-xs focus-visible:ring-2 focus-visible:outline-hidden"
          value={currentTypeId}
          onChange={(e) => updateFilter("classTypeId", e.target.value)}
        >
          <option value="">Todas las modalidades</option>
          {classTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      {trainers.length > 0 && (
        <select
          className="border-input bg-background text-foreground focus-visible:ring-ring h-8 rounded-md border px-2.5 text-xs focus-visible:ring-2 focus-visible:outline-hidden"
          value={currentTrainerId}
          onChange={(e) => updateFilter("trainerId", e.target.value)}
        >
          <option value="">Todos los entrenadores</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.firstName} {t.lastName}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
