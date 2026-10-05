import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { apiPublicFetch, ApiError } from "@/lib/api/server";
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
} from "@/lib/api/config";
import type { AuthTokensResponse } from "@/lib/api/types";

/**
 * POST /api/auth/login
 *
 * Autentica contra o MESMO endpoint que o app Flutter usa
 * (`POST /auth/login` do squesh_golang) e guarda o par de tokens em cookies
 * `httpOnly`.
 *
 * Por que httpOnly: o painel expõe email, receita e endereço de todos os
 * usuários. Com o token em `localStorage`, qualquer XSS teria acesso direto a
 * ele; em cookie `httpOnly` o JavaScript da página não consegue ler o valor.
 *
 * SameSite=Strict porque o painel não é embebido em outro site: o cookie não
 * precisa viajar em navegação cruzada, e negar esse envio fecha mais uma porta
 * de CSRF.
 */
export async function POST(request: Request) {
  let email = "";
  let password = "";

  try {
    const body = (await request.json()) as { email?: string; password?: string };
    email = body.email?.trim() ?? "";
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }

  let tokens: AuthTokensResponse;
  try {
    tokens = await apiPublicFetch<AuthTokensResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      // 401 volta como 401: o formulário de login distingue "credencial errada"
      // de "erro de servidor" para mostrar a mensagem certa.
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Não foi possível conectar ao servidor." },
      { status: 503 },
    );
  }

  // Login só faz sentido para admin: o app Flutter é para usuário final, e o
  // painel não tem tela de usuário comum. Recusar aqui evita um login que
  // cairia em redirect infinito na guarda de rota.
  if (tokens.user?.role !== "admin") {
    return NextResponse.json(
      { error: "Este painel é restrito a administradores." },
      { status: 403 },
    );
  }

  const jar = await cookies();

  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, sameSite: "strict" as const, path: "/", secure };

  jar.set(ACCESS_COOKIE, tokens.token, { ...base, maxAge: ACCESS_COOKIE_MAX_AGE });
  jar.set(REFRESH_COOKIE, tokens.refresh_token, { ...base, maxAge: REFRESH_COOKIE_MAX_AGE });

  return NextResponse.json({ user: tokens.user });
}
