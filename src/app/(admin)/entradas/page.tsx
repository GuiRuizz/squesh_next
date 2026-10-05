import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/error-state";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { FilterBar, PaginationBar } from "@/components/filter-bar";
import { FilterSelect } from "@/components/filter-select";
import { Inbox } from "lucide-react";
import { getOrders } from "@/lib/api/queries";
import type { AdminOrder } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime, formatRelative } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { orderStatusLabel, orderStatusVariant } from "@/lib/format/labels";
import { readFilters, type RawSearchParams } from "@/lib/search-params";
import { OrderActions } from "./order-actions";

export const metadata: Metadata = { title: "Entradas — Squesh Admin" };

const STATUS_OPTIONS = [
  { value: "pending", label: "Aguardando pagamento" },
  { value: "paid", label: "Pago" },
  { value: "canceled", label: "Cancelado" },
];

const COLUMNS: Array<DataTableColumn<AdminOrder>> = [
  {
    header: "Pedido",
    render: (order) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{order.customer?.name ?? "—"}</p>
        <p className="truncate text-xs text-foreground-faint">{order.customer?.email ?? "—"}</p>
      </div>
    ),
  },
  {
    header: "Itens",
    render: (order) => (
      <span className="tabular-nums text-foreground-muted">
        {order.items?.length ?? 0}
        {order.items?.length === 1 ? " produto" : " produtos"}
      </span>
    ),
    hideBelow: "sm",
  },
  {
    header: "Total",
    render: (order) => (
      <span className="tabular-nums font-medium">{formatCurrency(order.total_cents)}</span>
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
    hideBelow: "lg",
  },
  {
    header: "Ações",
    render: (order) => <OrderActions order={order} />,
    align: "right",
    headerClassName: "text-right",
  },
];

/**
 * Entradas — pedidos recebidos e confirmação de pagamento.
 *
 * Não há nada de "entrega física" aqui: a loja é 100% digital, então a fila é
 * "pedido chegou, o pagamento entrou?". A confirmação chama
 * `POST /admin/orders/:id/pay` (`shop_handler.go:MarkOrderPaid`), que é o mesmo
 * `service.FulfillOrderPaid` que o webhook do Stripe usa — um caminho só de
 * entrega, para os dois nunca divergirem sobre quando o item entra no inventário.
 *
 * Cancelamento de pedido pelo admin NÃO aparece: a rota não existe no Go ainda
 * (docs/analise-admin-panel.md §6.4), e o cancelamento pelo próprio usuário já
 * está em `POST /shop/orders/:id/cancel`.
 */
export default async function EntradasPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { page, limit, values } = await readFilters(searchParams);
  const status = values.status ?? "";
  const search = values.search ?? "";

  let orders: AdminOrder[] = [];
  let meta = { total_items: 0, page, limit, total_pages: 1 };
  let failure: unknown = null;

  try {
    // `search` e o período vão junto mesmo sem suporte no Go: o backend ignora
    // o que não conhece e a tela já nasce pronta para quando entrar.
    const result = await getOrders({ page, limit, status, search });
    orders = result.data;
    meta = result.meta;
  } catch (error) {
    failure = error;
  }

  // Soma da página atual: o Go só manda o total quando há paginação de verdade,
  // e em filtro por status o total vem da lista filtrada, o que já é a leitura
  // que o admin quer ("quanto tenho aguardando?").
  const pageTotal = orders.reduce((sum, order) => sum + (order.total_cents ?? 0), 0);
  const pendingCount = status === "pending" ? meta.total_items : null;

  return (
    <PageBody className="space-y-6">
      <PageHeader
        title="Entradas"
        description="Pedidos que chegaram da loja. Confirme o pagamento para liberar a entrega no inventário do usuário."
        meta={
          status === ""
            ? `${formatNumber(meta.total_items)} pedido${meta.total_items === 1 ? "" : "s"} no total.`
            : `${formatNumber(meta.total_items)} pedido${meta.total_items === 1 ? "" : "s"} com este filtro.`
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total de pedidos"
          value={formatNumber(meta.total_items)}
          hint={status === "" ? "Sem filtro de status" : `Filtro: ${status}`}
          icon={Inbox}
        />
        <StatCard
          label="Valor nesta página"
          value={formatCurrency(pageTotal)}
          hint={`${orders.length} pedido${orders.length === 1 ? "" : "s"} listado${orders.length === 1 ? "" : "s"}`}
        />
        {pendingCount !== null ? (
          <StatCard
            label="Aguardando pagamento"
            value={formatNumber(pendingCount)}
            tone="warning"
            hint="Prontos para confirmar"
          />
        ) : (
          <StatCard
            label="Filtro ativo"
            value={orderStatusLabel(status)}
            hint="Limpe o filtro para ver todos"
            tone="accent"
          />
        )}
      </section>

      <FilterBar searchPlaceholder="Buscar por nome ou e-mail…">
        <FilterSelect param="status" placeholder="Status" options={STATUS_OPTIONS} />
      </FilterBar>

      {failure ? (
        <ErrorState error={failure} />
      ) : (
        <DataTable
          columns={COLUMNS}
          rows={orders}
          getRowKey={(order) => order.id}
          empty={
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium">
                {status || search ? "Nenhum pedido com esses filtros" : "Nenhum pedido recebido"}
              </p>
              <p className="mt-1 text-sm text-foreground-muted">
                {status || search
                  ? "Ajuste o status ou a busca para ver outros pedidos."
                  : "Assim que alguém fechar um carrinho na loja, o pedido aparece aqui."}
              </p>
            </div>
          }
          footer={
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-2.5 text-xs text-foreground-faint">
                {formatNumber(meta.total_items)} pedido{meta.total_items === 1 ? "" : "s"}
                {meta.total_pages > 1 ? ` — página ${meta.page} de ${meta.total_pages}` : ""}.
              </td>
            </tr>
          }
        />
      )}

      <PaginationBar
        page={meta.page}
        totalPages={meta.total_pages}
        totalItems={meta.total_items}
        limit={meta.limit}
      />
    </PageBody>
  );
}
