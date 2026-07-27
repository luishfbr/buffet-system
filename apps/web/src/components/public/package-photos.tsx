"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Galeria do pacote na página pública (RF28): a capa grande e as demais fotos
 * como filmstrip abaixo. Sem carrossel automático — o cliente troca a foto.
 */
export function PackagePhotos({
  images,
  name,
  className,
}: {
  images: string[];
  /** Nome do pacote, para o texto alternativo da foto. */
  name: string;
  className?: string;
}) {
  const [active, setActive] = useState(0);
  if (images.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="aspect-4/3 overflow-hidden rounded-lg bg-muted">
        <img
          src={images[active]}
          alt={`${name} — foto ${active + 1}`}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Ver foto ${index + 1} de ${images.length}`}
              aria-current={index === active}
              className={cn(
                "size-14 shrink-0 touch-manipulation overflow-hidden rounded-md border-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                index === active
                  ? "border-brand"
                  : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <img
                src={url}
                alt=""
                width={56}
                height={56}
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
