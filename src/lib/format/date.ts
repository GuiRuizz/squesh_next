import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Datas.
 *
 * O Go devolve RFC3339 com offset do fuso do Postgres (a DSN em db.go:22 fixa
 * `TimeZone=America/Sao_Paulo`), então chega algo como
 * "2026-10-01T11:10:53.8934616-03:00". `new Date(...)` entende isso; mas para
 * ficar igual ao app (settings_widgets.dart:525) sempre displaymos em dd/MM/aaaa.
 */

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : parseISO(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "2026-10-01T..." -> "01/10/2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** "2026-10-01T..." -> "01/10/2026 11:10" */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Só a hora, para a coluna "criado às" de tabelas apertadas. */
export function formatTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Tempo relativo, espelhando o vocabulário do app (social_models.dart:116):
 * "agora mesmo", "há 5 min", "há 3 h", "há 2 d" e depois disso vira data.
 */
export function formatRelative(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "agora mesmo";
  if (diffMinutes < 60) return `há ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `há ${diffDays} d`;

  return formatDate(date);
}

/** "vence em 12 dias" / "venceu há 3 dias" — usado em assinaturas. */
export function formatUntil(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";

  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days === -1) return "ontem";
  if (days > 0) return `em ${days} dias`;
  return `há ${Math.abs(days)} dias`;
}

/** input type="date" -> "2026-10-01" */
export function toDateInputValue(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10-01" -> início do dia local (usado nos filtros de período). */
export function fromDateInputValue(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Data de hoje no formato do input, para o botão "Hoje" dos filtros. */
export function todayInputValue(): string {
  return toDateInputValue(new Date());
}

/** "há 5 dias" no formato do date-fns, com locale pt-BR. */
export { formatDistanceToNowStrict, ptBR };
