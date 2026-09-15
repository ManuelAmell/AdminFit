import { Dumbbell, Users, CreditCard, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const modules = [
  {
    icon: Users,
    title: "Socios",
    description: "Ficha completa, historial de membresías y estado de pago en tiempo real.",
  },
  {
    icon: CreditCard,
    title: "Membresías y pagos",
    description: "Venta de planes, renovaciones, pagos manuales y recibos numerados.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "KPIs de ingresos, vencimientos y morosidad por sede.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
          <Dumbbell className="size-6" aria-hidden="true" />
        </span>
        <div className="flex flex-col items-center gap-2">
          <Badge variant="secondary" className="font-medium">
            En construcción — Fase 0
          </Badge>
          <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
            AdminFit
          </h1>
          <p className="text-muted-foreground max-w-md text-balance">
            Plataforma multi-tenant para administrar socios, membresías y pagos de gimnasios en
            Colombia.
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {modules.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="text-primary size-5" aria-hidden="true" />
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </main>
  );
}
