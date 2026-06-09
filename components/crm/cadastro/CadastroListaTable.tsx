"use client";

import { memo, useMemo, type CSSProperties, type ReactNode } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { CrmCheckbox } from "@/components/crm/CrmCheckbox";
import { CrmResizableTh } from "@/components/crm/CrmResizableTh";
import type { CadastroListaColumn } from "@/lib/crm/cadastro-list-columns";
import { useResizableTableColumns } from "@/lib/crm/use-resizable-table-columns";

const CHECK_COL_PX = 48;
const DEFAULT_NAME_COL_PX = 220;
const ACTIONS_COL_PX = 128;

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
  onDelete?: (row: T) => void;
  emptyMessage?: string;
  stickyPrimary?: boolean;
  nameColWidth?: number;
  /** Chave para persistir larguras das colunas no browser. */
  tableId: string;
};

type RowProps<T extends { id: string }> = {
  row: T;
  selected: boolean;
  columns: CadastroListaColumn<T>[];
  primaryColumn: Props<T>["primaryColumn"];
  stickyPrimary: boolean;
  nameW: number;
  colStyle: (id: string) => CSSProperties;
  cellTruncateClass: string;
  hasActions: boolean;
  onRowClick?: (row: T) => void;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onToggleRow: (id: string) => void;
};

function CadastroListaTableRowInner<T extends { id: string }>({
  row,
  selected,
  columns,
  primaryColumn,
  stickyPrimary,
  nameW,
  colStyle,
  cellTruncateClass,
  hasActions,
  onRowClick,
  onView,
  onEdit,
  onDelete,
  onToggleRow,
}: RowProps<T>) {
  const rowBg = selected ? "bg-[#1a1608]" : "bg-[#f8fcf6]";

  return (
    <tr
      className={`border-b border-[#eef7eb]/80 transition-colors [content-visibility:auto] [contain-intrinsic-size:0_52px] ${
        onRowClick ? "cursor-pointer hover:bg-[#ffffff]/80" : ""
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
        <td
          key={c.id}
          className={`px-4 py-3 align-middle text-sm ${cellTruncateClass}`}
          style={colStyle(c.id)}
        >
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
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dcebd8] text-[#5d7a67] transition-colors hover:bg-[#eef7eb] hover:text-white"
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
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dcebd8] text-[#5d7a67] transition-colors hover:bg-[#eef7eb] hover:text-[#c9a24a]"
                aria-label="Editar"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(row)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dcebd8] text-[#5d7a67] transition-colors hover:border-[#f8514966] hover:bg-[#eef7eb] hover:text-[#f85149]"
                aria-label="Excluir"
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
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
  onDelete,
  emptyMessage,
  stickyPrimary = false,
  nameColWidth = DEFAULT_NAME_COL_PX,
  tableId,
}: Props<T>) {
  const columnDefs = useMemo(
    () => [
      { id: "nome", defaultWidth: nameColWidth, minWidth: 140 },
      ...columns.map((c) => ({
        id: c.id,
        defaultWidth: c.minWidth ?? 120,
        minWidth: Math.min(c.minWidth ?? 80, 80),
      })),
    ],
    [columns, nameColWidth]
  );

  const { colStyle, cellTruncateClass, startResize } = useResizableTableColumns(tableId, columnDefs);
  const nameW = Number(colStyle("nome").width) || nameColWidth;
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));
  const hasActions = Boolean(onView || onEdit || onDelete);

  if (rows.length === 0 && emptyMessage) {
    return (
      <p className="py-12 text-center text-sm text-[#5d7a67]">{emptyMessage}</p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#dcebd8] bg-[#f8fcf6]">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col style={{ width: CHECK_COL_PX }} />
            <col style={colStyle("nome")} />
            {columns.map((c) => (
              <col key={c.id} style={colStyle(c.id)} />
            ))}
            {hasActions && <col style={{ width: ACTIONS_COL_PX }} />}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                className={`border-b border-[#dcebd8] px-3 py-3 text-left ${
                  stickyPrimary
                    ? "sticky left-0 z-[30] bg-[#ffffff] shadow-[2px_0_6px_rgba(0,0,0,0.25)]"
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
              <CrmResizableTh
                columnId="nome"
                widthStyle={{
                  ...colStyle("nome"),
                  left: stickyPrimary ? CHECK_COL_PX : undefined,
                }}
                onResizeStart={startResize}
                className={`border-b border-[#dcebd8] bg-[#ffffff] text-xs font-bold uppercase tracking-wide text-[#5d7a67] ${
                  stickyPrimary
                    ? "sticky z-[30] shadow-[4px_0_10px_rgba(0,0,0,0.3)]"
                    : ""
                }`}
              >
                Nome
              </CrmResizableTh>
              {columns.map((c) => (
                <CrmResizableTh
                  key={c.id}
                  columnId={c.id}
                  widthStyle={colStyle(c.id)}
                  onResizeStart={startResize}
                  className="border-b border-[#dcebd8] bg-[#ffffff] text-xs font-bold uppercase tracking-wide text-[#5d7a67]"
                >
                  {c.label}
                </CrmResizableTh>
              ))}
              {hasActions && (
                <th
                  className={`whitespace-nowrap border-b border-[#dcebd8] px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#5d7a67] ${
                    stickyPrimary
                      ? "sticky right-0 z-[30] bg-[#ffffff] shadow-[-4px_0_10px_rgba(0,0,0,0.3)]"
                      : "bg-[#ffffff]"
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
                colStyle={colStyle}
                cellTruncateClass={cellTruncateClass}
                hasActions={hasActions}
                onRowClick={onRowClick}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
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
