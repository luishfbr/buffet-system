import * as React from "react";
import { cn } from "@/lib/utils";

/* Partes compostas — para tabelas com layout próprio. */

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className={cn("w-full text-sm tabular-nums", className)} {...props} />
    </div>
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b bg-muted/40 text-left text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export function TBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function Tr({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b transition-colors last:border-b-0 hover:bg-accent/50",
        className
      )}
      {...props}
    />
  );
}

export function Th({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={cn("px-4 py-2 font-medium", className)} {...props} />
  );
}

export function Td({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-2", className)} {...props} />;
}

/* DataTable genérico — o caso comum de "lista + ações por linha". */

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Classe aplicada à célula (ex.: `text-right`, `hidden sm:table-cell`). */
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty,
  actions,
  actionsLabel = "Ações",
  onRowClick,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Renderizado no lugar da tabela quando não há linhas. */
  empty?: React.ReactNode;
  actions?: (row: T) => React.ReactNode;
  actionsLabel?: string;
  /**
   * Torna a linha clicável. A primeira coluna vira um `<button>` de verdade —
   * é o que dá acesso por teclado sem transformar o `<tr>` em `role="button"`,
   * o que destruiria a semântica de tabela para o leitor de tela.
   */
  onRowClick?: (row: T) => void;
  caption?: string;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <Table>
      {caption && <caption className="sr-only">{caption}</caption>}
      <THead>
        <tr>
          {columns.map((c) => (
            <Th key={c.key} className={c.className}>
              {c.header}
            </Th>
          ))}
          {actions && <Th className="text-right">{actionsLabel}</Th>}
        </tr>
      </THead>
      <TBody>
        {rows.map((row) => (
          <Tr
            key={rowKey(row)}
            className={onRowClick ? "cursor-pointer" : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((c, i) => (
              <Td key={c.key} className={c.className}>
                {i === 0 && onRowClick ? (
                  <button
                    type="button"
                    className="text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRowClick(row);
                    }}
                  >
                    {c.cell(row)}
                  </button>
                ) : (
                  c.cell(row)
                )}
              </Td>
            ))}
            {actions && (
              <Td>
                <div
                  className="flex justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {actions(row)}
                </div>
              </Td>
            )}
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
