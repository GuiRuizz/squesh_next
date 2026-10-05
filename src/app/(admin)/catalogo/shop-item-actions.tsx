"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { API_PATHS } from "@/lib/api/endpoints";
import { apiMutate, errorMessage } from "@/lib/api/client";
import type { AdminShopItem } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ConfirmAction } from "@/components/confirm-action";

/**
 * Ações de uma linha do catálogo.
 *
 * "Ativar/Desativar" e "Excluir" são caminhos diferentes de propósito, e o
 * painel expõe os dois lado a lado porque o backend também trata diferente:
 *
 *   PUT is_active=false -> some da loja preservando o inventário de quem já
 *                          comprou. Caminho SEMPRE seguro.
 *   DELETE              -> 409 se alguém tem o item no inventário, com a
 *                          mensagem do Go mandando desativar. Caminho só para
 *                          item que ninguém comprou nunca.
 *
 * Por isso a exclusão não engole o 409: ela mostra o texto do backend, que já
 * explica o próximo passo, e o botão de desativar continua ali ao lado.
 *
 * Botões de ícone em vez de um menu `…`: os três ícones cabem na linha e são
 * descobríveis sem clique extra, e um menu com um `AlertDialogTrigger` dentro
 * tem o problema de o item fechar o menu no clique, desmontando o gatilho
 * antes de o diálogo abrir.
 */
export function ShopItemActions({
  item,
  onEdit,
}: {
  item: AdminShopItem;
  onEdit: (item: AdminShopItem) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function toggleActive() {
    try {
      await apiMutate.put(API_PATHS.adminUpdateShopItem(item.id), { is_active: !item.is_active });
      toast.success(
        item.is_active ? `"${item.name}" desativado.` : `"${item.name}" reativado.`,
      );
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onEdit(item)}
        aria-label={`Editar ${item.name}`}
        title="Editar"
      >
        <Pencil aria-hidden />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleActive}
        disabled={pending}
        aria-label={item.is_active ? `Desativar ${item.name}` : `Reativar ${item.name}`}
        title={item.is_active ? "Desativar" : "Reativar"}
      >
        {item.is_active ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
      </Button>

      <ConfirmAction
        title={`Excluir "${item.name}"?`}
        description="Some do catálogo e não dá para desfazer. Se alguém já comprou este item, o servidor vai pedir para desativar no lugar de apagar."
        confirmLabel="Excluir"
        onConfirm={() => apiMutate.delete(API_PATHS.adminDeleteShopItem(item.id))}
        successMessage="Produto excluído."
      >
        <AlertDialogTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${item.name}`} title="Excluir" />
          }
        >
          <Trash2 aria-hidden />
        </AlertDialogTrigger>
      </ConfirmAction>
    </div>
  );
}
