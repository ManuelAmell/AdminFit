import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión — AdminFit" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const registerHref = nextPath ? `/register?next=${encodeURIComponent(nextPath)}` : "/register";

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1} className="text-xl">
          Iniciar sesión
        </CardTitle>
        <CardDescription>Ingresa con tu correo y contraseña.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <LoginForm nextPath={nextPath} />
        <p className="text-muted-foreground text-center text-sm">
          ¿Aún no tienes cuenta?{" "}
          <Link
            href={registerHref}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Crea una cuenta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
