"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { PlatformPlan } from "@/db/schema";
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
import { deletePlatformPlan } from "@/modules/platform/actions";
import { PlatformPlanDialog } from "./plan-dialog";

export function PlanRowActions({ plan }: { plan: PlatformPlan }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const res = await deletePlatformPlan(plan.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Plan eliminado.");
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <PlatformPlanDialog
        plan={plan}
        trigger={(open) => (
          <Button variant="outline" size="sm" onClick={open}>
            <Pencil data-icon="inline-start" className="size-3.5" />
            Editar
          </Button>
        )}
      />

      <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="text-destructive size-3.5" />
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar plan {plan.name}?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará el plan de la plataforma. Si algún gimnasio ya tiene este plan
              asignado, la eliminación será bloqueada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending && <Spinner />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
