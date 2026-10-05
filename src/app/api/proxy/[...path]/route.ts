import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiFetch, ApiError, readSession } from "@/lib/api/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/api/config";

/**
 * Proxy de mutações para a API Go.
 *
 * É o BFF propriamente dito: o browser fala com `/api/proxy/...` sem token
 * nenhum, e este handler injeta o Bearer lido do cookie `httpOnly`. Assim o
 * JWT nunca trafega em JavaScript, e o CORS nem entra na conversa (é
 * browser -> Next, e Next -> Go).
 *
 * Por que só mutações: leituras são feitas direto no servidor pelos Server
 * Components, via `lib/api/queries.ts`. Passar por este proxy só faz sentido
 * quando a chamada parte do cliente (formulário, botão de ação) e precisa
 * invalidar dados ou recarregar a tela.
 *
 * O caminho depois de `/api/proxy` é repassado como está para a API Go, então
 * `POST /api/proxy/admin/trails/123/items` vira `POST {API}/admin/trails/123/items`.
 */

type RouteContext = { params: Promise<{ path: string[] }> };

/** Métodos que alteram estado. GET fica de fora de propósito. */
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function forward(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const method = request.method.toUpperCase();

  if (!MUTATION_METHODS.has(method)) {
    return NextResponse.json(
      { error: "Método não suportado por este proxy. Use as rotas de leitura." },
      { status: 405 },
    );
  }

  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  }

  // Corpo: string vazia é diferente de "{}" para o ShouldBindJSON do Go.
  const rawBody = await request.text();
  const body = rawBody.length > 0 ? rawBody : undefined;

  const search = new URL(request.url).search;

  try {
    const res = await apiFetch<unknown>(`/${path.join("/")}${search}`, {
      method: method as "POST" | "PUT" | "PATCH" | "DELETE",
      body: body === undefined ? undefined : safeParse(body),
      session,
    });

    // 204 e outros sem corpo: devolve vazio, sem JSON inventado.
    if (res === undefined || res === null) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(res);
  } catch (error) {
    if (error instanceof ApiError) {
      // Refresh token morto: em vez de deixar a tela mostrar um erro genérico,
      // limpamos os cookies aqui, para que a próxima navegação já caia no login.
      if (error.status === 401) {
        const jar = await cookies();
        const secure = process.env.NODE_ENV === "production";
        const base = { httpOnly: true, sameSite: "strict" as const, path: "/", secure };
        jar.set(ACCESS_COOKIE, "", { ...base, maxAge: 0 });
        jar.set(REFRESH_COOKIE, "", { ...base, maxAge: 0 });
      }

      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Não foi possível conectar ao servidor." },
      { status: 503 },
    );
  }
}

/**
 * O Go espera JSON. Se o corpo não for JSON válido, devolvemos o texto cru:
 * deixar o ShouldBindJSON do Go acusar "invalid character" é mais honesto do
 * que mascarar com um erro genérico de parse.
 */
function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;

export const dynamic = "force-dynamic";
