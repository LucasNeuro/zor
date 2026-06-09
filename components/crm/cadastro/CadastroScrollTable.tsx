"use client";

import type { ReactNode } from "react";
import { CrmResizableDataTable, type CrmResizableColumn } from "@/components/crm/CrmResizableDataTable";

type Column<T> = {
  id: string;
  label: string;
  minWidth?: number;
  render: (row: T) => ReactNode;
};

type Props<T> = {
  tableId: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  emptyMessage?: string;
};

export function CadastroScrollTable<T>({
  tableId,
  columns,
  rows,
  rowKey,
  actions,
  emptyMessage,
}: Props<T>) {
  const tableColumns: CrmResizableColumn<T>[] = columns.map((c) => ({
    id: c.id,
    label: c.label,
    defaultWidth: c.minWidth ?? 120,
    minWidth: c.minWidth ?? 80,
    render: c.render,
  }));

  if (actions) {
    tableColumns.push({
      id: "acoes",
      label: "Ações",
      defaultWidth: 140,
      minWidth: 100,
      truncate: false,
      align: "right",
      render: (row) => actions(row),
    });
  }

  return (
    <CrmResizableDataTable
      tableId={tableId}
      columns={tableColumns}
      rows={rows}
      rowKey={rowKey}
      emptyMessage={emptyMessage}
      maxHeight="100%"
    />
  );
}
