import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/api/queries";
import { LoginForm } from "./login-form";

/**
 * Tela de login.
 *
 * Um admin que já tem cookie válido não deve ver esta tela: o guard abaixo
 * manda direto para o painel.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const admin = await currentAdmin();
  if (admin) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-[0.12em] text-accent">SQUESH</h1>
          <p className="mt-2 text-sm text-foreground-muted">Painel administrativo</p>
        </header>

        {error === "forbidden" ? (
          <p
            role="alert"
            className="mb-6 rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            Este painel é restrito a administradores.
          </p>
        ) : null}

        <Suspense fallback={<div className="h-64" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
