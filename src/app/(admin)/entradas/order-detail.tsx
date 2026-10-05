"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { Package } from "lucide-react";
import type { AdminOrder } from "@/lib/api/types";
import { formatCurrency } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";
import { orderStatusLabel, orderStatusVariant } from "@/lib/format/labels";

/**
 * Detalhe do pedido.
 *
 * Duas informações que a lista não cabe e que o admin precisa antes de confirmar:
 *
 * - os ITENS COM O PREÇO PRÓPRIO (`unit_price_cents`), que é um snapshot do
 *   momento da compra (domain/shop.go:59). Se o preço do catálogo mudou desde
 *   então, o total do pedido NÃO bate com o preço atual — e é assim que tem que
 *   ser. Mostrar o preço atual aqui levaria o admin a "conciliar" um pedido
 *   que está certo.
 *
 * - o ENDEREÇO, que vem do perfil do usuário (`AdminOrderDTO.address`), montado
 *   pelo handler só na leitura. A loja é 100% digital: o endereço não é usado
 *   para enviar nada, é só o que o usuário tem cadastrado.
 */
export function OrderDetailDialog({
  order,
  open,
  onOpenChange,
}: {
  order: AdminOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const address = order.address;
  const items = order.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-subtle sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-4 text-accent" aria-hidden />
            Pedido {shortId(order.id)}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={orderStatusLabel(order.status)}
              variant={orderStatusVariant(order.status)}
              dot
            />
            <span>Recebido em {formatDateTime(order.created_at)}</span>
            {order.paid_at ? <span>Pago em {formatDateTime(order.paid_at)}</span> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* --- Itens --- */}
          <section className="space-y-2">
            <p className="section-heading">Itens do pedido</p>

            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {items.map((item) => (
                <li
                  key={item.id ?? item.item_id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{item.name}</p>
                    <p className="text-xs text-foreground-faint">
                      {item.quantity} x {formatCurrency(item.unit_price_cents)}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-sm">
                    {formatCurrency(item.line_total_cents)}
                  </span>
                </li>
              ))}

              {items.length === 0 ? (
                <li className="px-3 py-3 text-sm text-foreground-muted">Sem itens registrados.</li>
              ) : null}
            </ul>

            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-foreground-muted">Total do pedido</span>
              <span className="tabular-nums text-base font-bold">
                {formatCurrency(order.total_cents)}
              </span>
            </div>

            <p className="px-1 text-xs text-foreground-faint">
              Os preços acima são os do momento da compra. Mudar o preço no catálogo não altera
              pedidos já feitos.
            </p>
          </section>

          {/* --- Cliente --- */}
          <section className="space-y-2">
            <p className="section-heading">Cliente</p>
            <dl className="space-y-1.5 rounded-lg border border-border p-3 text-sm">
              <Row label="Nome" value={order.customer?.name} />
              <Row label="E-mail" value={order.customer?.email} />
            </dl>
          </section>

          {/* --- Endereço --- */}
          {address ? (
            <section className="space-y-2">
              <p className="section-heading">Endereço cadastrado</p>
              <p className="rounded-lg border border-border p-3 text-sm text-foreground-muted">
                {address.recipient ? <strong className="text-foreground">{address.recipient}</strong> : null}
                {address.recipient ? <br /> : null}
                {[address.street, address.number].filter(Boolean).join(", ")}
                {address.complement ? ` — ${address.complement}` : ""}
                <br />
                {[address.city, address.state].filter(Boolean).join("/")}
                {address.zip_code ? ` — CEP ${address.zip_code}` : ""}
              </p>
              <p className="text-xs text-foreground-faint">
                A loja é digital: este endereço vem do perfil do usuário e não é usado para envio.
              </p>
            </section>
          ) : null}

          {/* --- Aviso de ação --- */}
          {order.status === "pending" ? (
            <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              Confirmar o pagamento entrega os itens no inventário do usuário e dispara a
              notificação.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-foreground-faint">{label}</dt>
      <dd className="truncate text-right">{value || "—"}</dd>
    </div>
  );
}

/** 8 primeiros caracteres do UUID: suficiente para colar e achar no banco. */
function shortId(id: string): string {
  return (id ?? "").slice(0, 8) || "—";
}
