import type { OrderStatus, SubscriptionStatus, TrailType } from "@/lib/api/types";

/**
 * Variantes de badge, espelhando as cores de feedback do app.
 *
 * `default` é o estado neutro (um dado que não tem cor própria). As demais
 * existem porque o app distingue pendente/pago/cancelado e válido/expirado: um
 * painel que pintasse tudo de cinza perderia essa informação.
 */
export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "muted"
  | "accent"
  | "info";

/**
 * Dicionário de rótulos do painel.
 *
 * REGRA DE OURO: nenhum termo interno do backend ("step", "item", "meal",
 * "TrailItem") aparece para o usuário. O vocabulary muda conforme o tipo da
 * trilha, e o app já faz essa troca — o painel segue exatamente a mesma regra
 * (ver docs/analise-admin-panel.md §1.4 e a análise do app em
 * squesh_flutter/lib/features/home/domain/trail_entry.dart:1-4).
 */

// ---------------------------------------------------------------- trilhas

export interface TrailTypeCopy {
  /** Rótulo da coluna/página: "Treino" | "Alimentação" */
  label: string;
  /** Rótulo de uma TrailItem: "Sessão" (treino) | "Dia" (alimentação) */
  itemNoun: string;
  itemNounPlural: string;
  /** Rótulo de um StepSpec: "Exercício" (treino) | "Refeição" (alimentação) */
  stepNoun: string;
  stepNounPlural: string;
  /** Frase de progresso: "3/5 exercícios" */
  progressLabel: (done: number, total: number) => string;
  /** Texto do cabeçalho da coluna, como no app (EXERCÍCIOS / ALIMENTAÇÃO) */
  columnHeading: string;
  /** Frase que o app mostra ao concluir tudo. */
  completeMessage: string;
  /** Frase do banner de limite diário. */
  dailyLimitMessage: string;
  /** Sugestões de `slot` para o sub-editor de etapas. */
  slotSuggestions: string[];
  /** Placeholders dos campos de etapa, specificos do tipo. */
  placeholders: {
    itemTitle: string;
    itemDescription: string;
    itemValue: string;
    stepTitle: string;
    stepValue: string;
  };
}

/**
 * `dailyStepLabel` no Go devolve "treino" para workout e "dia de alimentação"
 * para nutrition; aqui os rótulos composing das frases.
 */
export const TRAIL_TYPE: Record<TrailType, TrailTypeCopy> = {
  workout: {
    label: "Treino",
    itemNoun: "Sessão",
    itemNounPlural: "Sessões",
    stepNoun: "Exercício",
    stepNounPlural: "Exercícios",
    progressLabel: (done, total) => `${done}/${total} exercícios`,
    columnHeading: "EXERCÍCIOS",
    completeMessage: "Sessão completa! Todos os exercícios foram marcados.",
    dailyLimitMessage: "Treino de hoje concluído — limite: 1 por dia",
    slotSuggestions: [
      "supino_reto",
      "crucifixo_inclinado",
      "remada_curvada",
      "agachamento_livre",
      "levantamento_terra",
      "desenvolvimento",
      "triceps_corda",
      "prancha",
    ],
    placeholders: {
      itemTitle: "Peito e tríceps",
      itemDescription: "Sessão focada em empurrar. Pegada firme, sem pressa.",
      itemValue: "5 exercícios",
      stepTitle: "Supino reto com barra",
      stepValue: "4 séries de 10 a 12",
    },
  },
  nutrition: {
    label: "Alimentação",
    itemNoun: "Dia",
    itemNounPlural: "Dias",
    stepNoun: "Refeição",
    stepNounPlural: "Refeições",
    progressLabel: (done, total) => `${done}/${total} refeições`,
    columnHeading: "ALIMENTAÇÃO",
    completeMessage: "Dia completo! Todas as refeições foram marcadas.",
    dailyLimitMessage: "Dia de hoje concluído — limite: 1 dia por dia",
    slotSuggestions: [
      "cafe_manha",
      "almoco",
      "lanche_tarde",
      "jantar",
      "pre_treino",
      "pos_treino",
      "ceia",
    ],
    placeholders: {
      itemTitle: "Dia 1",
      itemDescription: "2000 kcal, 150 g de proteína distribuídas ao longo do dia.",
      itemValue: "4 refeições",
      stepTitle: "Café da manhã",
      stepValue: "200 kcal • 25 g de proteína",
    },
  },
};

/** Rótulo do tipo, com fallback para valor desconhecido vindo do banco. */
export function trailTypeLabel(type: string | null | undefined): string {
  if (type === "workout") return TRAIL_TYPE.workout.label;
  if (type === "nutrition") return TRAIL_TYPE.nutrition.label;
  return "Trilha";
}

/**
 * Rótulo contextual de uma TrailItem. Ex.: `getItemNoun("nutrition")` -> "Dia".
 * É o equivalente ao `stepLabel` do app ("o dia" / "o treino").
 */
export function getItemNoun(type: string | null | undefined): string {
  return type === "nutrition" ? TRAIL_TYPE.nutrition.itemNoun : TRAIL_TYPE.workout.itemNoun;
}

export function getItemNounPlural(type: string | null | undefined): string {
  return type === "nutrition"
    ? TRAIL_TYPE.nutrition.itemNounPlural
    : TRAIL_TYPE.workout.itemNounPlural;
}

/** Rótulo contextual de um StepSpec. Ex.: `getStepNoun("workout")` -> "Exercício". */
export function getStepNoun(type: string | null | undefined): string {
  return type === "nutrition" ? TRAIL_TYPE.nutrition.stepNoun : TRAIL_TYPE.workout.stepNoun;
}

export function getStepNounPlural(type: string | null | undefined): string {
  return type === "nutrition"
    ? TRAIL_TYPE.nutrition.stepNounPlural
    : TRAIL_TYPE.workout.stepNounPlural;
}

/** Frase de progresso contextual: "3/5 exercícios" | "3/5 refeições". */
export function trailProgressLabel(
  type: string | null | undefined,
  done: number,
  total: number,
): string {
  const copy = type === "nutrition" ? TRAIL_TYPE.nutrition : TRAIL_TYPE.workout;
  return copy.progressLabel(done, total);
}

// ---------------------------------------------------------------- níveis

/**
 * `Trail.Level` é texto livre no Go (`varchar(20)`, sem validação) e o app exibe
 * o valor CRU (home_screen.dart:315). Estes são os três valores usados de fato —
 * o select do painel restringe a eles para não escrever valor que o app
 * mostraria cru e errado. `normalizeLevel` (abaixo) é a barreira de escrita.
 */
export const TRAIL_LEVEL = [
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediario", label: "Intermediário" },
  { value: "avancado", label: "Avançado" },
] as const;

export type TrailLevelValue = (typeof TRAIL_LEVEL)[number]["value"];

export function trailLevelLabel(level: string | null | undefined): string {
  const found = TRAIL_LEVEL.find((item) => item.value === level);
  return found?.label ?? (level || "—");
}

/**
 * Normaliza o nível antes de gravar: minúsculas e sem acento, porque é assim
 * que o app exibe e não há validação no backend.
 */
export function normalizeLevel(level: string): string {
  return level
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ---------------------------------------------------------------- pedidos

/**
 * O app rotula status de pedido em `shop_models.dart:104` com um `default` que
 * cairia em "Aguardando pagamento" para qualquer valor novo. Aqui o contrário:
 * um status desconhecido é sinalizado explicitamente, para o admin perceber que
 * o backend cresceu e o painel precisa acompanhar.
 */
export const ORDER_STATUS: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Aguardando pagamento", variant: "warning" },
  paid: { label: "Pago", variant: "success" },
  canceled: { label: "Cancelado", variant: "muted" },
};

export function orderStatusLabel(status: string | null | undefined): string {
  if (status === "pending" || status === "paid" || status === "canceled") {
    return ORDER_STATUS[status].label;
  }
  return status ? `Desconhecido (${status})` : "—";
}

export function orderStatusVariant(status: string | null | undefined): BadgeVariant {
  if (status === "pending" || status === "paid" || status === "canceled") {
    return ORDER_STATUS[status].variant;
  }
  return "danger";
}

// ---------------------------------------------------------------- assinaturas

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; variant: BadgeVariant }> =
  {
    active: { label: "Ativa", variant: "success" },
    canceled: { label: "Cancelada", variant: "muted" },
  };

/**
 * Traduz a regra de negócio para um rótulo único.
 *
 * Cancelar NÃO encerra o acesso na hora: o usuário já pagou o período, então
 * continua Pro até `renews_at` (domain/billing.go:104, `IsCurrent`). O painel
 * precisa mostrar esses dois estados como distintos, senão o admin acha que
 * cancelou quando o acesso ainda está valendo.
 */
export function subscriptionLabel(
  status: string | null | undefined,
  isCurrent: boolean,
): { label: string; variant: BadgeVariant } {
  if (status === "active" && isCurrent) return { label: "Ativa", variant: "success" };
  if (status === "active" && !isCurrent) return { label: "Expirada", variant: "muted" };
  if (status === "canceled" && isCurrent) return { label: "Cancelada, ainda válida", variant: "warning" };
  if (status === "canceled" && !isCurrent) return { label: "Encerrada", variant: "muted" };
  return { label: status ?? "—", variant: "muted" };
}

/** "mensal" | "anual" | "a cada 3 meses" — igual a `periodLabel` do app. */
export function periodLabel(periodMonths: number | null | undefined): string {
  if (periodMonths === 1) return "mensal";
  if (periodMonths === 12) return "anual";
  if (!periodMonths || periodMonths <= 0) return "—";
  return `a cada ${periodMonths} meses`;
}
