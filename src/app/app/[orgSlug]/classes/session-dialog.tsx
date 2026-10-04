"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { ClassType, Trainer } from "@/db/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { todayISO } from "@/lib/dates";
import { createClassSession } from "@/modules/classes/actions";
import { classSessionInputSchema, type ClassSessionInput } from "@/modules/classes/schema";

function addMinutesToTime(time: string, minutes: number): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  if (isNaN(h) || isNaN(m)) return time;
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export function SessionDialog({
  orgSlug,
  classTypes,
  trainers,
  branches,
  defaultDate,
  trigger,
}: {
  orgSlug: string;
  classTypes: ClassType[];
  trainers: Trainer[];
  branches: Array<{ id: string; name: string }>;
  defaultDate?: string;
  trigger?: (open: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const initialClassType = classTypes[0];

  const form = useForm<ClassSessionInput>({
    resolver: zodResolver(classSessionInputSchema),
    defaultValues: {
      classTypeId: initialClassType?.id ?? "",
      trainerId: "",
      branchId: branches[0]?.id ?? "",
      date: defaultDate ?? todayISO(),
      startTime: "07:00",
      endTime: initialClassType
        ? addMinutesToTime("07:00", initialClassType.durationMinutes)
        : "08:00",
      capacity: initialClassType?.defaultCapacity ?? 20,
    },
    mode: "onBlur",
  });

  const { errors, isSubmitting } = form.formState;
  const selectedTypeId = useWatch({ control: form.control, name: "classTypeId" });
  const startTime = useWatch({ control: form.control, name: "startTime" });

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const typeId = e.target.value;
    form.setValue("classTypeId", typeId);
    const selected = classTypes.find((t) => t.id === typeId);
    if (selected) {
      form.setValue("capacity", selected.defaultCapacity);
      if (startTime) {
        form.setValue("endTime", addMinutesToTime(startTime, selected.durationMinutes));
      }
    }
  }

  function handleStartTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newStart = e.target.value;
    form.setValue("startTime", newStart);
    const selected = classTypes.find((t) => t.id === selectedTypeId);
    if (selected && newStart) {
      form.setValue("endTime", addMinutesToTime(newStart, selected.durationMinutes));
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setServerError(null);
      const defaultType = classTypes[0];
      form.reset({
        classTypeId: defaultType?.id ?? "",
        trainerId: "",
        branchId: branches[0]?.id ?? "",
        date: defaultDate ?? todayISO(),
        startTime: "07:00",
        endTime: defaultType ? addMinutesToTime("07:00", defaultType.durationMinutes) : "08:00",
        capacity: defaultType?.defaultCapacity ?? 20,
      });
    }
  }

  async function onSubmit(values: ClassSessionInput) {
    setServerError(null);
    const res = await createClassSession(orgSlug, values);
    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [k, msg] of Object.entries(res.fieldErrors)) {
          form.setError(k as keyof ClassSessionInput, { message: msg });
        }
      } else {
        setServerError(res.error);
      }
      return;
    }
    toast.success("Clase programada con éxito.");
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      {trigger ? (
        trigger(() => handleOpenChange(true))
      ) : (
        <Button size="sm" onClick={() => handleOpenChange(true)}>
          <CalendarPlus className="size-4" />
          Programar clase
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Programar clase</DialogTitle>
            <DialogDescription>
              Asigna fecha, horario, entrenador y aforo disponible para la sesión.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <FieldGroup>
              <Field data-invalid={!!errors.classTypeId}>
                <FieldLabel htmlFor="session-type">Modalidad de clase</FieldLabel>
                <select
                  id="session-type"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedTypeId}
                  onChange={handleTypeChange}
                >
                  {classTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.durationMinutes} min - {t.defaultCapacity} cupos)
                    </option>
                  ))}
                </select>
                <FieldError errors={[errors.classTypeId]} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={!!errors.trainerId}>
                  <FieldLabel htmlFor="session-trainer">Entrenador (opcional)</FieldLabel>
                  <select
                    id="session-trainer"
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                    {...form.register("trainerId")}
                  >
                    <option value="">Sin entrenador asignado</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} {t.specialty ? `(${t.specialty})` : ""}
                      </option>
                    ))}
                  </select>
                  <FieldError errors={[errors.trainerId]} />
                </Field>

                <Field data-invalid={!!errors.branchId}>
                  <FieldLabel htmlFor="session-branch">Sede (opcional)</FieldLabel>
                  <select
                    id="session-branch"
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                    {...form.register("branchId")}
                  >
                    <option value="">Sede general / Única</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <FieldError errors={[errors.branchId]} />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field data-invalid={!!errors.date}>
                  <FieldLabel htmlFor="session-date">Fecha</FieldLabel>
                  <Input
                    id="session-date"
                    type="date"
                    aria-invalid={!!errors.date}
                    {...form.register("date")}
                  />
                  <FieldError errors={[errors.date]} />
                </Field>

                <Field data-invalid={!!errors.startTime}>
                  <FieldLabel htmlFor="session-start">Hora inicio</FieldLabel>
                  <Input
                    id="session-start"
                    type="time"
                    aria-invalid={!!errors.startTime}
                    value={startTime}
                    onChange={handleStartTimeChange}
                  />
                  <FieldError errors={[errors.startTime]} />
                </Field>

                <Field data-invalid={!!errors.endTime}>
                  <FieldLabel htmlFor="session-end">Hora fin</FieldLabel>
                  <Input
                    id="session-end"
                    type="time"
                    aria-invalid={!!errors.endTime}
                    {...form.register("endTime")}
                  />
                  <FieldError errors={[errors.endTime]} />
                </Field>
              </div>

              <Field data-invalid={!!errors.capacity}>
                <FieldLabel htmlFor="session-capacity">Capacidad máxima (aforo)</FieldLabel>
                <Input
                  id="session-capacity"
                  type="number"
                  min={1}
                  max={500}
                  aria-invalid={!!errors.capacity}
                  {...form.register("capacity", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.capacity]} />
              </Field>
            </FieldGroup>

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || pending}>
                {(isSubmitting || pending) && <Spinner />}
                Programar clase
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
