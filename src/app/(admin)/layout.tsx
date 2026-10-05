import type { Metadata } from "next";
import { requireAdmin } from "@/lib/api/queries";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";

/**
 * Layout do painel (todas as telas autenticadas).
 *
 * `requireAdmin` roda no servidor antes de qualquer render: sem cookie válido
 * ou sem `role: "admin"`, a navegação é redirecionada para /login e nenhuma
 * tela chega a montar. É defesa em profundidade — a barreira real continua
 * sendo o `AdminMiddleware` do Go, que responde 403 a cada chamada.
 */
export const metadata: Metadata = {
  title: "Squesh Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar adminName={admin.name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
