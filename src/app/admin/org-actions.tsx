"use client";

import { LogIn, ShieldCheck, ShieldOff } from "lucide-react";
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
import { impersonateOwner, setOrgStatus } from "./actions";

export function AdminOrgActions({
  orgId,
  orgSlug,
  orgName,
  status,
  ownerUserId,
}: {
  orgId: string;
  orgSlug: string;
  orgName: string;
  status: string;
  ownerUserId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [impersonating, startImpersonate] = useTransition();
  const suspended = status === "suspended";

  function confirmToggle() {
    setError(null);
    startTransition(async () => {
      const res = await setOrgStatus(orgId, suspended ? "active" : "suspended");
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(suspended ? `${orgName} reactivado.` : `${orgName} suspendido.`);
      setOpen(false);
      router.refresh();
    });
  }

  function handleImpersonate(userId: string) {
    startImpersonate(async () => {
      const res = await impersonateOwner(orgSlug, userId);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <>
      {ownerUserId && (
        <Button
          variant="outline"
          size="sm"
          disabled={impersonating}
          onClick={() => handleImpersonate(ownerUserId)}
        >
          {impersonating ? <Spinner /> : <LogIn data-icon="inline-start" />}
          Impersonar
        </Button>
      )}
      <Button
        variant={suspended ? "outline" : "destructive"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {suspended ? (
          <ShieldCheck data-icon="inline-start" />
        ) : (
          <ShieldOff data-icon="inline-start" />
        )}
        {suspended ? "Reactivar" : "Suspender"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{suspended ? `Reactivar ${orgName}` : `Suspender ${orgName}`}</DialogTitle>
            <DialogDescription>
              {suspended
                ? "El equipo del gimnasio podrá volver a iniciar sesión y usar la plataforma."
                : "El equipo del gimnasio no podrá acceder hasta que reactives el gimnasio."}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant={suspended ? "default" : "destructive"}
              onClick={confirmToggle}
              disabled={pending}
            >
              {pending && <Spinner />}
              {suspended ? "Reactivar" : "Suspender"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
