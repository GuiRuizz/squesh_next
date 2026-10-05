import { cn } from "@/lib/utils";

/**
 * Cabeçalho padrão de toda tela do painel.
 *
 * O título segue o vocabulário do app: UPPERCASE com tracking largo
 * (`.section-heading` em globals.css é o mesmo tratamento dos cabeçalhos
 * SQUESH / LOJA / NOTIFICAÇÕES do Flutter). A descrição explica em uma frase o
 * que a tela resolve, para o admin não precisar abrir a doc para saber o que
 * está olhando.
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: string;
  description?: string;
  /** Botões à direita (criar, exportar, voltar…). */
  actions?: React.ReactNode;
  /** Linha secundária abaixo da descrição (contagem, período, filtros ativos). */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-bold uppercase tracking-[0.12em] text-foreground sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-foreground-muted">{description}</p>
        ) : null}
        {meta ? <div className="mt-2 text-xs text-foreground-faint">{meta}</div> : null}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Wrapper de conteúdo: largura máxima e respiro padrão das telas. */
export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
