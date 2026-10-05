import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";

/**
 * Estado de erro de uma tela.
 *
 * O texto exibido é o que o Go mandou em `{"error": "..."}` — o mesmo critério do
 * `describeError()` do app. Só quando não há erro estruturado (rede caída,
 * exceção) cai num genérico. `401` ganha ação de re-login, porque é o único
 * caso em que repetir a requisição não resolve.
 */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  /** Repete a busca. Em Server Components quem recarrega é o router. */
  onRetry?: () => void;
  className?: string;
}) {
  const status = error instanceof ApiError ? error.status : null;
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Não foi possível carregar os dados. Tente de novo.";

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 rounded-card border border-destructive/30 bg-destructive/5 px-6 py-12 text-center ${className ?? ""}`}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden />
      </span>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Algo deu errado</p>
        <p className="mx-auto max-w-lg text-sm text-foreground-muted">{message}</p>
        {status ? (
          <p className="text-xs text-foreground-faint">Resposta {status} da API</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {status === 401 ? (
          <Button size="sm" onClick={() => (window.location.href = "/login")}>
            Entrar de novo
          </Button>
        ) : onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Tentar de novo
          </Button>
        ) : null}
      </div>
    </div>
  );
}
