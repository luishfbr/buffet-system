"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { uploadImage } from "@/lib/image";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { UploadScope } from "@buffet/shared";

/**
 * Sobe uma imagem para o bucket e devolve a URL (RNF07). Não apaga nada ao
 * remover: quem decide o que morre é quem salva, depois que o banco deixou de
 * apontar para a imagem antiga.
 */
export function ImageUpload({
  value,
  onChange,
  scope,
  label,
  hint,
  className,
  aspectClassName = "aspect-video",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  scope: UploadScope;
  label: string;
  hint?: string;
  className?: string;
  aspectClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await uploadImage(file, scope));
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Erro ao enviar a imagem"
      );
    } finally {
      setBusy(false);
      // Permite reenviar o mesmo arquivo depois de um erro.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {value && !busy && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setError(null);
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 aria-hidden className="size-3" />
            Remover
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-describedby={error ? errorId : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "group relative w-full overflow-hidden rounded-lg border border-dashed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait",
          aspectClassName,
          dragging ? "border-brand bg-brand/5" : "hover:border-brand/60",
          value ? "border-solid bg-muted" : "bg-muted/40"
        )}
      >
        {value ? (
          <img
            src={value}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1.5 px-4 text-center">
            <ImagePlus
              aria-hidden
              className="size-5 text-muted-foreground transition-colors group-hover:text-brand"
            />
            <span className="text-sm text-muted-foreground">
              Clique ou arraste uma imagem
            </span>
            {hint && (
              <span className="text-xs text-muted-foreground/80">{hint}</span>
            )}
          </span>
        )}

        {busy && (
          <span className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 text-sm">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Enviando...
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
