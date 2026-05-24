"use client";

import { memo, type ReactNode } from "react";
import { Eye, Pencil } from "lucide-react";
import { CrmCheckbox } from "@/components/crm/CrmCheckbox";
import type { CadastroListaColumn } from "@/lib/crm/cadastro-list-columns";

const CHECK_COL_PX = 48;
const DEFAULT_NAME_COL_PX = 220;
const ACTIONS_COL_PX = 96;

type Props<T extends { id: string }> = {
  rows: T[];
  columns: CadastroListaColumn<T>[];
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  primaryColumn: {
    title: (row: T) => ReactNode;
    label?: (row: T) => string;
    subtitle?: (row: T) => ReactNode;
    meta?: (row: T) => ReactNode;
  };
  onRowClick?: (row: T) => void;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  emptyMessage?: string;
  stickyPrimary?: boolean;
  nameColWidth?: number;
};

type RowProps<T extends { id: string }> = {
  row: T;
  selected: boolean;
  columns: CadastroListaColumn<T>[];
  primaryColumn: Props<T>["primaryColumn"];
  stickyPrimary: boolean;
  nameW: number;
  hasActions: boolean;
  onRowClick?: (row: T) => void;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onToggleRow: (id: string) => void;
};

function CadastroListaTableRowInner<T extends { id: string }>({
  row,
  selected,
  columns,
  primaryColumn,
  stickyPrimary,
  nameW,
  hasActions,
  onRowClick,
  onView,
  onEdit,
  onToggleRow,
}: RowProps<T>) {
  const rowBg = selected ? "bg-[#1a1608]" : "bg-[#0d1117]";

  return (
    <tr
      className={`border-b border-[#21262d]/80 transition-colors [content-visibility:auto] [contain-intrinsic-size:0_52px] ${
        onRowClick ? "cursor-pointer hover:bg-[#161b22]/80" : ""
      } ${selected ? "bg-[#c9a24a]/10" : ""}`}
      onClick={() => onRowClick?.(row)}
    >
      <td
        className={`px-3 py-3 align-middle ${
          stickyPrimary ? `sticky left-0 z-[10] ${rowBg} shadow-[2px_0_6px_rgba(0,0,0,0.2)]` : ""
        }`}
        style={{ width: CHECK_COL_PX, minWidth: CHECK_COL_PX, maxWidth: CHECK_COL_PX }}
        onClick={(e) => e.stopPropagation()}
      >
        <CrmCheckbox
          checked={selected}
          onChange={() => onToggleRow(row.id)}
          aria-label={`Selecionar ${primaryColumn.label?.(row) ?? String(primaryColumn.title(row))}`}
        />
      </td>
      <td
        className={`px-4 py-3 align-middle ${
          stickyPrimary ? `sticky z-[10] ${rowBg} shadow-[4px_0_10px_rgba(0,0,0,0.2)]` : ""
        }`}
        style={{
          left: stickyPrimary ? CHECK_COL_PX : undefined,
          width: nameW,
          minWidth: nameW,
          maxWidth: nameW,
        }}
      >
        <div className="min-w-0 font-bold text-white">{primaryColumn.title(row)}</div>
        {primaryColumn.subtitle?.(row)}
        {primaryColumn.meta?.(row)}
      </td>
      {columns.map((c) => (
        <td key={c.id} className="whitespace-nowrap px-4 py-3 align-middle text-sm">
          {c.render(row)}
        </td>
      ))}
      {hasActions && (
        <td
          className={`px-4 py-3 text-right align-middle ${
            stickyPrimary ? `sticky right-0 z-[10] ${rowBg} shadow-[-4px_0_10px_rgba(0,0,0,0.2)]` : ""
          }`}
          style={{ width: ACTIONS_COL_PX, minWidth: ACTIONS_COL_PX }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="inline-flex items-center gap-1">
            {onView && (
              <button
                type="button"
                onClick={() => onView(row)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#30363d] text-[#8b949e] transition-colors hover:bg-[#21262d] hover:text-white"
                aria-label="Ver detalhes"
                title="Ver detalhes"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(row)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#30363d] text-[#8b949e] transition-colors hover:bg-[#21262d] hover:text-[#c9a24a]"
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

const CadastroListaTableRow = memo(CadastroListaTableRowInner) as typeof CadastroListaTableRowInner;

function CadastroListaTableInner<T extends { id: string }>({
  rows,
  columns,
  selectedIds,
  onToggleRow,
  onToggleAll,
  primaryColumn,
  onRowClick,
  onView,
  onEdit,
  emptyMessage,
  stickyPrimary = false,
  nameColWidth = DEFAULT_NAME_COL_PX,
}: Props<T>) {
  const nameW = nameColWidth;
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));
  const hasActions = Boolean(onView || onEdit);

  if (rows.length === 0 && emptyMessage) {
    return (
      <p className="py-12 text-center text-sm text-[#8b949e]">{emptyMessage}</p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117]">
      <div className="min-h-0 flex-1 overflow-auto">
        <table
          className="w-full border-separate border-spacing-0 text-sm"
          style={{ minWidth: "max-content" }}
        >
          <colgroup>
            <col style={{ width: CHECK_COL_PX }} />
            <col style={{ width: nameW }} />
            {columns.map((c) => (
              <col key={c.id} style={{ minWidth: c.minWidth ?? 100 }} />
            ))}
            {hasActions && <col style={{ width: ACTIONS_COL_PX }} />}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                className={`border-b border-[#30363d] px-3 py-3 text-left ${
                  stickyPrimary
                    ? "sticky left-0 z-[30] bg-[#161b22] shadow-[2px_0_6px_rgba(0,0,0,0.25)]"
                    : ""
                }`}
                style={{ width: CHECK_COL_PX, minWidth: CHECK_COL_PX, maxWidth: CHECK_COL_PX }}
              >
                <CrmCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={onToggleAll}
                  aria-label="Selecionar todos"
                />
              </th>
              <th
                className={`border-b border-[#30363d] px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#8b949e] ${
                  stickyPrimary
                    ? "sticky z-[30] bg-[#161b22] shadow-[4px_0_10px_rgba(0,0,0,0.3)]"
                    : ""
                }`}
                style={{
                  left: stickyPrimary ? CHECK_COL_PX : undefined,
                  width: nameW,
                  minWidth: nameW,
                  maxWidth: nameW,
                }}
              >
                Nome
              </th>
              {columns.map((c) => (
                <th
                  key={c.id}
                  className="whitespace-nowrap border-b border-[#30363d] bg-[#161b22] px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#8b949e]"
                  style={{ minWidth: c.minWidth ?? 100 }}
                >
                  {c.label}
                </th>
              ))}
              {hasActions && (
                <th
                  className={`whitespace-nowrap border-b border-[#30363d] px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#8b949e] ${
                    stickyPrimary
                      ? "sticky right-0 z-[30] bg-[#161b22] shadow-[-4px_0_10px_rgba(0,0,0,0.3)]"
                      : "bg-[#161b22]"
                  }`}
                  style={{ width: ACTIONS_COL_PX, minWidth: ACTIONS_COL_PX }}
                >
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <CadastroListaTableRow
                key={row.id}
                row={row}
                selected={selectedIds.has(row.id)}
                columns={columns}
                primaryColumn={primaryColumn}
                stickyPrimary={stickyPrimary}
                nameW={nameW}
                hasActions={hasActions}
                onRowClick={onRowClick}
                onView={onView}
                onEdit={onEdit}
                onToggleRow={onToggleRow}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const CadastroListaTable = memo(CadastroListaTableInner) as typeof CadastroListaTableInner;
