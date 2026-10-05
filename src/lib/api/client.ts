/**
 * Cliente de mutações para o BROWSER.
 *
 * Toda escrita do painel passa por aqui e sai para `/api/proxy/...`, que
 * injeta o token do cookie `httpOnly`. O browser nunca vê o JWT.
 *
 * Tratar o erro em um lugar só é o motivo de `request` existir: ele extrai a
 * mensagem que o Go mandou (`{ "error": "..." }`) e levanta um `ApiError` com o
 * status, para os formulários mostrarem o texto do backend em vez de um
 * genérico. É o mesmo critério do `describeError()` do app Flutter.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const FALLBACK: Record<number, string> = {
  400: "Dados inválidos. Revise os campos.",
  401: "Sessão expirada. Entre de novo.",
  403: "Você não tem permissão para isso.",
  404: "Não encontramos o que você procurou.",
  409: "Não foi possível concluir: o registro está em uso.",
  503: "Não foi possível conectar ao servidor.",
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`/api/proxy${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Sem conexão com o servidor.", 503);
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
        ? ((payload as { error: string }).error)
        : FALLBACK[res.status] ?? "Não foi possível concluir. Tente de novo.";

    throw new ApiError(message, res.status);
  }

  return payload as T;
}

export const apiMutate = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Mensagem de erro pronta para toast, com fallback quando não é ApiError. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível concluir. Tente de novo.";
}
