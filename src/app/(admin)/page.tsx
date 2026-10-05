import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Inbox, Map, PackageCheck, ShoppingBag, Users } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { ErrorState } from "@/components/error-state";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { currentAdmin, getOrders, getOverview } from "@/lib/api/queries";
import type { AdminOrder, AdminOverview } from "@/lib/api/types";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format/currency";
import { formatDateTime, formatRelative } from "@/lib/format/date";
import { formatNumber, percentOf } from "@/lib/format/number";
import { orderStatusLabel, orderStatusVariant } from "@/lib/format/labels";

export const metadata: Metadata = { title: "Dashboard — Squesh Admin" };

/** Quantos pedidos recentes cabem na tabela do dashboard. */
const RECENT_ORDERS = 6;

/**
 * Dashboard.
 *
 * Tudo vem de `GET /admin/overview`, que já existe no Go e devolve os oito
 * indicadores de uma vez (admin_handler.go:Overview), mais a última página de
 * pedidos de `GET /admin/orders`. Os gráficos de série temporal ficaram de fora
 * de propósito: exigiriam um endpoint novo (docs/analise-admin-panel.md §6.2) e
 * com a base ainda pequena um gráfico de uma linha só ocupa espaço e dá falsa
 * impressão de histórico. Quando o endpoint entrar, é uma seção nova aqui.
 */
export default async function DashboardPage() {
  const [admin, overview, recent] = await Promise.all([
    currentAdmin(),
    getOverview().catch(() => null),
    // Falha na lista de pedidos não derruba o dashboard: os KPIs são a
    // informação principal e a tabela é só um atalho para /entradas.
    getOrders({ limit: RECENT_ORDERS }).catch(() => null),
  ]);

  const firstName = admin?.name?.split(" ")[0] ?? "admin";

  return (
    <PageBody className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Olá, ${firstName}. Um resumo do que está acontecendo na loja, nas trilhas e na base de usuários.`}
      />

      {overview ? (
        <>
          <KpiSection overview={overview} />
          <RecentOrdersSection orders={recent?.data ?? null} overview={overview} />
        </>
      ) : (
        <ErrorState error={new Error("Não foi possível carregar os indicadores.")} />
      )}
    </PageBody>
  );
}

// ---------------------------------------------------------------- KPIs

function KpiSection({ overview }: { overview: AdminOverview }) {
  const paid = overview.paid_orders_count ?? 0;
  const pending = overview.pending_orders_count ?? 0;
  const canceled = overview.canceled_orders_count ?? 0;
  const total = paid + pending + canceled;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="section-heading">Loja</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Receita confirmada"
            value={formatCurrencyCompact(overview.shop_revenue_cents ?? 0)}
            hint="Soma dos pedidos pagos"
            tone="success"
            icon={ShoppingBag}
            href="/entradas"
          />
          <StatCard
            label="Pedidos pagos"
            value={formatNumber(paid)}
            hint={total > 0 ? `${percentOf(paid, total)}% de ${formatNumber(total)} pedidos` : "—"}
            icon={ShoppingBag}
            href="/entradas?status=paid"
          />
          <StatCard
            label="Aguardando pagamento"
            value={formatNumber(pending)}
            hint="Confirme para liberar a entrega"
            tone={pending > 0 ? "warning" : "muted"}
            icon={Inbox}
            href="/entradas?status=pending"
          />
          <StatCard
            label="Cancelados"
            value={formatNumber(canceled)}
            tone={canceled > 0 ? "danger" : "muted"}
            icon={PackageCheck}
            href="/entradas?status=canceled"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="section-heading">Assinaturas e conteúdo</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Assinaturas ativas"
            value={formatNumber(overview.active_subscriptions ?? 0)}
            hint="Planos válidos agora"
            icon={Users}
            href="/assinaturas"
          />
          <StatCard
            label="MRR estimado"
            value={formatCurrencyCompact(overview.estimated_mrr_cents ?? 0)}
            hint="Soma dos planos ativos"
            tone="accent"
            icon={Users}
            href="/assinaturas"
          />
          <StatCard
            label="Trilhas"
            value={formatNumber(overview.trail_count ?? 0)}
            hint="De treino e de alimentação"
            icon={Map}
            href="/trilhas/treino"
          />
          <StatCard
            label="Produtos ativos"
            value={formatNumber(overview.active_catalog_item_count ?? 0)}
            hint="Visíveis na loja do app"
            icon={PackageCheck}
            href="/catalogo"
          />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- recentes

const RECENT_COLUMNS: DataTableColumn<AdminOrder>[] = [
  {
    header: "Cliente",
    render: (order) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{order.customer?.name ?? "—"}</p>
        <p className="truncate text-xs text-foreground-faint">{order.customer?.email ?? "—"}</p>
      </div>
    ),
  },
  {
    header: "Itens",
    render: (order) => (
      <span className="tabular-nums text-foreground-muted">{order.items?.length ?? 0}</span>
    ),
    align: "right",
    hideBelow: "sm",
  },
  {
    header: "Total",
    render: (order) => (
      <span className="tabular-nums font-medium">{formatCurrency(order.total_cents ?? 0)}</span>
    ),
    align: "right",
  },
  {
    header: "Status",
    render: (order) => (
      <StatusBadge
        label={orderStatusLabel(order.status)}
        variant={orderStatusVariant(order.status)}
        dot
      />
    ),
  },
  {
    header: "Recebido",
    render: (order) => (
      <span className="text-xs text-foreground-muted" title={formatDateTime(order.created_at)}>
        {formatRelative(order.created_at)}
      </span>
    ),
    hideBelow: "md",
  },
];

function RecentOrdersSection({
  orders,
  overview,
}: {
  orders: AdminOrder[] | null;
  overview: AdminOverview;
}) {
  const totalOrders =
    (overview.paid_orders_count ?? 0) +
    (overview.pending_orders_count ?? 0) +
    (overview.canceled_orders_count ?? 0);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-heading">Pedidos recentes</h2>
        <Button variant="ghost" size="sm" render={<Link href="/entradas" />}>
          Ver todos
          <ArrowRight data-icon="inline-end" aria-hidden />
        </Button>
      </div>

      {orders === null ? (
        <p className="rounded-card border border-border bg-card p-4 text-sm text-foreground-muted">
          Não foi possível carregar os pedidos recentes.{" "}
          <Link href="/entradas" className="text-primary underline-offset-4 hover:underline">
            Abrir Entradas
          </Link>
          .
        </p>
      ) : (
        <DataTable
          columns={RECENT_COLUMNS}
          rows={orders}
          getRowKey={(order) => order.id}
          empty={
            <p className="px-6 py-10 text-center text-sm text-foreground-muted">
              Nenhum pedido recebido ainda.
            </p>
          }
          footer={
            <tr>
              <td colSpan={RECENT_COLUMNS.length} className="px-3 py-2.5 text-xs text-foreground-faint">
                {orders.length} de {formatNumber(totalOrders)} pedidos
              </td>
            </tr>
          }
        />
      )}
    </section>
  );
}
