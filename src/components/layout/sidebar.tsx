"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV_GROUPS } from "@/config/nav";
import { cn } from "@/lib/utils";

/**
 * Barra lateral do painel.
 *
 * O item "/" (Dashboard) precisa de comparação exata: um `startsWith("/")`
 * marcaria todos os itens como ativos, já que todo caminho começa com "/".
 */
export function Sidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.href = "/login";
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-[#0a0a0a]">
      <div className="px-5 py-6">
        <Link href="/" className="block">
          <span className="text-lg font-bold tracking-[0.12em] text-accent">SQUESH</span>
          <span className="mt-0.5 block text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
            Painel admin
          </span>
        </Link>
      </div>

      <nav className="scrollbar-subtle flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label ?? groupIndex}>
            {group.label ? <p className="section-heading px-3 pb-2">{group.label}</p> : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                // Tela planejada (item.pending): aparece, mas não navega.
                // Deixar o link ativo só para cair num 404 parece bug; mostrar
                // desligado com o motivo no title diz ao admin a verdade — a
                // tela existe no plano e está esperando a rota no Go.
                if (item.pending) {
                  return (
                    <li key={item.href}>
                      <span
                        aria-disabled
                        title={item.pendingReason ?? item.description}
                        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground-faint"
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{item.label}</span>
                        <span className="ml-auto shrink-0 rounded border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-foreground-faint">
                          Breve
                        </span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={item.description}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-surface-2 font-medium text-foreground"
                          : "text-foreground-muted hover:bg-surface-2/60 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn("size-4 shrink-0", active && "text-accent")}
                        aria-hidden
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <p className="truncate px-3 pb-2 text-xs text-foreground-muted" title={adminName}>
          {adminName}
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground-muted transition-colors hover:bg-surface-2/60 hover:text-foreground"
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          Sair
        </button>
      </div>
    </aside>
  );
}
