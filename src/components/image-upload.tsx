"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { API_PATHS } from "@/lib/api/endpoints";
import { apiMutate, errorMessage } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Campo de imagem com upload direto para a URL assinada.
 *
 * O fluxo é o do app Flutter e o mesmo do S3: pedir a assinatura
 * (`POST /uploads/presign`) e enviar os bytes direto para a URL assinada, sem
 * passar o arquivo pelo Next. Isso mantém um produto de 5 MB fora do corpo da
 * requisição de criação e evita segurar o arquivo em memória no servidor.
 *
 * O campo também aceita colar uma URL: nem toda imagem do catálogo é nova, e
 * travar o admin em "terceiro arquivo" seria uma fricção sem motivo.
 */
export function ImageUpload({
  value,
  onChange,
  /** Pasta aceita pelo backend. O Go só valida `posts` e `avatars`. */
  folder = "posts",
  label = "Imagem",
  hint,
  className,
}: {
  value: string;
  onChange: (url: string) => void;
  folder?: "posts" | "avatars";
  label?: string;
  hint?: string;
  className?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const presigned = await apiMutate.post<{ upload_url: string; image_url: string }>(
        API_PATHS.presign,
        { filename: file.name, content_type: file.type, folder },
      );

      const res = await fetch(presigned.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!res.ok) throw new Error("O servidor recusou o arquivo.");

      onChange(presigned.image_url);
      toast.success("Imagem enviada.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      // Permite reenviar exatamente o mesmo arquivo: sem isso, o onChange não
      // dispara e o admin teria que escolher outro arquivo do disco.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm leading-none font-medium">{label}</p>

      <div className="flex items-start gap-3">
        <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2">
          {value ? (
            // next/image com URL absoluta de host externo exige config; o
            // <img> é o caminho previsível para um campo que aceita qualquer
            // URL colada.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-5 text-foreground-faint" aria-hidden />
          )}

          {value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Remover imagem"
              className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 text-foreground-muted transition-colors hover:text-destructive"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Upload aria-hidden />
              )}
              {uploading ? "Enviando…" : "Enviar arquivo"}
            </Button>
          </div>

          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://…"
            aria-label="URL da imagem"
            disabled={uploading}
          />

          {hint ? <p className="text-xs text-foreground-faint">{hint}</p> : null}
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
