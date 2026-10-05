"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { API_PATHS } from "@/lib/api/endpoints";
import { ApiError, apiMutate, errorMessage } from "@/lib/api/client";
import type { AdminOrder } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Confirmação manual de pagamento.
 *
 * Chama `POST /admin/orders/:id/pay` (shop_handler.go:MarkOrderPaid), que é o
 * ÚNICO caminho de entrega: o mesmo `service.FulfillOrderPaid` que o webhook do
 * Stripe chama. Pelo painel, existe para pagamento feito fora do app.
 *
 * O ponto delicado é o 409. O Go responde 409 "Este pedido já está pago" quando
 * confirma duas vezes, e isso NÃO é falha da tela — é o desfecho desejado. Se
 * tratássemos como erro, o admin veria um toast vermelho numa ação que na
 * verdade deu certo (e o item já está no inventário do usuário). Por isso o
 * 409 vira aviso azul de "já estava pago" e a lista é recarregada igual.
 */
export function ConfirmPayment({ order }: { order: AdminOrder }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    // Ver comentário sobre `preventBaseUIHandler` no ConfirmAction: sem isso o
    // diálogo fecharia antes de a promise resolver e o erro apareceria no vazio.
    (event.nativeEvent as { preventBaseUIHandler?: () => void }).preventBaseUIHandler?.();

    setBusy(true);
    try {
      await apiMutate.post(API_PATHS.adminPayOrder(order.id));
      toast.success(`Pedido de ${order.customer?.name ?? "cliente"} confirmado e entregue.`);
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Idempotência: já confirmado por este botão ou pelo webhook.
        toast.info("Este pedido já estava pago — nada a fazer.", {
          description: error.message,
        });
        setOpen(false);
        startTransition(() => router.refresh());
        return;
      }
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button size="sm" disabled={pending} aria-label="Confirmar pagamento">
            <CheckCircle2 aria-hidden />
            Confirmar pagamento
          </Button>
        }
      />

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar pagamento de {formatMoney(order.total_cents)}?</AlertDialogTitle>
          <AlertDialogDescription>
            Os {order.items?.length ?? 0} produto{order.items?.length === 1 ? "" : "s"} deste pedido
            entram no inventário de {order.customer?.name ?? "cliente"} e ele recebe uma notificação.
            Não há como desfazer: para reverter, é preciso remover a entrega manualmente.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={handleConfirm}>
            {busy ? "Confirmando…" : "Confirmar e entregar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function formatMoney(cents: number): string {
  return `R$ ${((cents ?? 0) / 100).toFixed(2).replace(".", ",")}`;
}
