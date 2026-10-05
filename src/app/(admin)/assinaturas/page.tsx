import type { Metadata } from "next";
import { CreditCard, TrendingUp, UserCheck } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { ErrorState } from "@/components/error-state";
import { getPlans, getSubscriptions } from "@/lib/api/queries";
import { estimateMrrCents } from "@/lib/billing";
import type { AdminSubscription } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format/currency";
import { formatDate, formatUntil } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { subscriptionLabel } from "@/lib/format/labels";
import { PlansGrid } from "./plans-grid";

export const metadata: Metadata = { title: "Assinaturas — Squesh Admin" };

const COLUMNS: Array<DataTableColumn<AdminSubscription>> = [
  {
    header: "Assinante",
    render: (subscription) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{subscription.customer?.name ?? "—"}</p>
        <p className="truncate text-xs text-foreground-faint">{subscription.customer?.email ?? "—"}</p>
      </div>
    ),
  },
  {
    header: "Plano",
    render: (subscription) => (
      <span className="text-foreground-secondary">{subscription.plan?.name ?? "—"}</span>
    ),
  },
  {
    header: "Valor",
    render: (subscription) => (
      <span className="tabular-nums">{formatCurrency(subscription.plan?.price_cents ?? 0)}</span>
    ),
    align: "right",
    hideBelow: "sm",
  },
  {
    header: "Situação",
    render: (subscription) => {
      const { label, variant } = subscriptionLabel(subscription.status, subscription.is_current);
      return <StatusBadge label={label} variant={variant} dot />;
    },
  },
  {
    header: "Começou",
    render: (subscription) => (
      <span className="text-xs text-foreground-muted">{formatDate(subscription.started_at)}</span>
    ),
    hideBelow: "lg",
  },
  {
    header: "Próxima cobrança",
    render: (subscription) => (
      <span className="text-xs text-foreground-muted">
        {subscription.status === "active" ? formatUntil(subscription.renews_at) : "não renova"}
      </span>
    ),
    hideBelow: "md",
  },
];

/**
 * Assinaturas.
 *
 * `GET /admin/subscriptions` devolve um ARRAY CRU (sem `meta`) já filtrado: só
 * as assinaturas que valem hoje, uma por usuário, ativas primeiro
 * (`admin_handler.go:ListSubscriptions`). Três consequências diretas para a tela:
 *
 *   - não há paginação, e por isso a tabela inteira cabe na página;
 *   - não há histórico: quem cancelou e já venceu simplesmente não aparece;
 *   - `is_current` vem sempre `true` (o handler filtra antes), então a coluna
 *     Situação mostra "Ativa" ou "Cancelada, ainda válida" — que é a informação
 *     que importa, porque cancelar NÃO tira o acesso antes de `renews_at`.
 *
 * Os planos vêm de `GET /plans`, que é público e só devolve os ativos.
 */
export default async function AssinaturasPage() {
  let subscriptions: AdminSubscription[] = [];
  let plans: Awaited<ReturnType<typeof getPlans>> = [];
  let failure: unknown = null;

  try {
    [subscriptions, plans] = await Promise.all([getSubscriptions(), getPlans()]);
  } catch (error) {
    failure = error;
  }

  const active = subscriptions.filter((s) => s.status === "active").length;
  const canceledButValid = subscriptions.length - active;

  // Mesma conta do Overview no Go — a fórmula está isolada em `lib/billing.ts`
  // para os dois lugares não divergirem.
  const mrr = estimateMrrCents(subscriptions);

  const byPlan = new Map<string, number>();
  for (const subscription of subscriptions) {
    const name = subscription.plan?.name ?? "—";
    byPlan.set(name, (byPlan.get(name) ?? 0) + 1);
  }

  return (
    <PageBody className="space-y-6">
      <PageHeader
        title="Assinaturas"
        description="Quem tem plano Pro agora, em qual plano e quando renova. Cancelar não tira o acesso na hora: o período já pago continua valendo até a data de renovação."
        meta={`${formatNumber(subscriptions.length)} assinante${subscriptions.length === 1 ? "" : "s"} em vigor · ${plans.length} plano${plans.length === 1 ? "" : "s"} ativo${plans.length === 1 ? "" : "s"} na vitrine.`}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Assinaturas ativas"
          value={formatNumber(active)}
          hint="Renovam automaticamente"
          icon={UserCheck}
        />
        <StatCard
          label="Canceladas, ainda válidas"
          value={formatNumber(canceledButValid)}
          tone={canceledButValid > 0 ? "warning" : "muted"}
          hint="Período já pago, não renova"
        />
        <StatCard
          label="MRR estimado"
          value={formatCurrency(mrr)}
          hint="Soma dos planos ativos por mês"
          tone="accent"
          icon={TrendingUp}
        />
        <StatCard
          label="Planos na vitrine"
          value={formatNumber(plans.length)}
          hint="Exibidos no app"
          icon={CreditCard}
        />
      </section>

      {failure ? (
        <ErrorState error={failure} />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="section-heading">Assinantes</h2>

            <DataTable
              columns={COLUMNS}
              rows={subscriptions}
              getRowKey={(subscription) => subscription.id}
              empty={
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-medium">Nenhuma assinatura em vigor</p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    Quando alguém contratar um plano no app, a assinatura aparece aqui.
                  </p>
                </div>
              }
              footer={
                subscriptions.length > 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-3 py-2.5 text-xs text-foreground-faint">
                      {[...byPlan.entries()]
                        .map(([name, count]) => `${count}x ${name}`)
                        .join(" · ")}
                    </td>
                  </tr>
                ) : null
              }
            />
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="section-heading">Planos</h2>
              <p className="mt-1 text-xs text-foreground-faint">
                O <code className="text-foreground-muted">price_xxx</code> nasce no painel da Stripe e
                precisa ser colado aqui — é o único dado de plano que vem de fora do app. O servidor
                confere o valor antes de salvar.
              </p>
            </div>

            {plans.length === 0 ? (
              <div className="rounded-card border border-border bg-card px-6 py-12 text-center">
                <p className="text-sm font-medium">Nenhum plano ativo</p>
                <p className="mt-1 text-sm text-foreground-muted">
                  A vitrine do app está vazia: cadastre um plano com <code>is_active = true</code>.
                </p>
              </div>
            ) : (
              <PlansGrid plans={plans} />
            )}
          </section>
        </>
      )}
    </PageBody>
  );
}
