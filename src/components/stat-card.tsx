import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BadgeVariant } from "@/lib/format/labels";

/**
 * Cartão de indicador (KPI) do dashboard.
 *
 * O valor já vem pronto do formatador da tela (`formatCurrencyCompact`,
 * `formatNumber`) — o componente não formata nada, só apresenta. Assim o mesmo
 * cartão serve para dinheiro, contagem e texto.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  className,
}: {
  label: string;
  value: string;
  /** Complemento abaixo do valor: variação, período, observação. */
  hint?: string;
  icon?: LucideIcon;
  tone?: BadgeVariant;
  /** Quando presente, o cartão inteiro vira link. */
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="section-heading">{label}</p>
        {Icon ? <Icon className={cn("size-4 shrink-0", TONE_ICON[tone])} aria-hidden /> : null}
      </div>

      <p
        className={cn(
          "mt-3 text-2xl font-bold tabular-nums tracking-tight",
          TONE_VALUE[tone],
        )}
      >
        {value}
      </p>

      {hint ? <p className="mt-1 text-xs text-foreground-faint">{hint}</p> : null}
    </>
  );

  const shell = cn(
    "rounded-card border border-border bg-card p-4 transition-colors",
    href && "hover:border-border-strong hover:bg-surface-2/60",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cn(shell, "block")}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}

const TONE_ICON: Record<BadgeVariant, string> = {
  default: "text-foreground-faint",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-foreground-faint",
  accent: "text-accent",
  info: "text-foreground-secondary",
};

const TONE_VALUE: Record<BadgeVariant, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-foreground-secondary",
  accent: "text-foreground",
  info: "text-foreground",
};
