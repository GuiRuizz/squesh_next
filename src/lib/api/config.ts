/**
 * Configuração do backend, lida no SERVIDOR.
 *
 * O BFF fala com a API Go por dentro, então o token nunca chega ao browser.
 * Usamos `API_URL` (server-only) e caímos no `NEXT_PUBLIC_API_URL` do
 * `.env.local` para não quebrar o desenvolvimento enquanto o `.env` não for
 * ajustado.
 */
const RAW_BASE_URL =
  process.env.API_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  "http://localhost:8080/api/v1";

/** Sem barra no final, para a concatenação de caminho ficar previsível. */
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, "");

export const API_URL_CONFIGURED = Boolean(RAW_BASE_URL);

/** Nomes dos cookies de sessão. */
export const ACCESS_COOKIE = "squesh_admin_access";
export const REFRESH_COOKIE = "squesh_admin_refresh";

/** Mesma duração assumida do backend (ACCESS_TOKEN_EXPIRES default 24h). */
export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24;
/** REFRESH_TOKEN_EXPIRES default 720h (30 dias). */
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
