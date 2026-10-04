"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Building2, CheckCircle2, Clock, ScanLine, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { performCheckin, type CheckinResultData } from "@/modules/checkins/actions";
import type { RecentCheckinRow } from "@/modules/checkins/queries";

type BranchOption = { id: string; name: string };

export function CheckinKiosk({
  orgSlug,
  branches,
  initialRecent,
}: {
  orgSlug: string;
  branches: BranchOption[];
  initialRecent: RecentCheckinRow[];
}) {
  const [identifier, setIdentifier] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(branches[0]?.id ?? null);
  const [lastResult, setLastResult] = useState<CheckinResultData | null>(null);
  const [recentList, setRecentList] = useState<RecentCheckinRow[]>(initialRecent);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);

  // Mantener el input siempre enfocado para lectura automática de escáneres
  useEffect(() => {
    inputRef.current?.focus();
  }, [lastResult]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const clean = identifier.trim();
    if (!clean) return;

    startTransition(async () => {
      const res = await performCheckin(orgSlug, {
        identifier: clean,
        branchId: selectedBranchId,
      });

      if (!res.ok) {
        toast.error(res.error);
        setLastResult(null);
        setIdentifier("");
        inputRef.current?.focus();
        return;
      }

      const checkinData = res.data;
      setLastResult(checkinData);
      setIdentifier("");

      // Añadir al listado en vivo
      const newRow: RecentCheckinRow = {
        id: checkinData.id,
        createdAt: new Date(checkinData.timestamp),
        status: checkinData.status,
        reason: checkinData.reason,
        memberId: checkinData.member.id,
        memberFirstName: checkinData.member.firstName,
        memberLastName: checkinData.member.lastName,
        memberDocument: checkinData.member.documentNumber,
        memberPhotoUrl: checkinData.member.photoUrl,
        planName: checkinData.planName,
        registeredByName: "Recepción",
      };

      setRecentList((prev) => [newRow, ...prev.slice(0, 39)]);

      if (checkinData.status === "granted") {
        toast.success(`Acceso concedido: ${checkinData.member.firstName}`);
      } else {
        toast.error(`Acceso denegado: ${checkinData.reason}`);
      }

      inputRef.current?.focus();
    });
  }

  const timeFmt = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-6">
      {/* Selector de sede y caja de escaneo */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle role="heading" aria-level={2} className="text-xl">
                Escanear o ingresar socio
              </CardTitle>
              <CardDescription>
                Pasa el código QR por el lector o escribe el número de documento y presiona Enter.
              </CardDescription>
            </div>
            {branches.length > 0 && (
              <div className="flex items-center gap-2">
                <Building2 className="text-muted-foreground size-4 shrink-0" />
                <Select
                  value={selectedBranchId ?? branches[0]?.id}
                  onValueChange={(v) => v && setSelectedBranchId(v)}
                >
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue placeholder="Seleccionar sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="text-muted-foreground absolute top-1/2 left-3.5 size-5 -translate-y-1/2" />
              <Input
                ref={inputRef}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Número de documento o escanear QR…"
                autoFocus
                disabled={isPending}
                className="h-14 pl-11 font-mono text-lg tracking-wide"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-14 px-8 text-base"
              disabled={isPending || !identifier.trim()}
            >
              {isPending ? <Spinner className="size-5" /> : "Validar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tarjeta de resultado inmediato de acceso */}
      {lastResult && (
        <Card
          className={`border-2 transition-all duration-300 ${
            lastResult.status === "granted"
              ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/20"
              : "border-destructive bg-destructive/10 dark:bg-destructive/20"
          }`}
        >
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="border-background size-16 shrink-0 border-2 shadow-xs">
                <AvatarImage
                  src={lastResult.member.photoUrl ?? undefined}
                  alt={`${lastResult.member.firstName} ${lastResult.member.lastName}`}
                />
                <AvatarFallback className="text-base font-bold">
                  {lastResult.member.firstName[0]}
                  {lastResult.member.lastName[0]}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold tracking-tight">
                    {lastResult.member.firstName} {lastResult.member.lastName}
                  </h3>
                  <Badge
                    variant={lastResult.status === "granted" ? "default" : "destructive"}
                    className="text-xs font-semibold"
                  >
                    {lastResult.status === "granted" ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> ACCESO CONCEDIDO
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <XCircle className="size-3.5" /> ACCESO DENEGADO
                      </span>
                    )}
                  </Badge>
                </div>

                <p className="text-muted-foreground font-mono text-sm">
                  {lastResult.member.documentType} {lastResult.member.documentNumber}
                  {lastResult.planName && (
                    <span className="text-foreground ml-2 font-sans font-medium">
                      • Plan: {lastResult.planName}
                    </span>
                  )}
                  {lastResult.visitLimit !== undefined && lastResult.visitLimit !== null && (
                    <span className="text-primary ml-2 font-sans font-medium">
                      ({lastResult.visitsUsed} / {lastResult.visitLimit} visitas)
                    </span>
                  )}
                </p>

                <p
                  className={`text-sm font-medium ${
                    lastResult.status === "granted"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-destructive"
                  }`}
                >
                  {lastResult.reason}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                setLastResult(null);
                inputRef.current?.focus();
              }}
            >
              Listo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Historial de accesos recientes en vivo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle role="heading" aria-level={2} className="text-base">
              Ingresos recientes (Hoy)
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {recentList.length} registros
            </Badge>
          </div>
          <CardDescription>
            Historial de validaciones procesadas en la terminal de acceso.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recentList.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              No hay ingresos registrados hoy todavía.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 pl-6">Hora</TableHead>
                  <TableHead>Socio</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="pr-6">Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentList.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground pl-6 font-mono text-xs tabular-nums">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {timeFmt.format(new Date(row.createdAt))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarImage src={row.memberPhotoUrl ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {row.memberFirstName[0]}
                            {row.memberLastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {row.memberFirstName} {row.memberLastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs tabular-nums">
                      {row.memberDocument}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.planName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.status === "granted" ? "default" : "destructive"}
                        className="text-[10px]"
                      >
                        {row.status === "granted" ? "Concedido" : "Denegado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground pr-6 text-xs">
                      {row.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
