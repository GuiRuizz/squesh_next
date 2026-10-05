"use client";

import { useState } from "react";
import { toast } from "sonner";
import { API_PATHS } from "@/lib/api/endpoints";
import { apiMutate } from "@/lib/api/client";
import { centsToInput, parseCurrencyToCents } from "@/lib/format/currency";
import type { AdminShopItem } from "@/lib/api/types";
import { FormDialog } from "@/components/form-dialog";
import { FormField, FormGrid } from "@/components/form-field";
import { ImageUpload } from "@/components/image-upload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

/**
 * Formulário de produto do catálogo (criar e editar).
 *
 * Duas decisões que vêm do DTO do Go e não são óbvias:
 *
 * 1. `UpdateShopItemDTO` usa PONTEIROS, e no `binding:"omitempty"` do
 *    go-playground `omitempty` só pula a validação quando o ponteiro é nil.
 *    Mandar `"image_url": ""` faz a regra `url` rodar sobre string vazia e o
 *    backend responde 400 "Key: 'UpdateShopItemDTO.ImageURL' Error:Field
 *    validation for 'ImageURL' failed on the 'url' tag". Por isso todo campo de
 *    texto vazio é OMITIDO do corpo, nunca enviado como "".
 *
 * 2. O `min` do nome é 2 no create e 3 no update. O formulário exige 3 sempre:
 *    um nome de 2 letras é ruim de qualquer jeito, e isso mantém a validação do
 *    cliente igual à mais restritiva das duas rotas.
 */

interface FormState {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  category: string;
  rating: string;
  isActive: boolean;
}

function initialState(item: AdminShopItem | null): FormState {
  return {
    name: item?.name ?? "",
    description: item?.description ?? "",
    price: item ? centsToInput(item.price_cents) : "",
    imageUrl: item?.image_url ?? "",
    category: item?.category ?? "",
    rating: item?.rating ? String(item.rating) : "",
    isActive: item?.is_active ?? true,
  };
}

const LIMITS = {
  nameMax: 100,
  descriptionMax: 2000,
  categoryMax: 40,
} as const;

export function ShopItemForm({
  open,
  onOpenChange,
  item,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = criar; preenchido = editar. */
  item: AdminShopItem | null;
  /** Categorias já em uso, para sugerir sem obrigar um valor travado. */
  categories: string[];
}) {
  const editing = item !== null;
  const [state, setState] = useState<FormState>(() => initialState(item));

  // Trocar de item sem remontar o diálogo acontece ao abrir "editar" em linhas
  // diferentes seguidas; o sync defensivo evita exibir os dados do item
  // anterior por um frame.
  const [syncedFor, setSyncedFor] = useState(item?.id ?? null);
  if (open && (item?.id ?? null) !== syncedFor) {
    setSyncedFor(item?.id ?? null);
    setState(initialState(item));
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    const name = state.name.trim();
    const priceCents = parseCurrencyToCents(state.price);
    const rating = state.rating.trim() === "" ? null : Number(state.rating.replace(",", "."));

    if (name.length < 3) {
      toast.error("O nome precisa ter ao menos 3 caracteres.");
      return;
    }
    if (priceCents === null) {
      toast.error("Preço inválido. Use 119,90.");
      return;
    }
    if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) {
      toast.error("A nota precisa estar entre 0 e 5.");
      return;
    }

    // Só entram no corpo os campos preenchidos: ver a nota 1 no cabeçalho.
    const text: Record<string, string> = {
      name,
      description: state.description.trim(),
      image_url: state.imageUrl.trim(),
      category: state.category.trim(),
    };

    const base = {
      price_cents: priceCents,
      ...(rating !== null ? { rating } : {}),
      ...Object.fromEntries(Object.entries(text).filter(([, v]) => v !== "")),
    };

    const payload = editing ? { ...base, is_active: state.isActive } : base;

    const saved = editing
      ? await apiMutate.put<AdminShopItem>(API_PATHS.adminUpdateShopItem(item.id), payload)
      : await apiMutate.post<AdminShopItem>(API_PATHS.adminCreateShopItem, payload);

    toast.success(
      editing ? `"${saved?.name ?? name}" atualizado.` : `"${name}" criado no catálogo.`,
    );
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Editar produto" : "Novo produto"}
      description={
        editing
          ? "As mudanças valem só para novas compras: pedidos antigos guardam o preço do momento da compra."
          : "O produto entra na loja do app assim que for salvo."
      }
      submitLabel={editing ? "Salvar alterações" : "Criar produto"}
      onSubmit={submit}
      widthClassName="sm:max-w-xl"
    >
      <FormGrid columns={2}>
        <FormField label="Nome" htmlFor="item-name" required className="sm:col-span-2">
          <Input
            id="item-name"
            value={state.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="Whey protein isolado"
            maxLength={LIMITS.nameMax}
            required
          />
        </FormField>

        <FormField
          label="Preço"
          htmlFor="item-price"
          required
          hint="Em reais. Gravado como centavos — o app nunca faz conta com float."
        >
          <Input
            id="item-price"
            value={state.price}
            onChange={(event) => set("price", event.target.value)}
            placeholder="119,90"
            inputMode="decimal"
            required
          />
        </FormField>

        <FormField label="Nota" htmlFor="item-rating" hint="De 0 a 5. Deixe vazio para não exibir.">
          <Input
            id="item-rating"
            value={state.rating}
            onChange={(event) => set("rating", event.target.value)}
            placeholder="4,5"
            inputMode="decimal"
          />
        </FormField>

        <FormField
          label="Categoria"
          htmlFor="item-category"
          hint="Agrupa o produto nos chips da loja. Sugestões:"
          className="sm:col-span-2"
        >
          <Input
            id="item-category"
            value={state.category}
            onChange={(event) => set("category", event.target.value)}
            placeholder="Suplementos"
            maxLength={LIMITS.categoryMax}
            list="item-categories"
          />
          <datalist id="item-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </FormField>

        <ImageUpload
          value={state.imageUrl}
          onChange={(url) => set("imageUrl", url)}
          hint="jpg, png, webp ou gif, até 5 MB."
          className="sm:col-span-2"
        />

        <FormField label="Descrição" htmlFor="item-description" className="sm:col-span-2">
          <Textarea
            id="item-description"
            value={state.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="O que é, quanto rende, para quem é."
            rows={3}
            maxLength={LIMITS.descriptionMax}
          />
        </FormField>

        {editing ? (
          <FormField
            label="Visível na loja"
            hint="Desativar some o produto do app sem apagar o histórico de quem comprou."
          >
            <Switch
              checked={state.isActive}
              onCheckedChange={(checked: boolean) => set("isActive", checked)}
              aria-label="Produto ativo"
            />
          </FormField>
        ) : null}
      </FormGrid>
    </FormDialog>
  );
}
