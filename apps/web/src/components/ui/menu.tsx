"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Menu suspenso (padrão WAI-ARIA "menu button"), escrito à mão como o `Modal` —
 * o projeto não tem Radix e isto cabe aqui.
 *
 * Diferenças deliberadas em relação ao `Modal`: **não** trava o scroll e **não**
 * prende o foco. Um menu não é modal; quem sai dele com Tab deve continuar a
 * navegação normal da página, e o painel simplesmente fecha.
 */
export function Menu({
  trigger,
  label,
  children,
  align = "start",
  className,
  triggerClassName,
}: {
  /** Conteúdo visível do botão que abre o menu. */
  trigger: React.ReactNode;
  /** Rótulo acessível do botão (o conteúdo visual costuma ser só o nome). */
  label: string;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  const close = React.useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const items = () =>
    Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    ).filter((el) => !el.hasAttribute("disabled"));

  // Fecha ao clicar fora. `mousedown` e não `click`: se o clique cair sobre um
  // botão de outra parte da tela, ele já age com o menu fechado.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  const onPanelKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    event.preventDefault();
    const list = items();
    if (list.length === 0) return;
    const current = list.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    // Circular: de baixo volta ao topo, e vice-versa.
    const next = (current + step + list.length) % list.length;
    list[next]?.focus();
  };

  const openWith = (position: "first" | "last") => {
    setOpen(true);
    // Depois da pintura: o painel só existe no DOM a partir deste render.
    requestAnimationFrame(() => {
      const list = items();
      (position === "first" ? list[0] : list[list.length - 1])?.focus();
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openWith("first");
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openWith("last");
          }
        }}
        className={cn(
          "inline-flex min-w-0 touch-manipulation items-center gap-1.5 rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          triggerClassName
        )}
      >
        {trigger}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onPanelKeyDown}
          className={cn(
            // z-40 e não z-50: o `Modal` fica por cima, como deve.
            "absolute z-40 mt-2 min-w-56 overflow-hidden rounded-lg border bg-card p-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
            className
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Item de menu — sempre um `<button>` com `role="menuitem"`, que é o que a
 * navegação por setas procura. Para navegar, chame `router.push` no `onSelect`:
 * um `<a role="menuitem">` prometeria abrir em nova aba e não abre.
 */
export function MenuItem({
  children,
  onSelect,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }) {
  return (
    <button
      {...rest}
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        // O anel (e não só o fundo) no `focus-visible`: hover e foco pintam o
        // mesmo `bg-accent`, então sem ele quem navega pelo teclado não
        // distingue "estou aqui" de "o mouse passou por aqui".
        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

/**
 * Título de um grupo de itens. `role="presentation"`: filho direto de
 * `role="menu"` só pode ser `menuitem`/`group`/`separator`, e um `<p>` solto ali
 * deixa a árvore de acessibilidade inválida. O texto segue visível.
 */
export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="presentation"
      className="px-2.5 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
    >
      {children}
    </p>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 border-t" />;
}
