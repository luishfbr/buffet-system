"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Caixa de prévia: um `<iframe>` vazio, do mesmo documento, que recebe a árvore
 * React por portal.
 *
 * O iframe existe por causa das media queries — os templates da página pública
 * usam breakpoints de viewport (`sm:`, `lg:`) e unidades `svh`, que dentro de um
 * `<div>` continuariam medindo a janela do painel, e não a largura simulada. Com
 * o iframe, a prévia de celular é celular de verdade. Como o portal mantém a
 * árvore no mesmo React, o rascunho do editor chega sem serialização nem
 * `postMessage`, e o mesmo componente serve a rota `/{slug}` e a prévia.
 *
 * O conteúdo é renderizado na largura `width` e reduzido por `transform` para
 * caber na caixa — nunca ampliado, para a prévia não mentir sobre o tamanho.
 */
export function PreviewFrame({
  title,
  width,
  className,
  children,
}: {
  title: string;
  /** Largura simulada da janela, em px (ex.: 390 para celular). */
  width: number;
  className?: string;
  children: React.ReactNode;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  // O about:blank do iframe pode ser trocado depois da montagem em alguns
  // navegadores, então o onLoad reexecuta isto sobre o documento definitivo.
  const attach = useCallback(() => {
    const frame = frameRef.current?.contentDocument;
    if (!frame) return;
    frame.documentElement.lang = "pt-BR";
    // As variáveis das fontes (next/font) moram na classe do <html> do pai. O
    // `dark` fica de fora: quem decide o tema da prévia é o buffet, não o painel.
    frame.documentElement.className = document.documentElement.className
      .split(/\s+/)
      .filter((token) => token && token !== "dark")
      .join(" ");
    frame.body.className = "antialiased";
    frame.body.style.margin = "0";
    setDoc(frame);
  }, []);

  useEffect(attach, [attach]);

  // Espelha as folhas de estilo do documento pai. O MutationObserver cobre o
  // CSS que o dev server injeta depois (HMR); a assinatura evita refazer o
  // trabalho quando o <head> muda por outro motivo.
  useEffect(() => {
    if (!doc) return;
    let signature = "";
    const sync = () => {
      const sheets = document.head.querySelectorAll<HTMLElement>(
        'style, link[rel="stylesheet"]'
      );
      const next = Array.from(sheets, (node) => node.outerHTML).join("");
      if (next === signature) return;
      signature = next;
      doc.head.querySelectorAll("[data-preview-style]").forEach((n) => n.remove());
      for (const node of sheets) {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.setAttribute("data-preview-style", "");
        doc.head.appendChild(clone);
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.head, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [doc]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry!.contentRect;
      setBox({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = box.width ? Math.min(1, box.width / width) : 1;

  return (
    <div ref={boxRef} className={cn("relative overflow-hidden", className)}>
      <iframe
        ref={frameRef}
        title={title}
        onLoad={attach}
        style={{
          width,
          height: box.height ? box.height / scale : 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="absolute left-0 top-0 border-0 bg-background"
      />
      {doc && createPortal(children, doc.body)}
    </div>
  );
}
