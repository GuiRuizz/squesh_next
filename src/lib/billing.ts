import type { AdminSubscription, Plan } from "@/lib/api/types";

/**
 * Receita recorrente.
 *
 * A fórmula vem do backend e precisa bater com ele, senão o número do painel
 * discorda do `/admin/overview` na mesma tela. Em `admin_handler.go:Overview`:
 *
 *     if sub.Plan.PeriodMonths > 0 {
 *         out.EstimatedMrrCents += sub.Plan.PriceCents / sub.Plan.PeriodMonths
 *     }
 *
 * Ou seja: o preço CHEIO do plano dividido pelo período em meses. Um plano anual
 * de R$ 990 entra como R$ 82,50 — que é a mensalidade dele, e não o que a
 * pessoa pagou no último período.
 */

/** Contribuição mensal de um plano. Período inválido não conta. */
export function monthlyCents(plan: Pick<Plan, "price_cents" | "period_months">): number {
  const months = plan?.period_months ?? 0;
  if (months <= 0) return 0;
  return Math.round((plan.price_cents ?? 0) / months);
}

/**
 * MRR das assinaturas informadas.
 *
 * Só assinaturas `active` entram: uma cancelada não renova, então não gera
 * recorrência. (`is_current` não entra no filtro de propósito — o Go filtra
 * antes e devolve só as que valem hoje.)
 */
export function estimateMrrCents(subscriptions: AdminSubscription[]): number {
  return subscriptions
    .filter((subscription) => subscription.status === "active")
    .reduce((sum, subscription) => sum + monthlyCents(subscription.plan), 0);
}
