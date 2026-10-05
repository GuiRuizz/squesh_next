import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Peças de formulário compartilhadas.
 *
 * Todo formulário do painel tem a mesma anatomia: rótulo, controle, dica e
 * erro. Concentrar isso aqui evita cada tela inventar um espaçamento e — o
 * mais importante — evita o caso comum de erro em que a validação acontece e
 * a mensagem aparece, mas o campo não fica marcado para leitor de tela.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  /** Ajuda contextual: o formato esperado, a regra de negócio, o exemplo. */
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>

      {children}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-foreground-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Agrupa campos em grade responsiva: uma coluna no celular, duas no desktop. */
export function FormGrid({
  columns = 2,
  className,
  children,
}: {
  columns?: 1 | 2 | 3;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 1 && "sm:grid-cols-1",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
