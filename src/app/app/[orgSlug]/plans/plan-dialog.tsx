"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { Plan } from "@/db/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { centsToPesos, formatCOP, parsePesosInput } from "@/lib/money";
import { createPlan, updatePlan } from "@/modules/plans/actions";
import {
  PLAN_COLOR_DOT,
  PLAN_COLOR_LABELS,
  PLAN_COLORS,
  durationLabel,
  planInputSchema,
  type PlanInput,
} from "@/modules/plans/schema";
import { cn } from "@/lib/utils";

const DURATION_ITEMS = [
  { value: "months", label: "Meses" },
  { value: "days", label: "Días" },
];
const COLOR_ITEMS = PLAN_COLORS.map((value) => ({ value, label: PLAN_COLOR_LABELS[value] }));

function toInput(plan?: Plan): PlanInput {
  return {
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    price: plan ? String(centsToPesos(plan.priceCents)) : "",
    durationType: plan?.durationType ?? "months",
    durationValue: plan?.durationValue ?? 1,
    visitLimit: plan?.visitLimit ?? "",
    color: (plan?.color as PlanInput["color"]) ?? "orange",
    isActive: plan?.isActive ?? true,
  };
}

export function PlanDialog({
  orgSlug,
  plan,
  trigger,
}: {
  orgSlug: string;
  plan?: Plan;
  trigger?: (open: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!plan;

  const form = useForm<PlanInput>({
    // raw: true → el form entrega los valores sin transformar; la Server Action vuelve a validar.
    resolver: zodResolver(planInputSchema, undefined, { raw: true }) as never,
    defaultValues: toInput(plan),
    mode: "onBlur",
  });
  const { errors, isSubmitting } = form.formState;
  const price = useWatch({ control: form.control, name: "price" });
  const durationType = useWatch({ control: form.control, name: "durationType" });
  const durationValue = useWatch({ control: form.control, name: "durationValue" });
  const priceCents = parsePesosInput(price ?? "");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      form.reset(toInput(plan));
      setServerError(null);
    }
  }

  async function onSubmit(values: PlanInput) {
    setServerError(null);
    const res = isEdit
      ? await updatePlan(orgSlug, plan.id, values)
      : await createPlan(orgSlug, values);
    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [key, messages] of Object.entries(res.fieldErrors)) {
          form.setError(key as keyof PlanInput, { message: messages[0] });
        }
      }
      setServerError(res.fieldErrors ? null : res.error);
      return;
    }
    toast.success(isEdit ? "Plan actualizado." : "Plan creado.");
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      {trigger ? (
        trigger(() => handleOpenChange(true))
      ) : (
        <Button size="lg" className="h-9" onClick={() => handleOpenChange(true)}>
          <Plus data-icon="inline-start" />
          Nuevo plan
        </Button>
      )}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar plan" : "Nuevo plan"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Los cambios no afectan membresías ya vendidas (guardan su propio precio)."
                : "Define duración y precio. Podrás archivarlo cuando dejes de venderlo."}
            </DialogDescription>
          </DialogHeader>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <form
            id="plan-form"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-5"
          >
            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="plan-name">Nombre</FieldLabel>
                <Input
                  id="plan-name"
                  className="h-10"
                  placeholder="Mensual, Trimestral, 10 visitas…"
                  aria-invalid={!!errors.name}
                  {...form.register("name")}
                />
                <FieldError errors={[errors.name]} />
              </Field>

              <Field data-invalid={!!errors.price}>
                <FieldLabel htmlFor="plan-price">Precio (COP)</FieldLabel>
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    $
                  </span>
                  <Input
                    id="plan-price"
                    inputMode="numeric"
                    className="h-10 pl-7 tabular-nums"
                    placeholder="120.000"
                    aria-invalid={!!errors.price}
                    aria-describedby="plan-price-help"
                    {...form.register("price")}
                  />
                </div>
                <FieldDescription id="plan-price-help">
                  {priceCents ? formatCOP(priceCents) : "Solo números, sin decimales."}
                </FieldDescription>
                <FieldError errors={[errors.price]} />
              </Field>

              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Field data-invalid={!!errors.durationValue}>
                  <FieldLabel htmlFor="plan-duration-value">Duración</FieldLabel>
                  <Input
                    id="plan-duration-value"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    className="h-10 tabular-nums"
                    aria-invalid={!!errors.durationValue}
                    {...form.register("durationValue")}
                  />
                  <FieldError errors={[errors.durationValue]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="plan-duration-type">Unidad</FieldLabel>
                  <Controller
                    control={form.control}
                    name="durationType"
                    render={({ field }) => (
                      <Select
                        items={DURATION_ITEMS}
                        value={field.value}
                        onValueChange={(v) => v && field.onChange(v)}
                      >
                        <SelectTrigger id="plan-duration-type" className="h-10 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DURATION_ITEMS.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                              {i.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>
              <FieldDescription className="-mt-3">
                Vigencia: {durationLabel(durationType, Number(durationValue) || 0)}.
              </FieldDescription>

              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={!!errors.visitLimit}>
                  <FieldLabel htmlFor="plan-visits">Límite de visitas</FieldLabel>
                  <Input
                    id="plan-visits"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    placeholder="Ilimitado"
                    className="h-10 tabular-nums"
                    aria-invalid={!!errors.visitLimit}
                    {...form.register("visitLimit")}
                  />
                  <FieldError errors={[errors.visitLimit]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="plan-color">Color</FieldLabel>
                  <Controller
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <Select
                        items={COLOR_ITEMS}
                        value={field.value}
                        onValueChange={(v) => v && field.onChange(v)}
                      >
                        <SelectTrigger id="plan-color" className="h-10 w-full">
                          <SelectValue>
                            {(value: string) => (
                              <span className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "size-3 rounded-full",
                                    PLAN_COLOR_DOT[value as keyof typeof PLAN_COLOR_DOT],
                                  )}
                                  aria-hidden="true"
                                />
                                {PLAN_COLOR_LABELS[value as keyof typeof PLAN_COLOR_LABELS]}
                              </span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {COLOR_ITEMS.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                              <span className="flex items-center gap-2">
                                <span
                                  className={cn("size-3 rounded-full", PLAN_COLOR_DOT[i.value])}
                                  aria-hidden="true"
                                />
                                {i.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              <Field data-invalid={!!errors.description}>
                <FieldLabel htmlFor="plan-description">Descripción (opcional)</FieldLabel>
                <Input
                  id="plan-description"
                  className="h-10"
                  placeholder="Acceso a todas las áreas, incluye clases grupales…"
                  aria-invalid={!!errors.description}
                  {...form.register("description")}
                />
                <FieldError errors={[errors.description]} />
              </Field>

              <Field orientation="horizontal">
                <Controller
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <Switch
                      id="plan-active"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked)}
                    />
                  )}
                />
                <FieldLabel htmlFor="plan-active" className="font-normal">
                  Disponible para vender
                </FieldLabel>
              </Field>
            </FieldGroup>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="plan-form" disabled={isSubmitting || pending}>
              {(isSubmitting || pending) && <Spinner />}
              {isEdit ? "Guardar cambios" : "Crear plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
