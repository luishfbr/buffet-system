"use client";

import * as React from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

const DURATION_MS = 5000;
const MAX_VISIBLE = 3;

/**
 * Feedback transitório de operação (RNF08). É a **única exceção deliberada** à
 * regra de "sem context providers" do app — um toast precisa ser disparável de
 * qualquer profundidade da árvore sem prop drilling.
 *
 * Divisão de trabalho com o `FormError`: erro de validação (400/422 com
 * `errors`) fica **inline** no formulário, junto do campo; erro de operação
 * (409/500/rede) e **todo sucesso** vêm para cá.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = React.useRef(0);
  const paused = React.useRef(false);

  const clearTimer = React.useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = React.useCallback(
    (id: number) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer]
  );

  const schedule = React.useCallback(
    (id: number) => {
      clearTimer(id);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION_MS)
      );
    },
    [clearTimer, dismiss]
  );

  const push = React.useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => {
        const next = [...prev, { id, variant, message }];
        // Acima do teto, o mais antigo sai — e leva o timer dele junto.
        while (next.length > MAX_VISIBLE) {
          const dropped = next.shift();
          if (dropped) clearTimer(dropped.id);
        }
        return next;
      });
      if (!paused.current) schedule(id);
    },
    [clearTimer, schedule]
  );

  const api = React.useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
    }),
    [push]
  );

  // Enquanto o ponteiro ou o foco está sobre a pilha, nada some sozinho.
  const pause = React.useCallback(() => {
    paused.current = true;
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
  }, []);

  const resume = React.useCallback(() => {
    paused.current = false;
    setToasts((prev) => {
      prev.forEach((t) => schedule(t.id));
      return prev;
    });
  }, [schedule]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const errors = toasts.filter((t) => t.variant === "error");
  const successes = toasts.filter((t) => t.variant === "success");

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* z acima do Modal (z-50) para o toast não ficar atrás de um diálogo. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-60 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:top-0 sm:items-end"
        onMouseEnter={pause}
        onMouseLeave={resume}
        onFocusCapture={pause}
        onBlurCapture={resume}
      >
        {/* Duas regiões vivas persistentes: elas existem no DOM antes de o
            conteúdo chegar, que é o que garante o anúncio pelo leitor de tela.
            Nada de `display: contents` aqui — em parte dos navegadores isso
            remove o elemento da árvore de acessibilidade e mata a região viva. */}
        <ol
          aria-live="assertive"
          className="flex w-full flex-col items-center gap-2 empty:hidden sm:items-end"
        >
          {errors.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </ol>
        <ol
          aria-live="polite"
          className="flex w-full flex-col items-center gap-2 empty:hidden sm:items-end"
        >
          {successes.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </ol>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const isError = toast.variant === "error";
  const Icon = isError ? XCircle : CheckCircle2;
  return (
    <li
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-card p-4 text-sm shadow-lg",
        isError ? "border-destructive/40" : "border-brand/40"
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          isError ? "text-destructive" : "text-brand"
        )}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 wrap-break-word">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dispensar aviso"
        className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Fora de um `ToastProvider` devolve um no-op em vez de estourar: a prévia da
 * página pública roda dentro de um `<iframe>`, com árvore React própria.
 */
export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  return ctx ?? noopToast;
}

const noopToast: ToastApi = { success: () => {}, error: () => {} };
