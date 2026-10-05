"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUrlFilters } from "@/hooks/use-url-filters";
import { cn } from "@/lib/utils";

/**
 * Barra de filtros de uma listagem.
 *
 * A busca tem debounce de 350 ms: escrever na URL a cada tecla dispararia uma
 * requisição por tecla, e o `router.replace` por tecla também enche o histórico
 * do browser de entradas idênticas.
 *
 * `FilterSelect` (status, categoria…) usa o mesmo `useUrlFilters`, então as duas
 * metades da barra compartilham a URL e o botão "Limpar" apaga tudo de uma vez.
 */
export function FilterBar({
  children,
  searchPlaceholder = "Buscar…",
  searchParam = "search",
  className,
}: {
  /** Campos de filtro (select de status, período…). */
  children?: React.ReactNode;
  searchPlaceholder?: string;
  /** Nome do param de busca na URL. */
  searchParam?: string;
  className?: string;
}) {
  const { params, write, clear, pending } = useUrlFilters();

  const urlSearch = params.get(searchParam) ?? "";
  const [term, setTerm] = useState(urlSearch);

  // Espelho do que já está na URL. Serve de guarda para o debounce e sobrevive
  // a mudanças de URL vindas de fora (voltar/avançar, link compartilhado, limpar).
  const committed = useRef(urlSearch);

  useEffect(() => {
    committed.current = urlSearch;
    setTerm(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (term === committed.current) return;

    const timer = setTimeout(() => {
      committed.current = term;
      write((search) => {
        if (term.trim()) search.set(searchParam, term.trim());
        else search.delete(searchParam);
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [term, searchParam, write]);

  // Só a busca, não `page`: o rodapé de paginação já informa o total, e uma
  // pilha de botões aqui repetiria a mesma informação.
  const hasFilters = [...params.keys()].some((key) => key !== "page" && key !== "limit");

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-card border border-border bg-card p-3 sm:flex-row sm:items-center",
        pending && "opacity-70",
        className,
      )}
    >
      <div className="relative sm:w-72">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-foreground-faint"
          aria-hidden
        />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="pl-8"
        />
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={clear} className="shrink-0">
          <X aria-hidden />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Troca de página preservando os filtros ativos.
 *
 * Some quando há uma única página: um "Página 1 de 1" só ocupa espaço. O total
 * vem de `meta.total_pages` do Go, que pode ser 0 numa resposta vazia — daí o
 * `if (totalPages <= 1) return null`.
 */
export function PaginationBar({
  page,
  totalPages,
  totalItems,
  limit,
  className,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  className?: string;
}) {
  const { write, pending } = useUrlFilters();

  if (totalPages <= 1) return null;

  const from = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalItems);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 sm:flex-row",
        pending && "opacity-70",
        className,
      )}
    >
      <p className="text-xs text-foreground-faint">
        Mostrando <span className="tabular-nums text-foreground-muted">{from}</span>–
        <span className="tabular-nums text-foreground-muted">{to}</span> de{" "}
        <span className="tabular-nums text-foreground-muted">{totalItems}</span>
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            write((search) => search.set("page", String(page - 1)), { keepPage: true })
          }
          disabled={page <= 1}
        >
          Anterior
        </Button>
        <span className="px-2 text-xs text-foreground-muted">
          Página <span className="tabular-nums">{page}</span> de{" "}
          <span className="tabular-nums">{totalPages}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            write((search) => search.set("page", String(page + 1)), { keepPage: true })
          }
          disabled={page >= totalPages}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}