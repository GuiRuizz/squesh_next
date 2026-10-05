"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { errorMessage } from "@/lib/api/client";

/**
 * Confirmação para ação destrutiva (excluir, cancelar, desativar).
 *
 * O botão do gatilho é children, então quem chama decide se ele é um ícone
 * discreto na linha da tabela ou um botão cheio no cabeçalho. A ação em si é
 * assíncrona: enquanto roda, o diálogo fica bloqueado e o botão mostra
 * "Removendo…", para o admin não clicar duas vezes e disparar dois DELETEs.
 *
 * O tratamento de erro é central por um motivo: o Go responde
 * `{"error": "..."}` em PT-BR e essa mensagem é a que vale mostrar
 * (ex.: "item já foi pedido por alguém e não pode ser removido").
 */
export function ConfirmAction({
  children,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "destructive",
  onConfirm,
  successMessage,
  /** Recarrega a Server Component depois da ação (padrão: true). */
  refresh = true,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  onConfirm: () => Promise<void>;
  successMessage?: string;
  refresh?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function handleConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    // O `AlertDialog.Action` do Base UI fecha o diálogo no clique, antes de a
    // promise resolver. Com uma ação assíncrona isso sumiria a janela sem
    // nenhum feedback de sucesso ou erro. `preventBaseUIHandler()` cancela
    // apenas esse fechamento automático, sem impedir o clique.
    (event.nativeEvent as { preventBaseUIHandler?: () => void }).preventBaseUIHandler?.();

    try {
      await onConfirm();
      if (successMessage) toast.success(successMessage);
      setOpen(false);
      if (refresh) startTransition(() => router.refresh());
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {children}

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? "Processando…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
