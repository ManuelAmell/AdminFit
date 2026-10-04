"use client";

import { Building2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteBranch } from "@/modules/branches/actions";
import type { BranchWithStats } from "@/modules/branches/queries";
import { BranchDialog } from "./branch-dialog";

export function BranchesTable({
  orgSlug,
  branches,
  canManage,
}: {
  orgSlug: string;
  branches: BranchWithStats[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<BranchWithStats | null>(null);

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await deleteBranch(orgSlug, deleteTarget.id);
    setDeleteTarget(null);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Sede "${deleteTarget.name}" eliminada.`);
    startTransition(() => router.refresh());
  }

  if (branches.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
            <Building2 className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-base font-medium">No hay sedes registradas</p>
            <p className="text-muted-foreground text-sm">
              Crea sedes para organizar a los socios según su ubicación de entrenamiento.
            </p>
          </div>
          {canManage && <BranchDialog orgSlug={orgSlug} />}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="text-center">Socios</TableHead>
                {canManage && (
                  <TableHead className="pr-6 text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="pl-6 font-medium">{b.name}</TableCell>
                  <TableCell className="text-muted-foreground">{b.address ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {b.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm tabular-nums">
                    {b.memberCount}
                  </TableCell>
                  {canManage && (
                    <TableCell className="pr-6 text-right">
                      <div className="flex justify-end gap-1">
                        <BranchDialog
                          orgSlug={orgSlug}
                          branch={b}
                          trigger={(open) => (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-8 p-0"
                              onClick={open}
                              title="Editar sede"
                            >
                              <Pencil className="size-4" />
                              <span className="sr-only">Editar</span>
                            </Button>
                          )}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive size-8 p-0"
                          onClick={() => setDeleteTarget(b)}
                          title="Eliminar sede"
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar sede</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar la sede &quot;{deleteTarget?.name}&quot;? Los socios
              asociados no serán eliminados pero quedarán sin sede asignada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirmDelete}>
              {pending && <Spinner />}
              Eliminar sede
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
