"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { PlatformPlan } from "@/db/schema";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { centsToPesos, formatCOP, parsePesosInput } from "@/lib/money";
import { createPlatformPlan, updatePlatformPlan } from "@/modules/platform/actions";
import { platformPlanSchema, type PlatformPlanInput } from "@/modules/platform/schema";

type FormValues = {
  name: string;
  description?: string;
  price: string;
  maxMembers?: string | number | null;
  maxBranches?: string | number | null;
  maxStaff?: string | number | null;
  isActive: boolean;
};

function toInput(plan?: PlatformPlan): FormValues {
  return {
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    price: plan ? String(centsToPesos(plan.priceCents)) : "",
    maxMembers: plan?.maxMembers != null ? String(plan.maxMembers) : "",
    maxBranches: plan?.maxBranches != null ? String(plan.maxBranches) : "",
    maxStaff: plan?.maxStaff != null ? String(plan.maxStaff) : "",
    isActive: plan?.isActive ?? true,
  };
}

export function PlatformPlanDialog({
  plan,
  trigger,
}: {
  plan?: PlatformPlan;
  trigger?: (open: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!plan;

  const form = useForm<FormValues>({
    resolver: zodResolver(platformPlanSchema, undefined, { raw: true }) as never,
    defaultValues: toInput(plan),
    mode: "onBlur",
  });
  const { errors, isSubmitting } = form.formState;
  const price = useWatch({ control: form.control, name: "price" });
  const priceCents = parsePesosInput(price ?? "");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      form.reset(toInput(plan));
      setServerError(null);
    }
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const payload: PlatformPlanInput = {
        name: values.name,
        description: values.description,
        price: values.price,
        maxMembers: values.maxMembers ? Number(values.maxMembers) : null,
        maxBranches: values.maxBranches ? Number(values.maxBranches) : null,
        maxStaff: values.maxStaff ? Number(values.maxStaff) : null,
        isActive: values.isActive,
      };

      const res = isEdit
        ? await updatePlatformPlan(plan.id, payload)
        : await createPlatformPlan(payload);

      if (!res.ok) {
        setServerError(res.error);
        return;
      }

      toast.success(isEdit ? "Plan actualizado correctamente." : "Plan creado correctamente.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {trigger ? (
        trigger(() => handleOpenChange(true))
      ) : (
        <Button onClick={() => handleOpenChange(true)}>
          <Plus data-icon="inline-start" />
          Nuevo plan SaaS
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isEdit ? `Editar ${plan.name}` : "Nuevo plan SaaS"}</DialogTitle>
              <DialogDescription>
                Define la tarifa mensual y los límites de uso para los gimnasios.
              </DialogDescription>
            </DialogHeader>

            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="name">Nombre del plan</FieldLabel>
                <Input
                  id="name"
                  placeholder="Ej: Básico, Estándar, Pro..."
                  aria-invalid={!!errors.name}
                  {...form.register("name")}
                />
                {errors.name && <FieldError>{errors.name.message}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="description">Descripción (opcional)</FieldLabel>
                <Textarea
                  id="description"
                  rows={2}
                  placeholder="Ej: Para gimnasios pequeños con una sola sede"
                  {...form.register("description")}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="price">Precio mensual (COP)</FieldLabel>
                <Input
                  id="price"
                  type="number"
                  placeholder="Ej: 120000"
                  aria-invalid={!!errors.price}
                  {...form.register("price")}
                />
                <FieldDescription>
                  {priceCents
                    ? `Equivale a ${formatCOP(priceCents)} / mes`
                    : "Ingresa el valor en pesos"}
                </FieldDescription>
                {errors.price && <FieldError>{errors.price.message}</FieldError>}
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field>
                  <FieldLabel htmlFor="maxMembers" className="text-xs">
                    Máx. socios
                  </FieldLabel>
                  <Input
                    id="maxMembers"
                    type="number"
                    placeholder="∞"
                    {...form.register("maxMembers")}
                  />
                  <FieldDescription className="text-[11px]">Vacío = ilimitado</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="maxBranches" className="text-xs">
                    Máx. sedes
                  </FieldLabel>
                  <Input
                    id="maxBranches"
                    type="number"
                    placeholder="∞"
                    {...form.register("maxBranches")}
                  />
                  <FieldDescription className="text-[11px]">Vacío = ilimitado</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="maxStaff" className="text-xs">
                    Máx. equipo
                  </FieldLabel>
                  <Input
                    id="maxStaff"
                    type="number"
                    placeholder="∞"
                    {...form.register("maxStaff")}
                  />
                  <FieldDescription className="text-[11px]">Vacío = ilimitado</FieldDescription>
                </Field>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <FieldLabel htmlFor="isActive" className="cursor-pointer">
                    Plan activo
                  </FieldLabel>
                  <FieldDescription>Disponible para asignar a gimnasios</FieldDescription>
                </div>
                <Controller
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>
            </FieldGroup>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting || pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || pending}>
                {(isSubmitting || pending) && <Spinner />}
                {isEdit ? "Guardar cambios" : "Crear plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
