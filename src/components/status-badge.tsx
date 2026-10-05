import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BadgeVariant } from "@/lib/format/labels";

/**
 * Badge de status com as cores de feedback do app.
 *
 * O `Badge` do shadcn só tem variantes neutras (default/secondary/outline...),
 * então o painel carrega seu próprio mapa `BadgeVariant` -> classe. Os tons são
 * os do globals.css: success #4ADE80, warning #FFC107, danger #FF2E3B.
 */
const TONE: Record<BadgeVariant, string> = {
  default: "border-border bg-secondary text-foreground",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  accent: "border-primary/30 bg-primary/10 text-primary",
  info: "border-border-strong bg-surface-3 text-foreground-secondary",
  muted: "border-border bg-surface-3 text-foreground-muted",
};

export function StatusBadge({
  label,
  variant = "muted",
  className,
  dot = false,
}: {
  label: string;
  variant?: BadgeVariant;
  className?: string;
  /** Ponto colorido à esquerda — evita ler o texto para pegar a cor. */
  dot?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("h-6 gap-1.5 rounded-md px-2 font-medium", TONE[variant], className)}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {label}
    </Badge>
  );
}
