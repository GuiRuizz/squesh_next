/**
 * Formatação de dinheiro.
 *
 * O Go guarda preço e total em CENTAVOS (inteiro) — domain/shop.go:14 explica
 * que float deixaria "R$ 119,90" susceptible a erro de arredondamento na soma do
 * carrinho. O painel nunca faz conta com float: só divide na hora de exibir.
 *
 * O app Flutter formata assim (shop_models.dart:8):
 *   (cents / 100).toStringAsFixed(2).replaceAll('.', ',')
 * e o painel usa exatamente a mesma regra, para os dois lerem igual.
 */

const formatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 11990 -> "R$ 119,90" */
export function formatCurrency(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return `R$ ${formatter.format(safe / 100)}`;
}

/** Versão compacta para cartões de KPI, onde o número inteiro importa mais. */
export function formatCurrencyCompact(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  const reais = safe / 100;
  if (Math.abs(reais) >= 1_000_000) {
    return `R$ ${(reais / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (Math.abs(reais) >= 10_000) {
    return `R$ ${(reais / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return formatCurrency(cents);
}

/**
 * Converte o que o usuário digitou no formulário para centavos.
 *
 * Aceita "119,90", "119.90", "1199" e "1.199,90". Devolve `null` quando não há
 * número utilizável, para o formulário mostrar erro em vez de gravar 0.
 */
export function parseCurrencyToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Só dígitos e separadores: evita "abc" virar 0 silenciosamente.
  if (!/^[\d.,\s]+$/.test(trimmed)) return null;

  // Milhar com ponto: "1.199,90" -> "1199,90"
  let normalized = trimmed.replace(/\s/g, "");
  if (/,\d{1,2}$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    // Sem centavos explícitos: o ponto é milhar.
    normalized = normalized.replace(/[.,]/g, "");
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Formata centavos de volta para o campo de texto do formulário. */
export function centsToInput(cents: number): string {
  if (!Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** "11990" -> "R$ 119,90" (aceita string vindo de query param). */
export function formatCentsFromString(value: string | null | undefined): string {
  const parsed = Number.parseInt(value ?? "", 10);
  return formatCurrency(Number.isFinite(parsed) ? parsed : 0);
}
