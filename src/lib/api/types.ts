/**
 * Tipos do painel, espelhando 1:1 os structs/DTOs do backend Go.
 *
 * Referência: squesh_golang/internal/{domain,dto}
 * A análise que motivou cada decisão está em docs/analise-admin-panel.md.
 *
 * Regra: dinheiro é SEMPRE inteiro em centavos (`*_cents`). O Go nunca usa
 * float para dinheiro (ver comentário em domain/shop.go:14), então o painel
 * também não — a conversão para "R$ 119,90" acontece só na hora de exibir,
 * em `lib/format/currency.ts`.
 */

// ---------------------------------------------------------------- auth

export type UserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** POST /auth/login e POST /auth/refresh devolvem a mesma forma. */
export interface AuthTokensResponse {
  token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "Bearer";
  user: AuthUser;
}

/** GET /users/me — a resposta que o painel usa para validar a sessão. */
export interface UserProfile extends AuthUser {
  avatar_url: string;
  bio: string;
  streak: number;
  points: number;
  created_at: string;
}

// ---------------------------------------------------------------- dashboard

/** GET /admin/overview — objeto puro, sem envelope. */
export interface AdminOverview {
  shop_revenue_cents: number;
  paid_orders_count: number;
  pending_orders_count: number;
  canceled_orders_count: number;
  active_subscriptions: number;
  estimated_mrr_cents: number;
  trail_count: number;
  active_catalog_item_count: number;
}

// ---------------------------------------------------------------- loja

export type OrderStatus = "pending" | "paid" | "canceled";

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
}

export interface AdminAddress {
  recipient: string;
  street: string;
  number: string;
  complement: string;
  zip_code: string;
  city: string;
  state: string;
  label: string;
}

export interface ShopOrderItem {
  id: string;
  item_id: string;
  name: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
}

/**
 * GET /admin/orders
 *
 * `items`, `customer` e `address` vêm aninhados. O preço de cada linha é um
 * SNAPSHOT do momento da compra (domain/shop.go:59): editar o preço no catálogo
 * NÃO muda pedidos antigos, então a tela de detalhe mostra `unit_price_cents`,
 * nunca o preço atual do produto.
 */
export interface AdminOrder {
  id: string;
  status: OrderStatus;
  total_cents: number;
  paid_at: string | null;
  canceled_at: string | null;
  created_at: string;
  items: ShopOrderItem[];
  customer: AdminCustomer;
  address?: AdminAddress;
}

/**
 * GET /admin/shop — a listagem admin.
 *
 * É a ÚNICA rota que traz `is_active`: `GET /shop/:id` devolve o
 * `ShopItemResponseDTO` do app, sem o campo (dto/shop_dto.go). Por isso o
 * formulário de edição do catálogo parte da linha da tabela, e não de uma
 * segunda requisição de detalhe.
 */
export interface AdminShopItem {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  image_url: string;
  category: string;
  rating: number;
  is_active: boolean;
  created_at: string;
}

/** GET /shop/:id — o mesmo item visto pelo app, sem `is_active`. */
export interface ShopItemDetail {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  image_url: string;
  category: string;
  rating: number;
}

// ---------------------------------------------------------------- trilhas

export type TrailType = "workout" | "nutrition";

/**
 * Uma etapa interna de um item da trilha.
 *   - trilha de NUTRIÇÃO: a etapa (TrailItem) é um DIA e os Steps são as refeições;
 *   - trilha de TREINO:   a etapa é uma SESSÃO e os Steps são os exercícios.
 *
 * `required_hour` é hora de RELÓGIO (0-23) e o app compara com o relógio local do
 * dispositivo (trail_detail_modal.dart:51) — não é horário do servidor. Por isso
 * 0 = sem trava.
 * `done` é preenchido pelo backend com o progresso do usuário logado; o painel
 * não usa (mostra estatísticas agregadas).
 */
export interface StepSpec {
  slot: string;
  title: string;
  description: string;
  value: string;
  required_hour: number;
  done?: boolean;
}

/**
 * TrailItem é a ETAPA da trilha: um dia (nutrição) ou uma sessão (treino).
 * `steps` guarda as refeições/exercícios; vazio = check único.
 */
export interface TrailItem {
  id: string;
  trail_id: string;
  order: number;
  title: string;
  description: string;
  value: string;
  steps: StepSpec[];
  created_at: string;
  /** Transiente: preenchido pelo handler com o progresso do usuário logado. */
  completed?: boolean;
}

export interface Trail {
  id: string;
  title: string;
  description: string;
  type: TrailType;
  /**
   * Texto livre no backend (`varchar(20)`, sem validação) e o app exibe o valor
   * CRU, sem traduzir. O painel restringe via select e normaliza na escrita.
   * Ver TRAIL_LEVEL em lib/format/labels.ts.
   */
  level: string;
  items: TrailItem[];
  created_at: string;
  updated_at: string;
  /** Progresso agregado, só presente nas rotas admin de listagem. */
  items_count?: number;
  completions_count?: number;
}

// ---------------------------------------------------------------- assinaturas

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  period_months: number;
  badge: string;
  features: string[];
  highlight: string;
  is_popular: boolean;
  stripe_price_id: string;
  /** Só nas rotas admin: GET /plans é pública e devolve só planos ativos. */
  is_active?: boolean;
  sort_order?: number;
}

export type SubscriptionStatus = "active" | "canceled";

export interface AdminSubscription {
  id: string;
  status: SubscriptionStatus;
  started_at: string;
  renews_at: string;
  canceled_at?: string;
  /** true = o plano ainda vale AGORA (cancelada mas não vencida continua valendo). */
  is_current: boolean;
  plan: Plan;
  customer: AdminCustomer;
}

// ---------------------------------------------------------------- usuários

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string;
  bio: string;
  streak: number;
  points: number;
  last_active_date: string | null;
  created_at: string;
}

// ---------------------------------------------------------------- envelope

/** Formato padrão de paginação do Go (handler/helpers.go:pageLimit). */
export interface PageMeta {
  total_items: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}
