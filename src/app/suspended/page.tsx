import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Cuenta suspendida — AdminFit" };

export default function SuspendedPage() {
  return (
    <div className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <Logo className="text-lg" />
      <ShieldAlert className="text-warning size-10" aria-hidden="true" />
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Este gimnasio está suspendido</h1>
        <p className="text-muted-foreground text-sm">
          El acceso fue pausado por el equipo de AdminFit. Escríbenos para reactivarlo.
        </p>
      </div>
    </div>
  );
}
