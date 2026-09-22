"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { PlatformPlan } from "@/db/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { formatCOP } from "@/lib/money";
import { assignSubscription } from "@/modules/platform/actions";
import { assignSubscriptionSchema, type AssignSubscriptionInput } from "@/modules/platform/schema";

export function AssignSubscriptionForm({ orgId, plans }: { orgId: string; plans: PlatformPlan[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<AssignSubscriptionInput>({
    resolver: zodResolver(assignSubscriptionSchema) as never,
    defaultValues: {
      orgId,
      planId: plans[0]?.id ?? "",
      durationDays: 30,
      status: "active",
      notes: "",
    },
  });

  const { errors, isSubmitting } = form.formState;

  function onSubmit(values: AssignSubscriptionInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await assignSubscription(values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      toast.success("Suscripción asignada / renovada exitosamente.");
      form.reset({
        orgId,
        planId: values.planId,
        durationDays: 30,
        status: "active",
        notes: "",
      });
      router.refresh();
    });
  }

  function setPresetDays(days: number) {
    form.setValue("durationDays", days, { shouldValidate: true });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Asignar o renovar plan
        </CardTitle>
        <CardDescription>
          Selecciona el plan, la vigencia y si corresponde a una activación de pago o un periodo de
          prueba (trial).
        </CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <FieldGroup className="gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="planId">Plan SaaS</FieldLabel>
                <Controller
                  control={form.control}
                  name="planId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="planId">
                        <SelectValue placeholder="Selecciona un plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — {formatCOP(p.priceCents)}/mes
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.planId && <FieldError>{errors.planId.message}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="status">Tipo de activación</FieldLabel>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Tipo de activación" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo (Pago recibido / mensualidad)</SelectItem>
                        <SelectItem value="trial">Trial (Prueba gratuita)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.status && <FieldError>{errors.status.message}</FieldError>}
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="durationDays">Duración en días</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="durationDays"
                  type="number"
                  className="w-32"
                  aria-invalid={!!errors.durationDays}
                  {...form.register("durationDays")}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setPresetDays(15)}>
                  15 días
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPresetDays(30)}>
                  30 días (1 mes)
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPresetDays(90)}>
                  90 días (3 meses)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPresetDays(365)}
                >
                  365 días (1 año)
                </Button>
              </div>
              <FieldDescription>
                La fecha de inicio será hoy y se sumarán los días indicados para el vencimiento.
              </FieldDescription>
              {errors.durationDays && <FieldError>{errors.durationDays.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="notes">Notas internas (opcional)</FieldLabel>
              <Textarea
                id="notes"
                rows={2}
                placeholder="Ej: Pago realizado por Bancolombia ref #49821 / Concedido descuento de apertura"
                {...form.register("notes")}
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 border-t pt-4">
          <Button type="submit" disabled={isSubmitting || pending || plans.length === 0}>
            {(isSubmitting || pending) && <Spinner />}
            Confirmar activación
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
