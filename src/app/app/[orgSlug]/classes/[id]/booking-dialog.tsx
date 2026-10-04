"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { MemberPicker, type PickedMember } from "@/components/forms/member-picker";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { bookClassSession } from "@/modules/classes/actions";

export function BookingDialog({
  orgSlug,
  sessionId,
  isFull,
  trigger,
}: {
  orgSlug: string;
  sessionId: string;
  isFull: boolean;
  trigger?: (open: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<PickedMember | null>(null);
  const [notes, setNotes] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSelectedMember(null);
      setNotes("");
      setServerError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMember) {
      setServerError("Debes seleccionar un socio.");
      return;
    }

    setServerError(null);
    const res = await bookClassSession(orgSlug, {
      sessionId,
      memberId: selectedMember.id,
      notes: notes.trim() || undefined,
    });

    if (!res.ok) {
      setServerError(res.error);
      return;
    }

    toast.success("Socio inscrito correctamente a la clase.");
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <>
      {trigger ? (
        trigger(() => handleOpenChange(true))
      ) : (
        <Button
          size="sm"
          disabled={isFull}
          onClick={() => handleOpenChange(true)}
          title={isFull ? "Aforo completo" : "Inscribir socio"}
        >
          <UserPlus className="size-4" />
          Inscribir socio
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inscribir socio a la clase</DialogTitle>
            <DialogDescription>
              Busca y selecciona al socio que reservará su cupo en esta sesión.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <FieldGroup>
              <Field>
                <FieldLabel>Socio</FieldLabel>
                <MemberPicker
                  orgSlug={orgSlug}
                  value={selectedMember}
                  onChange={(m) => {
                    setSelectedMember(m);
                    if (serverError) setServerError(null);
                  }}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="booking-notes">Notas / Observaciones (opcional)</FieldLabel>
                <Input
                  id="booking-notes"
                  placeholder="ej. Reservó por teléfono, primera clase..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </FieldGroup>

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || !selectedMember}>
                {pending && <Spinner />}
                Confirmar inscripción
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
