"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Star, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { FormError } from "@/components/ui/form-error";
import type { PackageImage } from "@/lib/types";
import { MAX_PACKAGE_IMAGES } from "@buffet/shared";
import { ImageUpload } from "@/components/ui/image-upload";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Galeria de fotos do pacote (RF28). Salva na hora — cada foto é uma chamada à
 * API, independente do "Salvar" do formulário do pacote.
 *
 * A primeira foto é a capa: é ela que aparece no card da página pública. Por
 * isso a ordem é editável, com botões (e não drag-and-drop) — funcionam no
 * teclado e no celular sem depender de biblioteca nova.
 */
export function PackageGallery({ packageId }: { packageId: string }) {
  const [images, setImages] = useState<PackageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const pkg = await api.get<{ images: PackageImage[] }>(
      `/packages/${packageId}`
    );
    setImages(pkg.images);
    setLoading(false);
  }, [packageId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...images];
    const target = index + direction;
    [next[index], next[target]] = [next[target]!, next[index]!];
    void run(() =>
      api.patch(`/packages/${packageId}/images/order`, {
        ids: next.map((i) => i.id),
      })
    );
  }

  const isFull = images.length >= MAX_PACKAGE_IMAGES;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Fotos do pacote</span>
        <span className="text-xs text-muted-foreground">
          {images.length}/{MAX_PACKAGE_IMAGES}
        </span>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Carregando fotos</span>
          <ul aria-hidden="true" className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="aspect-square w-full" />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          {images.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {images.map((image, index) => (
                <li
                  key={image.id}
                  className="group relative overflow-hidden rounded-md border"
                >
                  <div className="aspect-square bg-muted">
                    <img
                      src={image.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  </div>

                  {index === 0 && (
                    <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-medium text-brand-foreground">
                      <Star aria-hidden className="size-2.5" />
                      Capa
                    </span>
                  )}

                  <div className="flex items-center justify-between border-t bg-card px-1 py-1">
                    <div className="flex">
                      <IconButton
                        label="Mover para trás"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ChevronLeft aria-hidden className="size-3.5" />
                      </IconButton>
                      <IconButton
                        label="Mover para frente"
                        disabled={index === images.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ChevronRight aria-hidden className="size-3.5" />
                      </IconButton>
                    </div>
                    <IconButton
                      label="Excluir foto"
                      onClick={() =>
                        void run(() =>
                          api.del(`/packages/${packageId}/images/${image.id}`)
                        )
                      }
                      className="hover:text-destructive"
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isFull ? (
            <p className="text-xs text-muted-foreground">
              Limite de {MAX_PACKAGE_IMAGES} fotos atingido. Exclua uma para
              adicionar outra.
            </p>
          ) : (
            <ImageUpload
              scope="package"
              label={images.length === 0 ? "Primeira foto (vira a capa)" : "Adicionar foto"}
              hint="JPG, PNG ou WebP"
              aspectClassName="aspect-video"
              value={null}
              onChange={(url) => {
                if (url) void run(() => api.post(`/packages/${packageId}/images`, { url }));
              }}
            />
          )}
        </>
      )}

      <FormError error={error} />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded p-1 text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:hover:bg-transparent ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
