import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { apiFetch, ApiError, readSession } from "./server";
import { API_PATHS } from "./endpoints";
import { REFRESH_COOKIE } from "./config";
import { normalizePage, unwrapList, unwrapOne } from "./normalize";
import type {
  AdminOrder,
  AdminOverview,
  AdminShopItem,
  AdminSubscription,
  AuthUser,
  Paged,
  Plan,
  ShopItemDetail,
  Trail,
  UserProfile,
} from "./types";

/**
 * Acesso a dados no servidor.
 *
 * Cada função é a ponte entre uma tela e o endpoint correspondente: aplica os
 * normalizadores de `normalize.ts` e devolve sempre a mesma forma, para as
 * páginas nunca lidarem com as inconsistências de envelope do Go.
 */

// ---------------------------------------------------------------- guardas

/**
 * Perfil do admin logado, memoizado por requisição.
 *
 * O `cache` do React garante UMA chamada a `/users/me` por render, mesmo que o
 * layout, a página e o cabeçalho peçam o mesmo dado. Sem isso, o dashboard
 * dispararia a mesma requisição três vezes — e, se o token tivesse expirado,
 * três refreshes (o segundo falharia, porque o Go rotaciona o refresh token em
 * auth_handler.go:173).
 */
const loadAdminProfile = cache(async (): Promise<UserProfile | null> => {
  const session = await readSession();
  if (!session) return null;

  try {
    return await apiFetch<UserProfile>(API_PATHS.me, { session });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

/**
 * Garante sessão ativa com papel de admin; senão redireciona.
 *
 * `AdminMiddleware` no Go já é a barreira real (403 para quem não é admin).
 * Esta checagem é defesa em profundidade: evita renderizar o shell do painel e
 * depois sair em erro em cada chamada.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const profile = await loadAdminProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/login?error=forbidden");

  return { id: profile.id, name: profile.name, email: profile.email, role: profile.role };
}

/** Lê o admin logado sem redirecionar — para telas que adaptam o layout. */
export async function currentAdmin(): Promise<AuthUser | null> {
  const profile = await loadAdminProfile();
  if (!profile || profile.role !== "admin") return null;
  return { id: profile.id, name: profile.name, email: profile.email, role: profile.role };
}

/** Encerra a sessão: apaga os cookies e avisa o backend para revogar o token. */
export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    try {
      await apiFetch(API_PATHS.logout, { method: "POST", body: { refresh_token: refreshToken } });
    } catch {
      // Token já revogado ou expirado: o objetivo — limpar o cookie — é
      // atingido de qualquer forma, então o erro do logout não deve impedir a
      // saída do painel.
    }
  }
}

// ---------------------------------------------------------------- dashboard

export async function getOverview(): Promise<AdminOverview> {
  const res = await apiFetch<AdminOverview>(API_PATHS.adminOverview);
  return unwrapOne<AdminOverview>(res) ?? ({} as AdminOverview);
}

// ---------------------------------------------------------------- pedidos

export interface OrderFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}

export async function getOrders(filters: OrderFilters = {}): Promise<Paged<AdminOrder>> {
  const { page = 1, limit = 20 } = filters;

  // O endpoint atual só aceita `status`; busca, período e ordenação entram junto
  // com os endpoints novos. Enviamos tudo — o Go ignora o que não conhece, e
  // quando a rota nova entrar o painel já está pronto sem mudar de tela.
  const res = await apiFetch(
    `${API_PATHS.adminOrders}?${new URLSearchParams(
      Object.entries({
        page: String(page),
        limit: String(limit),
        status: filters.status || undefined,
        search: filters.search || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      }).filter(([, v]) => v !== undefined && v !== "") as [string, string][],
    ).toString()}`,
  );

  return normalizePage<AdminOrder>(res, page, limit);
}

// ---------------------------------------------------------------- catálogo

export interface ShopItemFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  isActive?: boolean;
}

export async function getShopItems(
  filters: ShopItemFilters = {},
): Promise<Paged<AdminShopItem>> {
  const { page = 1, limit = 20 } = filters;

  const search = new URLSearchParams();
  search.set("page", String(page));
  search.set("limit", String(limit));
  if (filters.search) search.set("search", filters.search);
  if (filters.category) search.set("category", filters.category);
  if (filters.isActive !== undefined) search.set("is_active", String(filters.isActive));

  const res = await apiFetch(`${API_PATHS.adminShopItems}?${search.toString()}`);
  return normalizePage<AdminShopItem>(res, page, limit);
}

export async function getShopItem(id: string): Promise<ShopItemDetail | null> {
  const res = await apiFetch(API_PATHS.shopItem(id));
  return unwrapOne<ShopItemDetail>(res);
}

/** Categorias derivadas do catálogo — o app faz igual (shop_providers.dart:7). */
export async function getShopCategories(): Promise<string[]> {
  const items = await getShopItems({ limit: 100 });
  const seen = new Set<string>();
  for (const item of items.data) {
    const category = item.category?.trim();
    if (category) seen.add(category);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// ---------------------------------------------------------------- trilhas

export interface TrailFilters {
  page?: number;
  limit?: number;
  type?: string;
  level?: string;
  search?: string;
  isActive?: boolean;
}

export async function getTrails(filters: TrailFilters = {}): Promise<Paged<Trail>> {
  const { page = 1, limit = 20 } = filters;

  const search = new URLSearchParams();
  search.set("page", String(page));
  search.set("limit", String(limit));
  if (filters.type) search.set("type", filters.type);
  if (filters.level) search.set("level", filters.level);
  if (filters.search) search.set("search", filters.search);
  if (filters.isActive !== undefined) search.set("is_active", String(filters.isActive));

  const res = await apiFetch(`${API_PATHS.adminTrails}?${search.toString()}`);
  return normalizePage<Trail>(res, page, limit);
}

export async function getTrail(id: string): Promise<Trail | null> {
  const res = await apiFetch(API_PATHS.adminTrail(id));
  return unwrapOne<Trail>(res);
}

// ---------------------------------------------------------------- assinaturas

export async function getSubscriptions(): Promise<AdminSubscription[]> {
  const res = await apiFetch(API_PATHS.adminSubscriptions);
  return unwrapList<AdminSubscription>(res);
}

/**
 * Planos da vitrine.
 *
 * Vai para `GET /plans` (público), e não para `/admin/plans` que ainda não
 * existe no Go. A rota pública devolve array cru com os mesmos campos que a
 * tela precisa, então não há perda — só o filtro de `is_active = true`.
 */
export async function getPlans(): Promise<Plan[]> {
  const res = await apiFetch(API_PATHS.plans);
  return unwrapList<Plan>(res);
}
