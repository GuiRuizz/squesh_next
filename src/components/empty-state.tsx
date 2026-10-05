import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Estado vazio de uma tabela ou lista.
 *
 * Distingue dois casos que Outcome importa: não há nada gravado ainda
 * (`action` = criar o primeiro registro) e o filtro atual não retornou nada
 * (`hint` = limpar filtros). Sem essa distinção o admin acha que perdeu dados.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-foreground-faint">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-foreground-muted">{description}</p>
        ) : null}
      </div>

      {action ? (
        action.href ? (
          <Button size="sm" render={<Link href={action.href} />}>
            {action.label}
          </Button>
        ) : (
          <Button size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}
