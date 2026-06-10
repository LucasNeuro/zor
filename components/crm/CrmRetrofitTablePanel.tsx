"use client";

import type { ReactNode } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import {
  CrmResizableDataTable,
  type CrmResizableColumn,
} from "@/components/crm/CrmResizableDataTable";
import { CrmRetrofitListToolbar } from "@/components/crm/CrmRetrofitListToolbar";
import { downloadCrmCsv } from "@/lib/crm/crm-export-csv";

export type CrmRetrofitTableToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  advancedFilters?: ReactNode;
  exportLabel?: string;
  /** Se omitido, usa exportação automática quando `exportConfig` está definido. */
  onExport?: () => void;
};

export type CrmRetrofitTableExportConfig<T> = {
  filename: string;
  headers: string[];
  rowValues: (row: T) => string[];
};

type Props<T> = {
  tableId: string;
  columns: CrmResizableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  /** Ex.: "Exibindo 1-2 de 5 leads" */
  footerSummary?: string;
  footer?: ReactNode;
  className?: string;
  toolbar?: CrmRetrofitTableToolbarProps;
  exportConfig?: CrmRetrofitTableExportConfig<T>;
  onEditRow?: (row: T) => void;
  onViewRow?: (row: T) => void;
  onDeleteRow?: (row: T) => void;
};

function TableActionGroup({ children }: { children: ReactNode }) {
  return (
    <div
      className="inline-flex items-stretch overflow-hidden rounded-lg border border-[#d4ecd0] bg-white shadow-[0_1px_2px_rgba(11,31,16,0.04)]"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function TableActionBtn({
  onClick,
  title,
  ariaLabel,
  children,
  variant = "default",
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: ReactNode;
  variant?: "default" | "primary";
}) {
  const tone =
    variant === "primary"
      ? "text-[#3f9848] hover:bg-[#f0f9ee]"
      : "text-[#1e4a24] hover:bg-[#f0f9ee]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center border-l border-[#d4ecd0] first:border-l-0 ${tone}`}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  );
}

function buildActionsColumn<T>(
  onEditRow?: (row: T) => void,
  onViewRow?: (row: T) => void,
  onDeleteRow?: (row: T) => void
): CrmResizableColumn<T> | null {
  if (!onEditRow && !onViewRow && !onDeleteRow) return null;

  return {
    id: "acoes",
    label: "Ações",
    defaultWidth: onDeleteRow ? 132 : 100,
    minWidth: onDeleteRow ? 112 : 88,
    truncate: false,
    align: "center",
    render: (row) => (
      <TableActionGroup>
        {onViewRow ? (
          <TableActionBtn
            onClick={() => onViewRow(row)}
            ariaLabel="Ver detalhes"
            title="Ver detalhes"
          >
            <Eye size={15} />
          </TableActionBtn>
        ) : null}
        {onEditRow ? (
          <TableActionBtn
            onClick={() => onEditRow(row)}
            ariaLabel="Editar"
            title="Editar"
            variant="primary"
          >
            <Pencil size={15} />
          </TableActionBtn>
        ) : null}
        {onDeleteRow ? (
          <TableActionBtn
            onClick={() => onDeleteRow(row)}
            ariaLabel="Excluir"
            title="Desativar atendente"
          >
            <Trash2 size={15} className="text-[#b91c1c]" />
          </TableActionBtn>
        ) : null}
      </TableActionGroup>
    ),
  };
}

/** Padding horizontal padrão — alinhar métricas e tabela na mesma coluna. */
export const crmRetrofitPageXClass = "px-3 sm:px-4 lg:px-5";

/** Tabela redimensionável no padrão retrofit Waje (Conta, Equipe, CRM). */
export function CrmRetrofitTablePanel<T>({
  tableId,
  columns,
  rows,
  rowKey,
  emptyMessage = "Nenhum registo encontrado.",
  onRowClick,
  footerSummary,
  footer,
  className = "",
  toolbar,
  exportConfig,
  onEditRow,
  onViewRow,
  onDeleteRow,
}: Props<T>) {
  const actionsCol = buildActionsColumn(onEditRow, onViewRow, onDeleteRow);
  const tableColumns = actionsCol ? [...columns, actionsCol] : columns;

  const handleExport =
    toolbar?.onExport ??
    (exportConfig
      ? () => {
          downloadCrmCsv(
            exportConfig.filename,
            exportConfig.headers,
            rows.map(exportConfig.rowValues)
          );
        }
      : undefined);

  return (
    <div
      className={`w-full min-w-0 overflow-hidden rounded-2xl bg-white ${className}`.trim()}
      style={{ border: "1px solid #dcebd8", boxShadow: "0 2px 8px rgba(11,31,16,0.04)" }}
    >
      {toolbar ? (
        <CrmRetrofitListToolbar
          searchValue={toolbar.searchValue}
          onSearchChange={toolbar.onSearchChange}
          searchPlaceholder={toolbar.searchPlaceholder}
          showAdvancedFilters={toolbar.showAdvancedFilters}
          onToggleAdvancedFilters={toolbar.onToggleAdvancedFilters}
          advancedFilters={toolbar.advancedFilters}
          exportLabel={toolbar.exportLabel}
          onExport={handleExport ?? (() => {})}
        />
      ) : null}
      <CrmResizableDataTable
        tableId={tableId}
        variant="waje"
        columns={tableColumns}
        rows={rows}
        rowKey={rowKey}
        emptyMessage={emptyMessage}
        maxHeight="none"
        className="border-t-0"
        rowCellClassName="px-4 py-3 align-top"
        onRowClick={onRowClick}
        getRowStyle={(_, idx) => ({
          borderTop: idx > 0 ? "1px solid #eef5ec" : "none",
        })}
      />
      {footerSummary || footer ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef5ec] px-4 py-3">
          {footerSummary ? <p className="text-xs text-[#6b8a76]">{footerSummary}</p> : <span />}
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Label padrão para campos de filtro avançado (padrão Equipe/Conta). */
export function crmRetrofitFilterLabel(text: string): ReactNode {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider text-[#89a095]">{text}</span>
  );
}

/** Grid de filtros avançados (1–3 colunas responsivas). */
export function CrmRetrofitAdvancedFiltersGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-2 md:grid-cols-3">{children}</div>;
}

/** Campo select de filtro avançado. */
export function CrmRetrofitFilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1">
      {crmRetrofitFilterLabel(label)}
      {children}
    </label>
  );
}

export const crmRetrofitFilterSelectClass =
  "h-10 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]";

export const crmRetrofitFilterInputClass = crmRetrofitFilterSelectClass;

export function crmTableIdBadge(
  value: string,
  tone: "green" | "blue" | "muted" = "muted"
): ReactNode {
  const styles = {
    green: { bg: "rgba(146,255,0,0.12)", color: "#1e4a24", border: "rgba(146,255,0,0.3)" },
    blue: { bg: "rgba(59,130,246,0.1)", color: "#1d4ed8", border: "rgba(59,130,246,0.25)" },
    muted: { bg: "rgba(18,56,43,0.06)", color: "#6b8a76", border: "rgba(18,56,43,0.12)" },
  }[tone];
  return (
    <span
      className="inline-block max-w-full truncate rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold"
      style={{
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
      }}
      title={value}
    >
      {value}
    </span>
  );
}

export function crmTableStatusPill(label: string, active = true): ReactNode {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{
        background: active ? "rgba(146,255,0,0.12)" : "rgba(18,56,43,0.06)",
        color: active ? "#1e4a24" : "#6b8a76",
        border: `1px solid ${active ? "rgba(146,255,0,0.3)" : "#dcebd8"}`,
      }}
    >
      {label}
    </span>
  );
}

export function crmTableStagePill(label: string, color: string): ReactNode {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      {label}
    </span>
  );
}
