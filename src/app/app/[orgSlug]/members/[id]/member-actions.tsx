"use client";

import { MoreHorizontal, Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteMember, setMemberStatus } from "@/modules/members/actions";
import type { MemberStatus } from "@/modules/members/schema";

export function MemberActions({
  orgSlug,
  memberId,
  name,
  status,
  canUpdate,
  canDelete,
}: {
  orgSlug: string;
  memberId: string;
  name: string;
  status: MemberStatus;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const base = `/app/${orgSlug}/members`;

  function changeStatus(next: MemberStatus) {
    startTransition(async () => {
      const res = await setMemberStatus(orgSlug, memberId, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(next === "active" ? "Socio reactivado." : "Socio inactivado.");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteMember(orgSlug, memberId);
      setConfirmDelete(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${name} fue eliminado.`);
      router.replace(base);
      router.refresh();
    });
  }

  if (!canUpdate && !canDelete) return null;

  return (
    <>
      {canUpdate && (
        <Button
          variant="outline"
          className="h-9"
          nativeButton={false}
          render={<Link href={`${base}/${memberId}/edit`} />}
        >
          <Pencil data-icon="inline-start" />
          <span className="hidden sm:inline">Editar</span>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon" className="size-9" aria-label="Más acciones" />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {canUpdate &&
            (status === "active" ? (
              <DropdownMenuItem disabled={pending} onClick={() => changeStatus("inactive")}>
                <UserX />
                Marcar inactivo
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled={pending} onClick={() => changeStatus("active")}>
                <UserCheck />
                Reactivar
              </DropdownMenuItem>
            ))}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 />
                Eliminar socio
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar a {name}</DialogTitle>
            <DialogDescription>
              El socio dejará de aparecer en las listas. Su historial de membresías y pagos se
              conserva para reportes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
