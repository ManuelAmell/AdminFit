"use client";

import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { voidExpense } from "@/modules/expenses/actions";

export function VoidExpenseDialog({ orgSlug, expenseId }: { orgSlug: string; expenseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (reason.trim().length < 5) {
      setError("Explica el motivo (mínimo 5 caracteres)");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await voidExpense(orgSlug, { expenseId, reason });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Gasto anulado.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="destructive" className="h-9" onClick={() => setOpen(true)}>
        <Ban data-icon="inline-start" />
        Anular gasto
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular gasto</DialogTitle>
            <DialogDescription>
              El gasto quedará marcado como anulado y dejará de contar en los totales. No se
              elimina: queda registrado quién lo anuló y por qué.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="void-reason">Motivo</FieldLabel>
            <Input
              id="void-reason"
              className="h-11"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={!!error}
              placeholder="Ej: monto mal digitado, gasto duplicado"
              autoFocus
            />
            <FieldDescription>Queda en el historial de auditoría.</FieldDescription>
            <FieldError>{error}</FieldError>
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={submit} disabled={pending}>
              {pending && <Spinner />}
              Anular gasto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
