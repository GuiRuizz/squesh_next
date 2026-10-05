import { cookies } from "next/headers";
import { API_BASE_URL, ACCESS_COOKIE, REFRESH_COOKIE } from "./config";

/**
 * Cliente HTTP da API Go, usado no SERVIDOR (Route Handlers e Server
 * Components).
 *
 * O JWT vive num cookie `httpOnly`: o browser nunca enxerga o token, então XSS
 * não consegue roubá-lo. O refresh é transparente e em cadeia — duas requisições
 * queTOMBAM em 401 ao mesmo tempo não disparam dois refreshes, porque a segunda
 * espera a promise da primeira (mesma estratégia do `QueuedInterceptor` do app
 * Flutter, auth_interceptor.dart).
 *
 * Erros: o backend responde SEMPRE `{ "error": "mensagem em português" }`
 * (ver handler/*.go). `ApiError` carrega essa mensagem, e a UI a exibe
 * preferencialmente em vez de um texto genérico por status HTTP — é o mesmo
 * critério do `describeError()` do app.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Mensagem genérica por status, usada só quando o backend não mandou `error`. */
const FALLBACK_MESSAGES: Record<number, string> = {
  400: "Dados inválidos. Revise os campos.",
  401: "Sessão expirada. Entre de novo.",
  403: "Você não tem permissão para isso.",
  404: "Não encontramos o que você procurou.",
  409: "Conflito: a operação não pode ser concluída no estado atual.",
  500: "Erro interno do servidor.",
};

function messageFrom(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const candidate = (body as { error?: unknown }).error;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return FALLBACK_MESSAGES[status] ?? "Não foi possível concluir. Tente de novo.";
}

// ---------------------------------------------------------------- sessão

export interface Session {
  accessToken: string;
  refreshToken: string;
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

// ---------------------------------------------------------------- refresh

/**
 * Promise compartilhada do refresh em andamento.
 *
 * Sem isso, o dashboard dispara várias leituras em paralelo; se o token expirou,
 * todas recebem 401 e todas chamariam `/auth/refresh`. O backend ROTA o refresh
 * token (revoga o antigo ao emitir o novo, auth_handler.go:173), então a
 * segunda chamada com o token já trocado falharia e derrubaria a sessão de um
 * usuário perfeitamente válido.
 */
let refreshInFlight: Promise<Session | null> | null = null;

async function performRefresh(refreshToken: string): Promise<Session | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      token?: string;
      refresh_token?: string;
    };
    if (!data.token || !data.refresh_token) return null;

    return { accessToken: data.token, refreshToken: data.refresh_token };
  } catch {
    return null;
  }
}

/** Devolve a sessão renovada, ou `null` se o refresh token morreu. */
export function refreshSession(session: Session): Promise<Session | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh(session.refreshToken).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ---------------------------------------------------------------- fetch

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Sessão já conhecida; evita re-ler os cookies em chamadas em série. */
  session?: Session | null;
  /** Faz o refresh e persiste os cookies novos quando der 401. */
  autoRefresh?: boolean;
  /** `fetch` cru, para PUT binário (upload direto na URL assinada). */
  raw?: boolean;
  signal?: AbortSignal;
}

/**
 * Chamada autenticada à API Go.
 *
 * Fluxo: tenta com o access token; em 401, renova uma vez e repete; se a
 * renovação falhar, propaga o 401 para o chamador decidir (normalmente
 * redirecionar para o login).
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, autoRefresh = true, raw = false, signal } = options;

  const session = options.session ?? (await readSession());
  if (!session) {
    throw new ApiError("Sessão expirada. Entre de novo.", 401);
  }

  return request<T>(path, { method, body, raw, signal }, session, autoRefresh);
}

async function request<T>(
  path: string,
  options: {
    method: string;
    body?: unknown;
    raw?: boolean;
    signal?: AbortSignal;
  },
  session: Session,
  allowRetry: boolean,
): Promise<T> {
  const { method, body, raw, signal } = options;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : raw ? (body as BodyInit) : JSON.stringify(body),
    signal,
    cache: "no-store",
  });

  if (res.status === 401 && allowRetry) {
    const renewed = await refreshSession(session);
    if (renewed) {
      return request<T>(path, options, renewed, false);
    }
    throw new ApiError("Sessão expirada. Entre de novo.", 401);
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(messageFrom(res.status, payload), res.status);
  }

  return payload as T;
}

// ---------------------------------------------------------------- público

/**
 * Chamada SEM autenticação, só para login e para o proxy de upload.
 */
export async function apiPublicFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = "GET", body, signal } = init;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: "no-store",
  });

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(messageFrom(res.status, payload), res.status);
  }

  return payload as T;
}
