"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

/**
 * Confirmação de ação destrutiva (RNF08), no lugar do `confirm()` nativo — que
 * não é estilizável, não é traduzível e trava a thread do navegador.
 *
 * Herda do `Modal` o foco preso, o foco restaurado e a trava de scroll contada,
 * então funciona aninhado dentro de outro modal (é o caso do catálogo).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "destructive",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      className="sm:max-w-md"
      // Numa ação destrutiva o foco inicial vai para "Cancelar": um Enter
      // reflexo não pode apagar o dado do usuário.
      initialFocusRef={variant === "destructive" ? cancelRef : undefined}
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          ref={cancelRef}
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={variant === "destructive" ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? "Aguarde..." : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
