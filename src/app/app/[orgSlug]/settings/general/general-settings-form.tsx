"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { SubmitButton, useSubmitFlash } from "@/components/motion/submit-button";
import { formatPesosLive } from "@/lib/money";
import { updateGeneralSettings } from "@/modules/settings/actions";

export function GeneralSettingsForm({
  orgSlug,
  initialDayPassPrice,
}: {
  orgSlug: string;
  initialDayPassPrice: string;
}) {
  const [dayPassPrice, setDayPassPrice] = useState(initialDayPassPrice);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { success, flashSuccess } = useSubmitFlash();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await updateGeneralSettings(orgSlug, { dayPassPrice });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Configuración guardada.");
    await flashSuccess();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-6">
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="dayPassPrice">Precio del pase del día</FieldLabel>
        <InputGroup>
          <InputGroupAddon>$</InputGroupAddon>
          <InputGroupInput
            id="dayPassPrice"
            inputMode="numeric"
            placeholder="15.000"
            value={dayPassPrice}
            onChange={(e) => setDayPassPrice(formatPesosLive(e.target.value))}
          />
        </InputGroup>
        <FieldDescription>
          Se precarga al registrar una venta rápida de pase del día. Déjalo vacío para ingresar el
          monto cada vez.
        </FieldDescription>
        <FieldError errors={[error ? { message: error } : undefined]} />
      </Field>

      <SubmitButton
        type="submit"
        className="h-10 w-fit"
        loading={pending}
        success={success}
        color="accent"
      >
        Guardar
      </SubmitButton>
    </form>
  );
}
