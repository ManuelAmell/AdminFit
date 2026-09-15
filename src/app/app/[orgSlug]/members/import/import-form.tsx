"use client";

import { CheckCircle2, Download, FileUp, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { importMembersCsv, type ImportSummary } from "@/modules/members/import-actions";

export function ImportForm({ orgSlug }: { orgSlug: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const base = `/app/${orgSlug}/members`;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Selecciona un archivo CSV.");
      return;
    }
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const res = await importMembersCsv(orgSlug, fd);
      if (!res.ok) return setError(res.error);
      setSummary(res.data);
      if (inputRef.current) inputRef.current.value = "";
      setFileName(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            1. Descarga la plantilla
          </CardTitle>
          <CardDescription>
            Columnas: tipo_documento, numero_documento, nombres, apellidos, email, telefono,
            fecha_nacimiento (AAAA-MM-DD), genero (F/M/otro), contacto_emergencia,
            telefono_emergencia, notas. Solo numero_documento, nombres y apellidos son obligatorias.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="h-10"
            nativeButton={false}
            render={<a href={`${base}/import/template`} />}
          >
            <Download data-icon="inline-start" />
            Descargar plantilla CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            2. Sube tu archivo
          </CardTitle>
          <CardDescription>
            Hasta 2 MB y 2000 filas. Los socios con documento ya registrado se omiten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel htmlFor="file">Archivo CSV</FieldLabel>
              <label
                htmlFor="file"
                className="border-input hover:bg-muted/50 focus-within:border-ring focus-within:ring-ring/50 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-within:ring-3"
              >
                <FileUp className="text-muted-foreground size-6" aria-hidden="true" />
                <span className="text-sm">
                  {fileName ?? "Haz clic para elegir el archivo o arrástralo aquí"}
                </span>
                <input
                  ref={inputRef}
                  id="file"
                  name="file"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                />
              </label>
              <FieldDescription>Codificación UTF-8, separado por comas.</FieldDescription>
            </Field>
            <div className="flex justify-end">
              <Button type="submit" className="h-10" disabled={pending}>
                {pending ? <Spinner /> : <Upload data-icon="inline-start" />}
                Importar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2} className="flex items-center gap-2">
              <CheckCircle2 className="text-success size-5" aria-hidden="true" />
              Importación completada
            </CardTitle>
            <CardDescription>
              {summary.inserted} {summary.inserted === 1 ? "socio importado" : "socios importados"}
              {summary.skipped.length > 0 &&
                ` · ${summary.skipped.length} ${summary.skipped.length === 1 ? "fila omitida" : "filas omitidas"}`}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {summary.skipped.length > 0 && (
              <Alert>
                <AlertTitle>Filas con errores</AlertTitle>
                <AlertDescription>
                  Corrige estas filas en tu archivo y vuelve a importarlas. Las demás ya quedaron
                  guardadas.
                </AlertDescription>
              </Alert>
            )}
            {summary.skipped.length > 0 && (
              <div className="max-h-80 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20 pl-4">Fila</TableHead>
                      <TableHead>Errores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.skipped.map((s) => (
                      <TableRow key={s.row}>
                        <TableCell className="pl-4 tabular-nums">{s.row}</TableCell>
                        <TableCell className="whitespace-normal">
                          <ul className="list-disc pl-4">
                            {s.errors.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-end">
              <Button className="h-10" nativeButton={false} render={<Link href={base} />}>
                Ver socios
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
