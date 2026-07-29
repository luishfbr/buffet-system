"use client";

import {
  PUBLIC_TEMPLATES,
  PUBLIC_TEMPLATE_DESCRIPTIONS,
  PUBLIC_TEMPLATE_LABELS,
  type PublicTemplate,
} from "@buffet/shared";
import { cn } from "@/lib/utils";

/**
 * Escolha do layout da página pública (RF26). Cada opção traz um esquema do
 * arranjo — é mais rápido de ler do que o nome do template.
 */
export function TemplatePicker({
  value,
  onChange,
}: {
  value: PublicTemplate;
  onChange: (template: PublicTemplate) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Layout da página</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {PUBLIC_TEMPLATES.map((template) => {
          const active = template === value;
          return (
            <button
              key={template}
              type="button"
              onClick={() => onChange(template)}
              aria-pressed={active}
              className={cn(
                "flex flex-col gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-brand bg-brand/5 ring-1 ring-brand/40"
                  : "hover:bg-accent"
              )}
            >
              <TemplateSketch template={template} />
              <span className="text-sm font-medium">
                {PUBLIC_TEMPLATE_LABELS[template]}
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {PUBLIC_TEMPLATE_DESCRIPTIONS[template]}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Esquema do layout — blocos, sem texto: o que muda entre os três é o arranjo. */
function TemplateSketch({ template }: { template: PublicTemplate }) {
  return (
    <span
      aria-hidden
      className="flex aspect-4/3 w-full flex-col gap-1.5 rounded-md border bg-muted/50 p-2"
    >
      {template === "vitrine" && (
        <>
          <span className="h-1/2 rounded-sm bg-brand/40" />
          <span className="grid flex-1 grid-cols-2 gap-1.5">
            <span className="rounded-sm bg-foreground/15" />
            <span className="rounded-sm bg-foreground/15" />
          </span>
        </>
      )}

      {template === "elegante" && (
        <span className="flex flex-1 flex-col items-center justify-center gap-1.5">
          <span className="h-1 w-1/2 rounded-full bg-foreground/30" />
          <span className="mb-1 h-0.5 w-5 rounded-full bg-brand" />
          {[0, 1, 2].map((row) => (
            <span key={row} className="flex w-full items-center gap-1">
              <span className="h-0.5 w-1/4 rounded-full bg-foreground/25" />
              <span className="h-px flex-1 bg-foreground/15" />
              <span className="h-0.5 w-3 rounded-full bg-foreground/25" />
            </span>
          ))}
        </span>
      )}

      {template === "direto" && (
        <span className="flex flex-1 gap-1.5">
          <span className="flex flex-[3] flex-col gap-1.5">
            {[0, 1, 2, 3].map((row) => (
              <span key={row} className="h-1.5 rounded-sm bg-foreground/15" />
            ))}
          </span>
          <span className="flex-[2] rounded-sm bg-brand/40" />
        </span>
      )}
    </span>
  );
}
