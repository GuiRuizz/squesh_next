"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Leitura/escrita dos filtros de listagem na URL.
 *
 * Todos os filtros do painel moram em `?…`, não no estado do componente: é o que
 * faz o filtro sobreviver a um F5, ser compartilhável por link e fazer o botão
 * "voltar" do browser desfazer a busca. O custo é este hook, que é a única
 * porta de escrita — a busca (`FilterBar`) e os selects (`FilterSelect`) passam
 * por ele, e assim nunca divergem sobre quando a página deve ser zerada.
 *
 * Por que `router.replace` e não `push`: trocar `?status=pending` para
 * `?status=paid` é trocar a mesma tela de vista, não avançar no histórico. Com
 * `push`, cada clique de filtro deixaria uma entrada para o botão voltar
 * desfazer, e o admin acabaria preso num labirinto de filtros.
 */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  /**
   * Aplica uma mutação sobre os params atuais e regrava a URL.
   *
   * Recebe a mutação em vez de um objeto de valores porque os usos reais
   * precisam de coisas que um objeto não expressa: o select precisa APAGAR um
   * param quando volta para "todos", e o "Limpar" precisa apagar tudo.
   *
   * `keepPage` existe por um motivo concreto: por padrão a escrita ZERA a
   * página, porque o registro que estava na página 5 do resultado anterior
   * provavelmente não existe no resultado filtrado e o admin cairia numa
   * página vazia logo depois de filtrar. A paginação é a única legítima a
   * querer a página mantida.
   */
  const write = useCallback(
    (mutate: (search: URLSearchParams) => void, options?: { keepPage?: boolean }) => {
      const search = new URLSearchParams(params.toString());
      mutate(search);

      if (!options?.keepPage) search.delete("page");

      startTransition(() => {
        router.replace(`${pathname}${search.size ? `?${search}` : ""}`, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  /** Apaga todos os filtros e volta para a primeira página. */
  const clear = useCallback(() => write(() => {}), [write]);

  return { params, write, clear, pending };
}