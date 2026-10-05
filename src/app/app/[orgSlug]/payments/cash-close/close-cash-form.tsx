"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import AnimatedStepper from "@/components/smoothui/animated-stepper";
import { SubmitButton } from "@/components/motion/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { formatCOP, formatPesosLive, parsePesosInput } from "@/lib/money";
import { closeCash } from "@/modules/cash/actions";

// Arqueo en 3 pasos (Base → Conteo → Confirmar). No muestra en ningún momento lo que el
// sistema espera encontrar en caja: quien cuenta reporta lo que ve, no lo que "debería dar"
// — ese es el punto del arqueo ciego (Fase 5 slice 0 / 5.6). El resultado (esperado vs.
// contado) lo decide la página al recargar, según el permiso de quien mira.
export function CloseCashForm({
  orgSlug,
  dateISO,
  branchId,
}: {
  orgSlug: string;
  dateISO: string;
  branchId: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [openingCash, setOpeningCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const openingCents = parsePesosInput(openingCash) ?? 0;
  const countedCents = parsePesosInput(countedCash) ?? 0;

  function next() {
    if (step === 0 && !openingCash) {
      setError("Ingresa la base con la que abriste caja.");
      return;
    }
    if (step === 1 && !countedCash) {
      setError("Ingresa el efectivo que contaste.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, 2));
  }

  async function submit() {
    setError(null);
    setPending(true);
    const res = await closeCash(orgSlug, { dateISO, branchId, openingCash, countedCash, notes });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(
      res.data.blind ? "Cierre registrado." : "Cierre registrado. Revisa el resultado abajo.",
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <AnimatedStepper
        currentStep={step}
        variant="horizontal"
        steps={[
          { label: "Base", description: "Con qué abriste" },
          { label: "Conteo", description: "Efectivo en caja ahora" },
          { label: "Confirmar", description: "Registrar el cierre" },
        ]}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 0 && (
        <Field className="max-w-xs">
          <FieldLabel htmlFor="opening-cash">Base inicial</FieldLabel>
          <InputGroup>
            <InputGroupAddon>$</InputGroupAddon>
            <InputGroupInput
              id="opening-cash"
              inputMode="numeric"
              autoFocus
              value={openingCash}
              onChange={(e) => setOpeningCash(formatPesosLive(e.target.value))}
            />
          </InputGroup>
          <FieldDescription>El efectivo con el que empezaste el turno.</FieldDescription>
        </Field>
      )}

      {step === 1 && (
        <Field className="max-w-xs">
          <FieldLabel htmlFor="counted-cash">Efectivo contado</FieldLabel>
          <InputGroup>
            <InputGroupAddon>$</InputGroupAddon>
            <InputGroupInput
              id="counted-cash"
              inputMode="numeric"
              autoFocus
              value={countedCash}
              onChange={(e) => setCountedCash(formatPesosLive(e.target.value))}
            />
          </InputGroup>
          <FieldDescription>Cuenta el efectivo que hay en caja en este momento.</FieldDescription>
        </Field>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <dl className="bg-muted/50 grid max-w-xs grid-cols-2 gap-y-1 rounded-lg px-4 py-3 text-sm">
            <dt className="text-muted-foreground">Base</dt>
            <dd className="text-right tabular-nums">{formatCOP(openingCents)}</dd>
            <dt className="text-muted-foreground">Contado</dt>
            <dd className="text-right tabular-nums">{formatCOP(countedCents)}</dd>
          </dl>
          <Field className="max-w-sm">
            <FieldLabel htmlFor="close-notes">
              Notas <span className="text-muted-foreground font-normal">(opcional)</span>
            </FieldLabel>
            <Input
              id="close-notes"
              className="h-11"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: faltó cambio, se prestaron 10.000 para vueltas"
            />
          </Field>
        </div>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
            Atrás
          </Button>
        )}
        {step < 2 ? (
          <Button type="button" onClick={next}>
            Siguiente
          </Button>
        ) : (
          <SubmitButton type="button" loading={pending} onClick={submit}>
            Registrar cierre
          </SubmitButton>
        )}
      </div>
    </div>
  );
}
