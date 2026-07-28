"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Pilha de modais abertos (RNF08). O funil já aninha `Modal` dentro de `Modal`
 * (kanban → motivo da perda) e o `ConfirmDialog` aninha em mais lugares, então
 * a trava de scroll é **contada**: um `overflow: hidden` solto destravaria o
 * body ao fechar o modal de cima, com o de baixo ainda aberto. A pilha também
 * garante que o Escape feche só o modal do topo.
 */
const stack: string[] = [];
let previousOverflow = "";

function pushModal(id: string) {
  if (stack.length === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  stack.push(id);
}

function popModal(id: string) {
  const index = stack.lastIndexOf(id);
  if (index !== -1) stack.splice(index, 1);
  if (stack.length === 0) document.body.style.overflow = previousOverflow;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Elemento a receber o foco na abertura. Padrão: o primeiro focável. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const id = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);
  // Só fecha no clique do backdrop se o gesto COMEÇOU nele — sem isto, arrastar
  // uma seleção de texto de dentro para fora fecha o modal e perde o formulário.
  const startedOnBackdrop = React.useRef(false);
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  React.useEffect(() => {
    if (!open) return;
    pushModal(id);
    return () => popModal(id);
  }, [open, id]);

  // Guarda a origem do foco, foca dentro do painel e restaura ao fechar.
  React.useEffect(() => {
    if (!open) return;
    const origin = document.activeElement as HTMLElement | null;
    const target =
      initialFocusRef?.current ??
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      panelRef.current;
    target?.focus();
    return () => origin?.focus?.();
  }, [open, initialFocusRef]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      // Eventos do teclado sobem até o document; só o modal do topo reage.
      if (stack[stack.length - 1] !== id) return;

      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      const nodes = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!panel || !nodes || nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, id, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        startedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && startedOnBackdrop.current) onClose();
        startedOnBackdrop.current = false;
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-xl border bg-card p-6 shadow-lg outline-none sm:rounded-xl",
          className
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 pr-8">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {children}
        {/* Depois do conteúdo no DOM de propósito: assim o foco inicial cai no
            primeiro campo do formulário, não no botão de fechar. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
