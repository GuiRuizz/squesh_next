"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/client";

/**
 * Diálogo de formulário (criar/editar).
 *
 * Concentra o mesmo ciclo que o `ConfirmAction` tem: estado de envio, toast de
 * sucesso, toast com a mensagem do Go em caso de erro, e `router.refresh()`
 * para a Server Component reler os dados. Sem isso, cada tela repetiria a mesma
 * enrolação e o esquecimento do refresh seria silencioso — o admin veria o
 * toast de "salvo" e a lista antiga na tela.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "Salvar",
  children,
  onSubmit,
  widthClassName = "sm:max-w-lg",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  children: React.ReactNode;
  /** Receve o `FormEvent` do `<form>`; deve fazer a chamada e lançar em erro. */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  widthClassName?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    try {
      await onSubmit(event);
      onOpenChange(false);
      startTransition(() => router.refresh());
    } catch (error) {
      // O diálogo continua aberto de propósito: o admin precisa ver o que deu
      // errado e corrigir sem redigitar o formulário inteiro.
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-h-[90vh] overflow-y-auto scrollbar-subtle ${widthClassName}`}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {children}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
