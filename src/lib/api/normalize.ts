import type { Paged, PageMeta, Trail } from "./types";
/**
 * O backend usa três formatos de resposta diferentes (ver
 * docs/analise-admin-panel.md §2.4):
 *
 *   { data: [...], meta: {...} }   GET /admin/orders, GET /admin/shop
 *   [ ... ]                        GET /admin/subscriptions, GET /trails, GET /plans
 *   { ... }                        GET /admin/overview
 *
 * e ainda há o caso especial de GET /trails/:id, que devolve o objeto CRU sem
 * token e { trail, progress } COM token.
 *
 * Estes normalizadores concentram essa bagunça em um lugar só, para que nenhuma
 * tela precise saber o formato de cada endpoint. Todo acesso a dados passa por
 * aqui.
 */

/** `[T] | { data: T[] }` -> `T[]`. Lista nunca sai null: vazio é `[]`. */
export function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && Array.isArray((res as { data?: unknown }).data)) {
    return (res as { data: T[] }).data;
  }
  return [];
}

/** `T | { data: T }` -> `T`. */
export function unwrapOne<T>(res: unknown): T | null {
  if (res === null || res === undefined) return null;
  if (typeof res !== "object") return res as T;
  const wrapped = res as { data?: unknown };
  if (wrapped.data !== undefined) return wrapped.data as T;
  return res as T;
}

/**
 * `T | { trail: T }` -> `T`.
 *
 * Só para GET /trails/:id: com Bearer token o handler devolve
 * `{ trail, progress }`; sem token devolve a trilha crua. O painel sempre manda
 * token, mas normalizar os dois formatos evita quebrar se isso mudar.
 */
export function unwrapTrail<T extends Trail>(res: unknown): T | null {
  const one = unwrapOne<T>(res);
  if (one && "trail" in one && !("items" in one)) {
    return (one as unknown as { trail: T }).trail;
  }
  return one;
}

/**
 * Qualquer formato de lista paginada -> `Paged<T>`.
 *
 * Quando a resposta é um array puro (ex.: `GET /admin/subscriptions` hoje), a
 * paginação é inferida do próprio array e a navegação funciona igual — só a
 * informação de "total de registros" fica indisponível, e `total_pages` é 1.
 */
export function normalizePage<T>(res: unknown, page = 1, limit = 20): Paged<T> {
  if (Array.isArray(res)) {
    return {
      data: res as T[],
      meta: { total_items: res.length, page, limit, total_pages: 1 },
    };
  }

  if (res && typeof res === "object") {
    const obj = res as { data?: unknown; meta?: Partial<PageMeta> };
    const items = Array.isArray(obj.data) ? (obj.data as T[]) : [];
    const meta = obj.meta ?? {};
    return {
      data: items,
      meta: {
        total_items: meta.total_items ?? items.length,
        page: meta.page ?? page,
        limit: meta.limit ?? limit,
        total_pages: meta.total_pages ?? 1,
      },
    };
  }

  return { data: [], meta: { total_items: 0, page, limit, total_pages: 0 } };
}
