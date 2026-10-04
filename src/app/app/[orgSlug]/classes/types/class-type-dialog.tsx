"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { ClassType } from "@/db/schema";
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
import { createClassType, updateClassType } from "@/modules/classes/actions";
import { classTypeInputSchema, type ClassTypeInput } from "@/modules/classes/schema";

const COLOR_PRESETS = [
  "#3b82f6", // azul
  "#10b981", // verde
  "#ef4444", // rojo
  "#f59e0b", // ámbar
  "#8b5cf6", // morado
  "#ec4899", // rosa
  "#06b6d4", // cian
  "#f97316", // naranja
];

function toInput(type?: ClassType): ClassTypeInput {
  return {
    name: type?.name ?? "",
    description: type?.description ?? "",
    color: type?.color ?? "#3b82f6",
    durationMinutes: type?.durationMinutes ?? 60,
    defaultCapacity: type?.defaultCapacity ?? 20,
    isActive: type?.isActive ?? true,
  };
}

export function ClassTypeDialog({
  orgSlug,
  classType,
  trigger,
}: {
  orgSlug: string;
  classType?: ClassType;
  trigger?: (open: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!classType;

  const form = useForm<ClassTypeInput>({
    resolver: zodResolver(classTypeInputSchema),
    defaultValues: toInput(classType),
    mode: "onBlur",
  });
  const { errors, isSubmitting } = form.formState;
  const selectedColor = useWatch({ control: form.control, name: "color" });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      form.reset(toInput(classType));
      setServerError(null);
    }
  }

  async function onSubmit(values: ClassTypeInput) {
    setServerError(null);
    const res = isEdit
      ? await updateClassType(orgSlug, classType.id, values)
      : await createClassType(orgSlug, values);
    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [k, msg] of Object.entries(res.fieldErrors)) {
          form.setError(k as keyof ClassTypeInput, { message: msg });
        }
      } else {
        setServerError(res.error);
      }
      return;
    }
    toast.success(isEdit ? "Modalidad actualizada." : "Modalidad de clase creada.");
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      {trigger ? (
        trigger(() => handleOpenChange(true))
      ) : (
        <Button size="sm" onClick={() => handleOpenChange(true)}>
          <Plus className="size-4" />
          Nueva modalidad
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar modalidad" : "Nueva modalidad de clase"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Modifica la duración, capacidad sugerida y etiqueta visual de la clase."
                : "Crea un tipo de clase (ej. Spinning, Yoga, CrossFit) para programar sesiones."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="type-name">Nombre de la modalidad</FieldLabel>
                <Input
                  id="type-name"
                  placeholder="ej. Spinning, Funcional, Yoga"
                  autoFocus
                  aria-invalid={!!errors.name}
                  {...form.register("name")}
                />
                <FieldError errors={[errors.name]} />
              </Field>

              <Field data-invalid={!!errors.description}>
                <FieldLabel htmlFor="type-description">Descripción (opcional)</FieldLabel>
                <Input
                  id="type-description"
                  placeholder="ej. Entrenamiento cardiovascular de alta intensidad en bicicleta"
                  aria-invalid={!!errors.description}
                  {...form.register("description")}
                />
                <FieldError errors={[errors.description]} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={!!errors.durationMinutes}>
                  <FieldLabel htmlFor="type-duration">Duración (minutos)</FieldLabel>
                  <Input
                    id="type-duration"
                    type="number"
                    min={5}
                    max={480}
                    aria-invalid={!!errors.durationMinutes}
                    {...form.register("durationMinutes", { valueAsNumber: true })}
                  />
                  <FieldError errors={[errors.durationMinutes]} />
                </Field>

                <Field data-invalid={!!errors.defaultCapacity}>
                  <FieldLabel htmlFor="type-capacity">Aforo por defecto</FieldLabel>
                  <Input
                    id="type-capacity"
                    type="number"
                    min={1}
                    max={300}
                    aria-invalid={!!errors.defaultCapacity}
                    {...form.register("defaultCapacity", { valueAsNumber: true })}
                  />
                  <FieldError errors={[errors.defaultCapacity]} />
                </Field>
              </div>

              <div>
                <FieldLabel className="mb-2 block">Color identificador</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`size-7 rounded-full border transition-all ${
                        selectedColor === color
                          ? "ring-primary scale-110 ring-2 ring-offset-2"
                          : "border-border hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => form.setValue("color", color)}
                    />
                  ))}
                  <Input
                    type="text"
                    className="h-7 w-24 font-mono text-xs"
                    {...form.register("color")}
                  />
                </div>
                {errors.color && <FieldError errors={[errors.color]} />}
              </div>
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
                {isEdit ? "Guardar cambios" : "Crear modalidad"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
