"use client";

import { Check, Phone, Trash2, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cancelBooking, updateBookingStatus } from "@/modules/classes/actions";
import type { SessionDetails } from "@/modules/classes/queries";

export function AttendanceTable({
  orgSlug,
  session,
  canManage,
}: {
  orgSlug: string;
  session: SessionDetails;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleStatusChange(
    bookingId: string,
    status: "confirmed" | "attended" | "no_show",
  ) {
    const res = await updateBookingStatus(orgSlug, { bookingId, status });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Asistencia actualizada.");
    startTransition(() => router.refresh());
  }

  async function handleCancel(bookingId: string, memberName: string) {
    if (!confirm(`¿Cancelar la reserva de ${memberName}?`)) {
      return;
    }
    const res = await cancelBooking(orgSlug, bookingId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Reserva cancelada.");
    startTransition(() => router.refresh());
  }

  if (session.bookings.length === 0) {
    return (
      <div className="border-border/60 bg-muted/20 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <UserCheck className="text-muted-foreground mb-3 size-10" />
        <h3 className="text-foreground text-base font-medium">No hay socios inscritos</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Aún no se han registrado reservas para esta clase. Utiliza el botón superior para
          inscribir socios.
        </p>
      </div>
    );
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Socio</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Fecha de reserva</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Notas</TableHead>
            {canManage && <TableHead className="text-right">Control de Asistencia</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {session.bookings.map((b) => {
            const member = b.member;
            const initials =
              `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
            const isCancelled = b.status === "cancelled";
            const isAttended = b.status === "attended";
            const isNoShow = b.status === "no_show";

            const bookedDate = new Date(b.bookedAt).toLocaleString("es-CO", {
              dateStyle: "short",
              timeStyle: "short",
            });

            return (
              <TableRow key={b.id} className={isCancelled ? "bg-muted/30 opacity-60" : undefined}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      {member.photoUrl && (
                        <AvatarImage src={member.photoUrl} alt={member.firstName} />
                      )}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <Link
                        href={`/app/${orgSlug}/members/${member.id}`}
                        className="text-foreground font-medium hover:underline"
                      >
                        {member.firstName} {member.lastName}
                      </Link>
                      <div className="text-muted-foreground text-xs">
                        {member.documentType} {member.documentNumber}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {member.phone ? (
                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <Phone className="text-muted-foreground size-3" />
                      <span>{member.phone}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">Sin teléfono</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-xs">{bookedDate}</span>
                </TableCell>
                <TableCell>
                  {isAttended && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    >
                      Asistió
                    </Badge>
                  )}
                  {b.status === "confirmed" && (
                    <Badge
                      variant="outline"
                      className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    >
                      Inscrito
                    </Badge>
                  )}
                  {isNoShow && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    >
                      No asistió
                    </Badge>
                  )}
                  {isCancelled && (
                    <Badge variant="destructive" className="text-xs">
                      Cancelada
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {b.notes ? (
                    <span className="text-muted-foreground line-clamp-1 text-xs">{b.notes}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">—</span>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!isCancelled ? (
                        <>
                          <Button
                            size="icon-sm"
                            variant={isAttended ? "default" : "outline"}
                            className={
                              isAttended
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "text-emerald-600 hover:bg-emerald-500/10"
                            }
                            disabled={pending}
                            onClick={() => handleStatusChange(b.id, "attended")}
                            title="Marcar como asistió"
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant={isNoShow ? "default" : "outline"}
                            className={
                              isNoShow
                                ? "bg-amber-600 text-white hover:bg-amber-700"
                                : "text-amber-600 hover:bg-amber-500/10"
                            }
                            disabled={pending}
                            onClick={() => handleStatusChange(b.id, "no_show")}
                            title="Marcar como no asistió"
                          >
                            <UserX className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            disabled={pending}
                            onClick={() =>
                              handleCancel(b.id, `${member.firstName} ${member.lastName}`)
                            }
                            title="Cancelar reserva"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground text-xs"
                          disabled={pending}
                          onClick={() => handleStatusChange(b.id, "confirmed")}
                        >
                          Reactivar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
