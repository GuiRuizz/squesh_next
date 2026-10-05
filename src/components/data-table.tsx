import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Tabela de dados das telas de listagem.
 *
 * Deliberadamente um componente de SERVER (sem "use client"): as telas já
 * buscaram os dados no servidor pelo BFF e a tabela só desenha. Isso mantém a
 * listagem sem bundle de JS — o JavaScript só entra nas células que precisam
 * de ação (botões, formulários), via islands.
 *
 * O `render` de cada célula recebe a linha inteira, para sempre montar conteúdo
 * composto (avatar + nome + e-mail, badge + contagem) sem repetir o acesso ao
 * item em várias colunas.
 */
export interface DataTableColumn<T> {
  /** Cabeçalho. ReactNode para casos como "Preço (un.)". */
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Alinhamento e largura; o padrão é texto à esquerda e conteúdo natural. */
  align?: "left" | "right" | "center";
  /** Esconde a coluna em telas estreitas (conteúdo secundário). */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  className?: string;
  headerClassName?: string;
}

const HIDE_BELOW: Record<NonNullable<DataTableColumn<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

const ALIGN: Record<NonNullable<DataTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
  error,
  loading = false,
  loadingRows = 8,
  onRetry,
  footer,
  className,
}: {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  getRowKey: (row: T) => string;
  /** Estado vazio. Só aparece quando `rows` está vazio e não houve erro. */
  empty?: ReactNode;
  error?: unknown;
  loading?: boolean;
  loadingRows?: number;
  onRetry?: () => void;
  /** Rodapé da tabela (agregados, totais). */
  footer?: ReactNode;
  className?: string;
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} className={className} />;

  if (loading) {
    return (
      <div className={cn("space-y-2 rounded-card border border-border bg-card p-4", className)}>
        {Array.from({ length: loadingRows }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className={cn("rounded-card border border-border bg-card", className)}>{empty}</div>;
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border bg-card",
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {columns.map((column, index) => (
              <TableHead
                key={index}
                className={cn(
                  "h-10 bg-surface-2/60 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground-faint",
                  ALIGN[column.align ?? "left"],
                  column.hideBelow ? HIDE_BELOW[column.hideBelow] : null,
                  column.headerClassName,
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowKey(row)} className="border-border">
              {columns.map((column, index) => (
                <TableCell
                  key={index}
                  className={cn(
                    "px-3 py-2.5",
                    ALIGN[column.align ?? "left"],
                    column.hideBelow ? HIDE_BELOW[column.hideBelow] : null,
                    column.className,
                  )}
                >
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>

        {footer ? (
          <tfoot className="border-t border-border bg-surface-2/40 text-sm">{footer}</tfoot>
        ) : null}
      </Table>
    </div>
  );
}

/** Atalho para o estado vazio padrão de uma listagem. */
export function tableEmpty(options: Parameters<typeof EmptyState>[0]): ReactNode {
  return <EmptyState {...options} />;
}
