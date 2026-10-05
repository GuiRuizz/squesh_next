"use client";

import { useState } from "react";
import { Plus, Star } from "lucide-react";
import type { AdminShopItem, PageMeta } from "@/lib/api/types";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { formatCurrency } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { ShopItemActions } from "./shop-item-actions";
import { ShopItemForm } from "./shop-item-form";

/**
 * Ilha de cliente do Catálogo: cabeçalho de criação, tabela e o formulário.
 *
 * Só esta parte é Client Component. A página (`page.tsx`) continua no servidor,
 * busca os dados pelo BFF e entrega aqui já normalizado — o token `httpOnly`
 * nunca vem junto, e o `DataTable` (que não usa API de servidor) entra
 * normalmente no bundle do cliente.
 *
 * O estado `editing` mora aqui porque é o que liga o botão "editar" de uma
 * linha ao diálogo. Fazer isso na página obrigaria a transformá-la inteira em
 * Client Component e jogar fora a busca no servidor.
 */
export function CatalogoTable({
  items,
  meta,
  categories,
  filtered,
}: {
  items: AdminShopItem[];
  meta: PageMeta;
  categories: string[];
  /** Há filtro na URL? Muda a mensagem do estado vazio. */
  filtered: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminShopItem | null>(null);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(item: AdminShopItem) {
    setEditing(item);
    setOpen(true);
  }

  const columns: Array<DataTableColumn<AdminShopItem>> = [
    {
      header: "Produto",
      render: (item) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2">
            {item.image_url ? (
              // URL livre (pode ser colada pelo admin ou vir do storage local):
              // <img> é o caminho previsível, sem exigir host no next.config.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-[10px] text-foreground-faint">sem foto</span>
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate font-medium">{item.name}</p>
            {item.category ? (
              <p className="truncate text-xs text-foreground-faint">{item.category}</p>
            ) : (
              <p className="truncate text-xs text-foreground-faint">sem categoria</p>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Preço",
      render: (item) => (
        <span className="tabular-nums font-medium">{formatCurrency(item.price_cents)}</span>
      ),
      align: "right",
    },
    {
      header: "Nota",
      render: (item) =>
        item.rating ? (
          <span className="inline-flex items-center gap-1 tabular-nums text-foreground-muted">
            <Star className="size-3.5 fill-warning text-warning" aria-hidden />
            {String(item.rating).replace(".", ",")}
          </span>
        ) : (
          <span className="text-foreground-faint">—</span>
        ),
      align: "right",
      hideBelow: "lg",
    },
    {
      header: "Situação",
      render: (item) => (
        <StatusBadge
          label={item.is_active ? "Ativo" : "Desativado"}
          variant={item.is_active ? "success" : "muted"}
          dot
        />
      ),
    },
    {
      header: "Criado em",
      render: (item) => (
        <span className="text-xs text-foreground-muted">{formatDate(item.created_at)}</span>
      ),
      hideBelow: "xl",
    },
    {
      header: "Ações",
      render: (item) => <ShopItemActions item={item} onEdit={openEdit} />,
      align: "right",
      headerClassName: "text-right",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus aria-hidden />
          Novo produto
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(item) => item.id}
        empty={
          <EmptyState
            icon={Star}
            title={
              filtered ? "Nenhum produto com esses filtros" : "Catálogo vazio"
            }
            description={
              filtered
                ? "Ajuste a busca ou escolha outra categoria."
                : "Crie o primeiro produto para ele aparecer na loja do app."
            }
            action={
              filtered
                ? { label: "Limpar filtros", href: "/catalogo" }
                : { label: "Criar produto", onClick: openCreate }
            }
          />
        }
        footer={
          <tr>
            <td colSpan={columns.length} className="px-3 py-2.5 text-xs text-foreground-faint">
              {meta.total_items} produto{meta.total_items === 1 ? "" : "s"} no catálogo
              {meta.total_pages > 1 ? ` — página ${meta.page} de ${meta.total_pages}` : ""}.
            </td>
          </tr>
        }
      />

      <ShopItemForm
        open={open}
        onOpenChange={setOpen}
        item={editing}
        categories={categories}
      />
    </div>
  );
}
