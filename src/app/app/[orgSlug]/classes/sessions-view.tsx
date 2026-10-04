"use client";

import {
  Calendar,
  CalendarX,
  ChevronRight,
  Clock,
  MapPin,
  User,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cancelClassSession } from "@/modules/classes/actions";
import type { SessionListItem } from "@/modules/classes/queries";

export function SessionsView({
  orgSlug,
  sessions,
  canManage,
}: {
  orgSlug: string;
  sessions: SessionListItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleCancelSession(session: SessionListItem) {
    const reason = prompt(
      `¿Deseas cancelar la clase de "${session.classType.name}" a las ${session.startTime}?\nIngresa el motivo de cancelación:`,
      "Cancelada por administración",
    );
    if (reason === null) return;

    const res = await cancelClassSession(orgSlug, session.id, reason);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Clase cancelada exitosamente.");
    startTransition(() => router.refresh());
  }

  if (sessions.length === 0) {
    return (
      <div className="border-border/60 bg-muted/20 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <CalendarX className="text-muted-foreground mb-3 size-10" />
        <h3 className="text-foreground text-base font-medium">No hay clases programadas</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          No se encontraron clases para el periodo o filtros seleccionados. Programa una nueva
          sesión para empezar.
        </p>
      </div>
    );
  }

  // Agrupar sesiones por fecha
  const groupedByDate = new Map<string, SessionListItem[]>();
  for (const s of sessions) {
    const list = groupedByDate.get(s.date) ?? [];
    list.push(s);
    groupedByDate.set(s.date, list);
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(groupedByDate.entries()).map(([dateStr, daySessions]) => {
        // Formatear fecha para Colombia (ej. "Jueves, 10 de abril")
        const dateObj = new Date(`${dateStr}T12:00:00Z`);
        const formattedDate = dateObj.toLocaleDateString("es-CO", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        return (
          <div key={dateStr} className="flex flex-col gap-3">
            <div className="border-border flex items-center gap-2 border-b pb-2">
              <Calendar className="text-primary size-4" />
              <h3 className="text-foreground text-sm font-semibold capitalize">{formattedDate}</h3>
              <Badge variant="secondary" className="text-xs font-normal">
                {daySessions.length} {daySessions.length === 1 ? "clase" : "clases"}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {daySessions.map((s) => {
                const isFull = s.bookedCount >= s.capacity;
                const isCancelled = s.status === "cancelled";
                const percentage = Math.min(100, Math.round((s.bookedCount / s.capacity) * 100));

                return (
                  <Card
                    key={s.id}
                    className={`overflow-hidden border transition-all hover:shadow-xs ${
                      isCancelled ? "bg-muted/40 border-dashed opacity-60" : "bg-card border-border"
                    }`}
                  >
                    <div
                      className="h-1.5 w-full"
                      style={{ backgroundColor: isCancelled ? "#9ca3af" : s.classType.color }}
                    />
                    <CardContent className="flex flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-foreground text-base font-semibold">
                              {s.classType.name}
                            </h4>
                            {isCancelled && (
                              <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                                Cancelada
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                            <Clock className="size-3.5" />
                            <span>
                              {s.startTime} – {s.endTime}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              isCancelled
                                ? "bg-muted text-muted-foreground"
                                : isFull
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-primary/10 text-primary"
                            }`}
                          >
                            <Users className="size-3" />
                            {s.bookedCount}/{s.capacity}
                          </span>
                        </div>
                      </div>

                      {/* Barra de aforo */}
                      {!isCancelled && (
                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isFull
                                ? "bg-destructive"
                                : percentage > 75
                                  ? "bg-amber-500"
                                  : "bg-primary"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      )}

                      <div className="text-muted-foreground border-border/50 flex flex-col gap-1 border-t pt-2.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <User className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {s.trainer
                              ? `${s.trainer.firstName} ${s.trainer.lastName}`
                              : "Sin instructor asignado"}
                          </span>
                        </div>
                        {s.branchName && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="size-3.5 shrink-0" />
                            <span className="truncate">{s.branchName}</span>
                          </div>
                        )}
                        {isCancelled && s.cancelReason && (
                          <div className="text-destructive mt-1 text-[11px] italic">
                            Motivo: {s.cancelReason}
                          </div>
                        )}
                      </div>

                      <div className="border-border/50 flex items-center justify-between gap-2 border-t pt-1">
                        {canManage && !isCancelled && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 h-8 px-2 text-xs"
                            disabled={pending}
                            onClick={() => handleCancelSession(s)}
                          >
                            <XCircle className="mr-1 size-3.5" />
                            Cancelar
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto h-8 gap-1 text-xs"
                          nativeButton={false}
                          render={
                            <Link href={`/app/${orgSlug}/classes/${s.id}`}>
                              <span>Reservas & Aforo</span>
                              <ChevronRight className="size-3.5" />
                            </Link>
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
