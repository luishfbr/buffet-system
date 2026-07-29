"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { PublicPageData } from "@buffet/shared";
import { PublicPage } from "@/components/public/public-page";
import { PreviewFrame } from "@/components/public/preview-frame";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Larguras de janela simuladas: um celular comum e um notebook. */
const DEVICES = {
  mobile: { label: "Celular", icon: Smartphone, width: 390 },
  desktop: { label: "Computador", icon: Monitor, width: 1280 },
} as const;

type Device = keyof typeof DEVICES;

/**
 * A página pública desenhada com o rascunho do editor (RF25–RF28) — mesmo
 * componente da rota `/{slug}`, então o que aparece aqui é o que o cliente vê.
 */
export function PagePreview({
  data,
  className,
}: {
  data: PublicPageData;
  className?: string;
}) {
  const [device, setDevice] = useState<Device>("desktop");

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Prévia</h2>
          <p className="text-xs text-muted-foreground">
            Atualiza enquanto você edita. Publica ao salvar.
          </p>
        </div>
        <Tabs
          label="Tamanho da tela"
          className="w-auto"
          value={device}
          onChange={setDevice}
          items={(Object.keys(DEVICES) as Device[]).map((key) => ({
            key,
            label: DEVICES[key].label,
            icon: DEVICES[key].icon,
          }))}
        />
      </div>

      <PreviewFrame
        title="Prévia da página pública"
        width={DEVICES[device].width}
        className={cn(
          "min-h-0 flex-1 rounded-xl border bg-background shadow-sm",
          // No celular a moldura acompanha a largura real em vez de esticar.
          device === "mobile" && "mx-auto w-full max-w-[390px]"
        )}
      >
        <PublicPage data={data} preview />
      </PreviewFrame>
    </div>
  );
}
