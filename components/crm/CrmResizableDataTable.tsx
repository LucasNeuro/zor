"use client";

import type { CSSProperties, ReactNode } from "react";
import { CrmResizableTh } from "@/components/crm/CrmResizableTh";
import {
  useResizableTableColumns,
  type ResizableColumnDef,
} from "@/lib/crm/use-resizable-table-columns";

export type CrmResizableColumn<T> = {
  id: string;
  label: ReactNode;
  defaultWidth: number;
  minWidth?: number;
  align?: "left" | "right" | "center";
  headerClassName?: string;
  cellClassName?: string;
  /** Trunca texto longo com reticências (desligar em colunas de acções). */
  truncate?: boolean;
  render: (row: T) => ReactNode;
};

type Props<T> = {
  tableId: string;
  columns: CrmResizableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  maxHeight?: string;
  className?: string;
  variant?: "light" | "dark" | "waje";
  headerRowClassName?: string;
  rowCellClassName?: string;
  getRowStyle?: (row: T, index: number) => CSSProperties | undefined;
  onRowClick?: (row: T) => void;
};

const VARIANT_STYLES = {
  light: {
    wrapper: "border-t border-[#edf3fb]",
    thead: "bg-[#f7fbff] shadow-[inset_0_-1px_0_#edf3fb]",
    th: "text-[#61789b]",
    tr: "hover:bg-[#f7fbff]/80",
    td: "",
    empty: "text-[#6f86a6]",
  },
  dark: {
    wrapper: "border-t border-gray-800",
    thead: "bg-gray-900 border-b border-gray-800",
    th: "text-gray-500",
    tr: "hover:bg-gray-900/60",
    td: "text-gray-200",
    empty: "text-gray-600",
  },
  waje: {
    wrapper: "border-t border-[#eef5ec]",
    thead: "bg-[#f8fcf6] shadow-[inset_0_-1px_0_#dcebd8]",
    th: "text-[#6b8a76]",
    tr: "hover:bg-[#f8fcf6]/80",
    td: "text-[#0b2210]",
    empty: "text-[#6b8a76]",
  },
} as const;

export function CrmResizableDataTable<T>({
  tableId,
  columns,
  rows,
  rowKey,
  emptyMessage = "Nenhum registo encontrado.",
  maxHeight = "min(70vh, calc(100dvh - 16rem))",
  className = "",
  variant = "light",
  headerRowClassName = "",
  rowCellClassName = "px-4 py-4 align-top",
  getRowStyle,
  onRowClick,
}: Props<T>) {
  const v = VARIANT_STYLES[variant];
  const defs: ResizableColumnDef[] = columns.map((c) => ({
    id: c.id,
    defaultWidth: c.defaultWidth,
    minWidth: c.minWidth,
  }));

  const { colStyle, cellTruncateClass, startResize, tableWidth } = useResizableTableColumns(
    tableId,
    defs
  );

  return (
    <div
      className={`w-full min-w-0 overflow-auto ${v.wrapper} ${className}`.trim()}
      style={maxHeight === "none" ? undefined : { maxHeight }}
    >
      <table
        className="table-fixed text-left"
        style={{ width: Math.max(tableWidth, 640), minWidth: "100%" }}
      >
        <colgroup>
          {columns.map((c) => (
            <col key={c.id} style={colStyle(c.id)} />
          ))}
        </colgroup>
        <thead className={`sticky top-0 z-10 ${v.thead}`}>
          <tr className={headerRowClassName}>
            {columns.map((c) => (
              <CrmResizableTh
                key={c.id}
                columnId={c.id}
                widthStyle={colStyle(c.id)}
                onResizeStart={startResize}
                align={c.align}
                className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider ${v.th} ${c.headerClassName ?? ""}`}
              >
                {c.label}
              </CrmResizableTh>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={`px-4 py-12 text-center text-sm ${v.empty}`}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={rowKey(row)}
                style={getRowStyle?.(row, idx)}
                className={`${v.tr} ${onRowClick ? "cursor-pointer" : ""}`.trim() || undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={`${rowCellClassName} ${v.td} ${c.truncate === false ? "" : cellTruncateClass} ${c.cellClassName ?? ""}`}
                    style={colStyle(c.id)}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
