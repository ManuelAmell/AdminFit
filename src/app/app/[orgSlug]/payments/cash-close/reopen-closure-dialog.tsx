"use client";

import { LockOpen } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { reopenCash } from "@/modules/cash/actions";

export function ReopenClosureDialog({
  orgSlug,
  closureId,
}: {
  orgSlug: string;
  closureId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await reopenCash(orgSlug, { closureId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Cierre reabierto.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" className="h-9" onClick={() => setOpen(true)}>
        <LockOpen data-icon="inline-start" />
        Reabrir
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir el cierre de este día</DialogTitle>
            <DialogDescription>
              Se podrá volver a cerrar la caja de esta fecha y sede. El cierre anterior queda en el
              historial (quién lo abrió y cuándo), no se borra.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Spinner />}
              Reabrir cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
