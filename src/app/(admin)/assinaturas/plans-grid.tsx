"use client";

import { useState } from "react";
import { Check, CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { API_PATHS } from "@/lib/api/endpoints";
import { apiMutate } from "@/lib/api/client";
import type { Plan } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format/currency";
import { periodLabel } from "@/lib/format/labels";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";

/**
 * Cartões dos planos de assinatura.
 *
 * A única escrita disponível hoje é ligar o plano ao `price_xxx` do Stripe, e
 * ela é `PUT /admin/plans/:planId/stripe-price` (billing_handler.go:
 * SetPlanStripePrice). Criar, editar preço e desativar plano exigiriam rotas
 * novas (docs/analise-admin-panel.md §6.5), então não aparecem aqui — mostrar
 * botão que não funciona seria pior do que não mostrar.
 *
 * O formulário é mínimo de propósito: o id nasce no painel da Stripe, não aqui.
 */
export function PlansGrid({ plans }: { plans: Plan[] }) {
  const [target, setTarget] = useState<Plan | null>(null);
  const [stripePriceId, setStripePriceId] = useState("");

  function open(plan: Plan) {
    setTarget(plan);
    setStripePriceId(plan.stripe_price_id ?? "");
  }

  async function submit() {
    if (!target) return;

    await apiMutate.put(API_PATHS.adminPlanStripePrice(target.id), {
      stripe_price_id: stripePriceId.trim(),
    });

    toast.success(`Preço do Stripe ligado ao plano ${target.name}.`);
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const linked = Boolean(plan.stripe_price_id);

          return (
            <article
              key={plan.id}
              className="flex flex-col rounded-card border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 text-base font-semibold">
                    {plan.name}
                    {plan.is_popular ? (
                      <Sparkles className="size-3.5 text-accent" aria-label="Destaque" />
                    ) : null}
                  </h3>
                  {plan.badge ? (
                    <p className="text-xs uppercase tracking-[0.12em] text-foreground-faint">
                      {plan.badge}
                    </p>
                  ) : null}
                </div>

                <StatusBadge
                  label={linked ? "Cobrança pronta" : "Sem cobrança"}
                  variant={linked ? "success" : "warning"}
                  dot
                />
              </div>

              <p className="mt-3 text-2xl font-bold tabular-nums">
                {formatCurrency(plan.price_cents)}
                <span className="ml-1 text-sm font-normal text-foreground-faint">
                  /{periodLabel(plan.period_months)}
                </span>
              </p>

              {plan.description ? (
                <p className="mt-2 text-sm text-foreground-muted">{plan.description}</p>
              ) : null}

              {plan.features?.length ? (
                <ul className="mt-3 flex-1 space-y-1.5 text-sm text-foreground-secondary">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 border-t border-border pt-3">
                {linked ? (
                  <p className="truncate font-mono text-xs text-foreground-faint" title={plan.stripe_price_id}>
                    {plan.stripe_price_id}
                  </p>
                ) : null}

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => open(plan)}
                >
                  <CreditCard aria-hidden />
                  {linked ? "Trocar price_xxx" : "Ligar price_xxx"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <FormDialog
        open={target !== null}
        onOpenChange={(next) => !next && setTarget(null)}
        title={target ? `Cobrança do plano ${target.name}` : "Cobrança"}
        description="Cole o identificador do preço criado no painel da Stripe. O servidor confere o valor lá antes de salvar e recusa se for diferente do preço do plano."
        submitLabel="Salvar"
        onSubmit={submit}
      >
        <FormField
          label="Stripe price ID"
          htmlFor="stripe-price-id"
          required
          hint="Formato price_… — aparece no painel da Stripe em produtos > preços."
        >
          <Input
            id="stripe-price-id"
            value={stripePriceId}
            onChange={(event) => setStripePriceId(event.target.value)}
            placeholder="price_1AbCdEfGhIjKlMnOp"
            className="font-mono"
            required
          />
        </FormField>
      </FormDialog>
    </>
  );
}
