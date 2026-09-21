import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Nuevo gimnasio — AdminFit" };

export default async function OnboardingPage() {
  const session = await requireUser();
  return (
    <div className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Logo className="self-center text-lg" />
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={1} className="text-xl">
              Registra tu gimnasio
            </CardTitle>
            <CardDescription>
              Hola, {session.user.name.split(" ")[0]}. Cuéntanos sobre tu gimnasio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
