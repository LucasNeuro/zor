"use client";

import type { ReactNode } from "react";

type Column<T> = {
  id: string;
  label: string;
  minWidth?: number;
  render: (row: T) => ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  emptyMessage?: string;
};

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  color: "#5d7a67",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #dcebd8",
  background: "#ffffff",
  position: "sticky",
  top: 0,
  zIndex: 2,
};

const TD: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "#0b2210",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

export function CadastroScrollTable<T>({ columns, rows, rowKey, actions, emptyMessage }: Props<T>) {
  if (rows.length === 0 && emptyMessage) {
    return (
      <p style={{ color: "#5d7a67", fontSize: 13, textAlign: "center", padding: "32px 16px" }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        border: "1px solid #dcebd8",
        borderRadius: 12,
        background: "#f8fcf6",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "100%" }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.id} style={{ ...TH, minWidth: c.minWidth ?? 100 }}>
                  {c.label}
                </th>
              ))}
              {actions && (
                <th style={{ ...TH, minWidth: 140, textAlign: "right" }} aria-label="Ações">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} style={{ borderTop: "1px solid #eef7eb" }}>
                {columns.map((c) => (
                  <td key={c.id} style={TD}>
                    {c.render(row)}
                  </td>
                ))}
                {actions && (
                  <td style={{ ...TD, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
