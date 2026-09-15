import type { Metadata } from "next";
import Link from "next/link";
import { RegisterWizard } from "./register-wizard";

export const metadata: Metadata = { title: "Registra tu gimnasio — AdminFit" };

export default async function RegisterPage(props: PageProps<"/register">) {
  const { next } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";

  return (
    <div className="flex flex-col gap-6">
      <RegisterWizard nextPath={nextPath} />
      <p className="text-muted-foreground text-center text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link
          href={loginHref}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
