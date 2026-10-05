import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Inbox,
  PackageCheck,
  ShoppingBag,
  Map,
  CreditCard,
  Users,
  Megaphone,
} from "lucide-react";

/**
 * Estrutura de navegação do painel.
 *
 * O agrupamento de Trilhas espelha a divisão do domínio no Go (`TrailType`:
 * `workout` | `nutrition`) e as duas colunas da Home do app.
 *
 * `pending` marca tela que ainda NÃO existe porque depende de rota que o Go
 * ainda não expõe. Ela continua visível — o módulo está planejado e o admin
 * precisa saber que vem aí — mas não é clicável. Deixar o link ativo só para
 * levar a um 404 seria pior que mostrá-lo desligado: parece bug.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Tela planejada, aguardando endpoint no `squesh_golang`. */
  pending?: boolean;
  /** Motivo, exibido como tooltip no item desligado. */
  pendingReason?: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      {
        href: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
        description: "Visão geral da aplicação",
      },
    ],
  },
  {
    label: "Operação",
    items: [
      {
        href: "/entradas",
        label: "Entradas",
        icon: Inbox,
        description: "Pedidos recebidos e confirmação de pagamento",
      },
      {
        href: "/entregas",
        label: "Entregas",
        icon: PackageCheck,
        description: "Produtos entregues no inventário dos usuários",
        pending: true,
        pendingReason: "Aguarda a rota de inventário no squesh_golang",
      },
      {
        href: "/catalogo",
        label: "Catálogo",
        icon: ShoppingBag,
        description: "Produtos, preços e categorias da loja",
      },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      {
        href: "/trilhas/treino",
        label: "Trilhas de Treino",
        icon: Map,
        description: "Sessões de treino e exercícios",
        pending: true,
        pendingReason: "Aguarda as rotas de trilha e sessões no squesh_golang",
      },
      {
        href: "/trilhas/alimentacao",
        label: "Trilhas de Alimentação",
        icon: Map,
        description: "Dias de alimentação e refeições",
        pending: true,
        pendingReason: "Aguarda as rotas de trilha e sessões no squesh_golang",
      },
    ],
  },
  {
    label: "Negócio",
    items: [
      {
        href: "/assinaturas",
        label: "Assinaturas",
        icon: CreditCard,
        description: "Planos ativos, cancelados e MRR",
      },
      {
        href: "/usuarios",
        label: "Usuários",
        icon: Users,
        description: "Base de usuários e papéis de acesso",
        pending: true,
        pendingReason: "Não existe rota de listagem de usuários no squesh_golang",
      },
      {
        href: "/avisos",
        label: "Avisos",
        icon: Megaphone,
        description: "Notificações enviadas aos usuários",
        pending: true,
        pendingReason: "Aguarda a rota de envio de notificações no squesh_golang",
      },
    ],
  },
];

/** Achata a navegação para a busca do menu (⌘K) e para o rodapé. */
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/**
 * Rota de uma trilha de conteúdo pelo tipo do domínio.
 *
 * `/trilhas/treino` e `/trilhas/alimentacao` são as duas colunas da Home do app
 * (EXERCÍCIOS / ALIMENTAÇÃO) e os dois valores de `TrailType` no Go.
 */
export function trailHref(type: "workout" | "nutrition"): string {
  return type === "nutrition" ? "/trilhas/alimentacao" : "/trilhas/treino";
}

/** Converte o valor de `TrailType` do banco no trecho de URL. */
export function trailTypeFromHref(slug: string): "workout" | "nutrition" | null {
  if (slug === "treino") return "workout";
  if (slug === "alimentacao") return "nutrition";
  return null;
}

/** Rota do detalhe de uma trilha, que sabe o tipo para escolher o voltar. */
export function trailDetailHref(type: "workout" | "nutrition", id: string): string {
  return `${trailHref(type)}/${id}`;
}
