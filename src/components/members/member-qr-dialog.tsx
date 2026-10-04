"use client";

import { useEffect, useState } from "react";
import { Printer, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MemberQrDialog({
  member,
  orgName,
}: {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
    photoUrl?: string | null;
  };
  orgName: string;
}) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const fullName = `${member.firstName} ${member.lastName}`;
  const initials = `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase();
  const payload = `AF:${member.id}`;

  useEffect(() => {
    if (open) {
      QRCode.toDataURL(payload, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [open, payload]);

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <QrCode className="size-4" />
        Carnet QR
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Carnet digital de acceso</DialogTitle>
            <DialogDescription>
              Código QR para escaneo rápido en recepción y control de acceso.
            </DialogDescription>
          </DialogHeader>

          {/* Carnet imprimible */}
          <div className="bg-card flex flex-col items-center gap-4 rounded-xl border p-6 shadow-sm print:m-0 print:border-none print:shadow-none">
            <div className="text-center">
              <span className="text-primary text-xs font-semibold tracking-wider uppercase">
                {orgName}
              </span>
              <h3 className="text-lg font-bold">{fullName}</h3>
              <p className="text-muted-foreground font-mono text-xs">
                {member.documentType} {member.documentNumber}
              </p>
            </div>

            <Avatar className="size-20 border shadow-xs">
              <AvatarImage src={member.photoUrl ?? undefined} alt={fullName} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>

            <div className="rounded-lg border bg-white p-2 shadow-xs">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt={`QR de acceso para ${fullName}`} className="size-48" />
              ) : (
                <div className="bg-muted text-muted-foreground flex size-48 items-center justify-center text-xs">
                  Generando QR...
                </div>
              )}
            </div>

            <p className="text-muted-foreground text-center text-xs">
              Presenta este código en la recepción del gimnasio para validar tu ingreso.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="size-4" />
              Imprimir carnet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
