"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import type { AdminOrder } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { ConfirmPayment } from "./confirm-payment";
import { OrderDetailDialog } from "./order-detail";

/**
 * Ações de um pedido na fila de Entradas.
 *
 * "Confirmar pagamento" só aparece em pedido pendente, e isso importa: em pedido
 * pago a rota responderia 409 "Este pedido já está pago" e em cancelado também.
 * Esconder o botão deixa a regra visível na própria tela, em vez de o admin
 * descobrir por erro.
 */
export function OrderActions({ order }: { order: AdminOrder }) {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      {order.status === "pending" ? <ConfirmPayment order={order} /> : null}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setDetailOpen(true)}
        aria-label={`Detalhes do pedido de ${order.customer?.name ?? "cliente"}`}
        title="Detalhes"
      >
        <Eye aria-hidden />
      </Button>

      <OrderDetailDialog order={order} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
