/**
 * Registro único dos caminhos da API Go.
 *
 * Nenhuma tela escreve a URL na mão: tudo passa por aqui, para que uma mudança
 * de rota no backend seja um ajuste em um lugar só. As rotas marcadas
 * `[NOVO]` são aditivas criadas para o Admin Panel (docs/analise-admin-panel.md
 * §6) — as demais já existiam no squesh_golang.
 */

export const API_PATHS = {
  // ------------------------------------------------------------- auth
  login: "/auth/login",
  refresh: "/auth/refresh",
  logout: "/auth/logout",
  me: "/users/me",

  // ------------------------------------------------------------- dashboard
  /** Objeto puro, sem envelope. */
  adminOverview: "/admin/overview",
  /** [NOVO] séries temporais para os gráficos */
  adminOverviewTimeseries: "/admin/overview/timeseries",

  // ------------------------------------------------------------- pedidos
  adminOrders: "/admin/orders",
  /**
   * Confirmação MANUAL de pagamento (admin_handler.go:MarkOrderPaid): entrega
   * os itens no inventário do usuário.
   *
   * NÃO confundir com `POST /shop/orders/:id/pay`, que é do APP e significa
   * "me dê o segredo para cobrar o cartão" (payment_handler.go:PayOrder).
   * `/admin/orders/:id/pay` é idempotente: na segunda chamada devolve 409
   * "Este pedido já está pago", e o painel trata isso como sucesso.
   */
  adminPayOrder: (orderId: string) => `/admin/orders/${orderId}/pay`,
  /** [NOVO] cancelamento de pedido pelo admin */
  adminCancelOrder: (orderId: string) => `/admin/orders/${orderId}/cancel`,

  // ------------------------------------------------------------- catálogo
  /** Lista admin: inclui itens desativados e traz `is_active`. */
  adminShopItems: "/admin/shop",
  /**
   * Detalhe de um item. É a rota PÚBLICA do Go (shop_handler.go:GetItemByID) e
   * por isso devolve `ShopItemResponseDTO`, SEM `is_active` — quem precisa do
   * status é a listagem admin. Por isso o painel edita a partir da linha da
   * tabela, sem refazer a requisição.
   */
  shopItem: (id: string) => `/shop/${id}`,
  adminCreateShopItem: "/shop",
  adminUpdateShopItem: (id: string) => `/shop/${id}`,
  adminDeleteShopItem: (id: string) => `/shop/${id}`,
  /**
   * Upload por URL assinada.
   *
   * O Go só aceita `folder: "posts" | "avatars"` (upload_handler.go:30), então
   * foto de produto hoje vai para `posts`. Separar em `shop` é o item [NOVO] do
   * docs/analise-admin-panel.md §6.6.
   */
  presign: "/uploads/presign",

  // ------------------------------------------------------------- entregas
  /** [NOVO] inventário global (o app só enxerga o próprio) */
  adminInventory: "/admin/inventory",

  // ------------------------------------------------------------- trilhas
  /** [NOVO] lista paginada com busca e filtro; `withItems` traz as etapas. */
  adminTrails: "/admin/trails",
  adminTrail: (id: string) => `/admin/trails/${id}`,
  adminTrailItems: (id: string) => `/admin/trails/${id}/items`,
  adminTrailItem: (itemId: string) => `/admin/trails/items/${itemId}`,
  adminTrailItemOrder: (id: string) => `/admin/trails/${id}/items/order`,
  /** Já existia (admin) e cria a trilha sem itens. */
  createTrail: "/trails",
  /** Já existia (admin). Cria uma etapa numa trilha. */
  addTrailItem: (id: string) => `/trails/${id}/items`,

  // ------------------------------------------------------------- assinaturas
  /**
   * Array cru (sem `meta`), com UMA assinatura por usuário e só as que ainda
   * valem hoje — `admin_handler.go:ListSubscriptions` filtra
   * `renews_at > now` e ignora as vencidas. Por isso a tela não tem paginação
   * nem histórico: as rotas novas (§6.5) é que dão isso.
   */
  adminSubscriptions: "/admin/subscriptions",
  /**
   * Vitrine de planos — rota PÚBLICA (`billing_handler.go:ListPlans`).
   *
   * É a única que existe hoje, e ela já serve ao painel: devolve array cru com
   * todos os campos que a tela precisa (preço, período, benefícios, destaque e
   * o `stripe_price_id`).
   *
   * A ressalva é que ela filtra `is_active = true` e não pagina: um plano
   * desativado simplesmente não aparece, então a tela não pode oferecer
   * "reativar". `adminPlans` é a rota [NOVO] que resolve isso (§6.5).
   */
  plans: "/plans",
  /** [NOVO] paginação + filtros, incluindo os planos inativos. */
  adminPlans: "/admin/plans",
  adminPlan: (id: string) => `/admin/plans/${id}`,
  /**
   * Liga um plano ao `price_xxx` criado no painel do Stripe. Única escrita de
   * plano que existe hoje (routes.go:218) — e ela não confia no admin: o Go
   * lê o price na Stripe e compara o valor com `price_cents` do banco antes de
   * gravar, respondendo 422 se divergirem.
   */
  adminPlanStripePrice: (id: string) => `/admin/plans/${id}/stripe-price`,

  // ------------------------------------------------------------- usuários
  /** [NOVO] não existe nada de admin de usuário hoje. */
  adminUsers: "/admin/users",
  adminUser: (id: string) => `/admin/users/${id}`,
  adminUserRole: (id: string) => `/admin/users/${id}/role`,
} as const;

// ---------------------------------------------------------------- query

export type QueryValue = string | number | boolean | undefined | null;

/**
 * Monta a query string ignorando valores vazios, para os filtros da UI poderem
 * passar tudo direto sem-if. `page` e `limit` seguem o padrão do Go
 * (handler/helpers.go:pageLimit): page começa em 1, limit máximo 100.
 */
export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
