import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/api/endpoints";

/**
 * Leitura dos filtros de listagem a partir da URL.
 *
 * Todas as listagens do painel guardam o estado do filtro em `?…` (ver
 * `FilterBar` e `FilterSelect`). Isso mantém o filtro sobrevive a um F5, é
 * compartilhável e faz o botão "voltar" do browser desfazer a busca — mas
 * significa que cada tela precisa da mesma tradução de `searchParams` para
 * `number`, porque no App Router eles chegam como Promise e repetidos viram
 * array.
 *
 * Uma função só para isso evita oito telas repetindo o mesmo clamp de página.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ListFilters {
  /** Página pedida, já clampada em >= 1. */
  page: number;
  /** Itens por página, já clampada em 1..MAX_PAGE_SIZE. */
  limit: number;
  /** Qualquer outro filtro da tela (status, categoria, search, período…). */
  values: Record<string, string>;
}

export async function readFilters(input: Promise<RawSearchParams>): Promise<ListFilters> {
  const raw = await input;
  const values: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    // `?status=a&status=b` é um array; o primeiro vale, como no Go.
    const single = Array.isArray(value) ? value[0] : value;
    if (single) values[key] = single;
  }

  return {
    page: toInt(values.page, 1, 1, Number.MAX_SAFE_INTEGER),
    limit: toInt(values.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
    values,
  };
}

function toInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
