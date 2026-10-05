import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/error-state";
import { FilterBar, PaginationBar } from "@/components/filter-bar";
import { FilterSelect } from "@/components/filter-select";
import { getShopItems } from "@/lib/api/queries";
import type { AdminShopItem, PageMeta } from "@/lib/api/types";
import { readFilters, type RawSearchParams } from "@/lib/search-params";
import { CatalogoTable } from "./catalogo-table";

export const metadata: Metadata = { title: "Catálogo — Squesh Admin" };

interface CatalogoData {
  items: AdminShopItem[];
  meta: PageMeta;
  categories: string[];
}

/**
 * Catálogo de produtos — CRUD completo.
 *
 * Primeiro módulo do painel que não depende de backend novo: create, update e
 * delete já existiam no Go (routes.go:199-201, `shop_handler.go`). Por isso o
 * CRUD inteiro funciona hoje.
 *
 * Detalhe que muda a tela: a rota admin (`GET /admin/shop`) é a ÚNICA que
 * devolve `is_active` (`dto.AdminShopItemDTO`). A pública (`GET /shop/:id`)
 * devolve o DTO do app, sem o campo. Por isso o formulário de edição nasce da
 * linha da tabela, sem refazer a requisição de detalhe.
 *
 * `category` ainda não é filtro no Go (`admin_handler.go:ListShopItems` só lê
 * `search`). Enviamos assim mesmo: o backend ignora o que não conhece, e quando
 * a rota evoluir o filtro já nasce ligado na tela.
 */
async function loadCatalogo(page: number, limit: number, search: string, category: string) {
  const [list, all] = await Promise.all([
    getShopItems({ page, limit, search, category }),
    getShopItems({ limit: 100 }),
  ]);

  // Categorias derivadas do catálogo — o app faz igual
  // (shop_providers.dart:7): não existe endpoint de categorias, elas nascem
  // do que os produtos já usam.
  const categories = [...new Set(all.data.map((item) => item.category).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );

  return { items: list.data, meta: list.meta, categories };
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { page, limit, values } = await readFilters(searchParams);
  const search = values.search ?? "";
  const category = values.category ?? "";

  let data: CatalogoData | null = null;
  let failure: unknown = null;

  try {
    data = await loadCatalogo(page, limit, search, category);
  } catch (error) {
    failure = error;
  }

  const meta = data?.meta ?? null;

  return (
    <PageBody className="space-y-6">
      <PageHeader
        title="Catálogo"
        description="Produtos da loja do app. Desativar esconde da vitrine sem apagar o histórico de quem já comprou; excluir só vale para produto que ninguém comprou."
        meta={
          meta
            ? `${meta.total_items} produto${meta.total_items === 1 ? "" : "s"} no catálogo.`
            : undefined
        }
      />

      <FilterBar searchPlaceholder="Buscar pelo nome…">
        <FilterSelect
          param="category"
          placeholder="Categoria"
          options={(data?.categories ?? []).map((c) => ({ value: c, label: c }))}
        />
      </FilterBar>

      {failure ? (
        <ErrorState error={failure} />
      ) : (
        <CatalogoTable
          items={data?.items ?? []}
          meta={meta ?? { total_items: 0, page, limit, total_pages: 1 }}
          categories={data?.categories ?? []}
          filtered={Boolean(search || category)}
        />
      )}

      {meta ? (
        <PaginationBar
          page={meta.page}
          totalPages={meta.total_pages}
          totalItems={meta.total_items}
          limit={meta.limit}
        />
      ) : null}
    </PageBody>
  );
}
