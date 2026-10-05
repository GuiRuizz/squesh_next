/**
 * Formatação de números.
 *
 * Contadores do backend são inteiros simples (`paid_orders_count`, `total_items`).
 * Aqui só entra a separação de milhar em pt-BR e os helpers de proporção usados
 * nos cartões do dashboard.
 */

const integerFormatter = new Intl.NumberFormat("pt-BR");

/** 1234 -> "1.234" */
export function formatNumber(value: number | null | undefined): string {
  if (!Number.isFinite(value ?? NaN)) return "0";
  return integerFormatter.format(value as number);
}

/** `undefined`/`null` viram "0": campo ausente é zero no painel, nunca "NaN". */
export function toCount(value: number | null | undefined): number {
  return Number.isFinite(value ?? NaN) ? (value as number) : 0;
}

/**
 * Percentual seguro entre dois inteiros, já arredondado.
 * Usado para "3 de 12 pedidos pagos" -> "25%".
 */
export function percentOf(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** "3 de 12" — contagem explícita quando o número sozinho não informa o todo. */
export function ratioLabel(part: number, total: number): string {
  return `${formatNumber(part)} de ${formatNumber(total)}`;
}
