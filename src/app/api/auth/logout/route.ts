import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSession } from "@/lib/api/queries";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/api/config";

/**
 * POST /api/auth/logout
 *
 * Revoga o refresh token no backend (POST /auth/logout) e apaga os cookies.
 *
 * O cookie é apagado mesmo se a revogação falhar: o objetivo do usuário é sair
 * do painel, e um token que o servidor já não considera válido não representa
 * risco. Deixar o cookie por causa de um erro de rede seria o pior dos dois
 * mundos.
 */
export async function POST() {
  await clearSession();

  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, sameSite: "strict" as const, path: "/", secure };

  jar.set(ACCESS_COOKIE, "", { ...base, maxAge: 0 });
  jar.set(REFRESH_COOKIE, "", { ...base, maxAge: 0 });

  return NextResponse.json({ ok: true });
}
