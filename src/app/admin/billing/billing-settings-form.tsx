"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { PlatformSettingsRow } from "@/db/schema";
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
import { updatePlatformSettings } from "@/modules/platform/actions";
import { platformSettingsSchema, type PlatformSettingsInput } from "@/modules/platform/schema";

export function BillingSettingsForm({ settings }: { settings: PlatformSettingsRow | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<PlatformSettingsInput>({
    resolver: zodResolver(platformSettingsSchema) as never,
    defaultValues: {
      bankHolderName: settings?.bankHolderName ?? "",
      bankName: settings?.bankName ?? "",
      bankAccountType: settings?.bankAccountType ?? "ahorros",
      bankAccountNumber: settings?.bankAccountNumber ?? "",
      nequiNumber: settings?.nequiNumber ?? "",
      additionalInfo: settings?.additionalInfo ?? "",
    },
  });

  const { errors, isSubmitting } = form.formState;

  function onSubmit(values: PlatformSettingsInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await updatePlatformSettings(values);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      toast.success("Datos bancarios actualizados correctamente.");
      router.refresh();
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Datos de pago para gimnasios
        </CardTitle>
        <CardDescription>
          Esta información se mostrará a los administradores y dueños de los gimnasios en su sección
          de configuración para que realicen las transferencias de pago de su suscripción SaaS.
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
            <Field>
              <FieldLabel htmlFor="bankHolderName">Nombre del titular / Razón social</FieldLabel>
              <Input
                id="bankHolderName"
                placeholder="Ej: Manuel Francisco Amell Gil o AdminFit SAS"
                aria-invalid={!!errors.bankHolderName}
                {...form.register("bankHolderName")}
              />
              {errors.bankHolderName && <FieldError>{errors.bankHolderName.message}</FieldError>}
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="bankName">Entidad bancaria</FieldLabel>
                <Input
                  id="bankName"
                  placeholder="Ej: Bancolombia, Davivienda, BBVA..."
                  aria-invalid={!!errors.bankName}
                  {...form.register("bankName")}
                />
                {errors.bankName && <FieldError>{errors.bankName.message}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor="bankAccountType">Tipo de cuenta</FieldLabel>
                <Controller
                  control={form.control}
                  name="bankAccountType"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(val) => field.onChange(val as "ahorros" | "corriente")}
                    >
                      <SelectTrigger id="bankAccountType">
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ahorros">Cuenta de ahorros</SelectItem>
                        <SelectItem value="corriente">Cuenta corriente</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="bankAccountNumber">Número de cuenta bancaria</FieldLabel>
                <Input
                  id="bankAccountNumber"
                  placeholder="Ej: 123-456789-00"
                  aria-invalid={!!errors.bankAccountNumber}
                  {...form.register("bankAccountNumber")}
                />
                {errors.bankAccountNumber && (
                  <FieldError>{errors.bankAccountNumber.message}</FieldError>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="nequiNumber">Número Nequi / Daviplata</FieldLabel>
                <Input
                  id="nequiNumber"
                  placeholder="Ej: 3001234567"
                  aria-invalid={!!errors.nequiNumber}
                  {...form.register("nequiNumber")}
                />
                {errors.nequiNumber && <FieldError>{errors.nequiNumber.message}</FieldError>}
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="additionalInfo">Instrucciones o notas adicionales</FieldLabel>
              <Textarea
                id="additionalInfo"
                rows={3}
                placeholder="Ej: Una vez realizada la transferencia, envía el comprobante por WhatsApp al 3001234567 con el nombre de tu gimnasio para la renovación inmediata."
                {...form.register("additionalInfo")}
              />
              <FieldDescription>
                Información adicional para agilizar la confirmación y activación del pago.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 border-t pt-4">
          <Button type="submit" disabled={isSubmitting || pending}>
            {(isSubmitting || pending) && <Spinner />}
            Guardar datos bancarios
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
