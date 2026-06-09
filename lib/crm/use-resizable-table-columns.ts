"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

export type ResizableColumnDef = {
  id: string;
  defaultWidth: number;
  minWidth?: number;
};

const STORAGE_PREFIX = "crm-table-cols:";

function loadWidths(storageKey: string, columns: ResizableColumnDef[]): Record<string, number> {
  const defaults = Object.fromEntries(columns.map((c) => [c.id, c.defaultWidth]));
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, number>;
    const out = { ...defaults };
    for (const col of columns) {
      const w = parsed[col.id];
      if (typeof w === "number" && Number.isFinite(w)) {
        out[col.id] = Math.max(col.minWidth ?? 56, w);
      }
    }
    return out;
  } catch {
    return defaults;
  }
}

function saveWidths(storageKey: string, widths: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(widths));
  } catch {
    /* quota / private mode */
  }
}

export function useResizableTableColumns(storageKey: string, columns: ResizableColumnDef[]) {
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const [widths, setWidths] = useState<Record<string, number>>(() => loadWidths(storageKey, columns));
  const resizingRef = useRef<{ id: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    setWidths(loadWidths(storageKey, columns));
  }, [storageKey]);

  useEffect(() => {
    saveWidths(storageKey, widths);
  }, [storageKey, widths]);

  const colStyle = useCallback(
    (id: string): CSSProperties => {
      const w = widths[id] ?? columnsRef.current.find((c) => c.id === id)?.defaultWidth ?? 120;
      return {
        width: w,
        minWidth: w,
        maxWidth: w,
      };
    },
    [widths]
  );

  const cellTruncateClass = "overflow-hidden text-ellipsis whitespace-nowrap";

  const startResize = useCallback(
    (id: string, clientX: number) => {
      const col = columnsRef.current.find((c) => c.id === id);
      const startW = widths[id] ?? col?.defaultWidth ?? 120;
      resizingRef.current = { id, startX: clientX, startW };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [widths]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const col = columnsRef.current.find((c) => c.id === r.id);
      const min = col?.minWidth ?? 56;
      const next = Math.max(min, r.startW + (e.clientX - r.startX));
      setWidths((prev) => ({ ...prev, [r.id]: next }));
    };

    const onUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const resetWidths = useCallback(() => {
    setWidths(Object.fromEntries(columnsRef.current.map((c) => [c.id, c.defaultWidth])));
  }, []);

  const tableWidth = columnsRef.current.reduce(
    (sum, c) => sum + (widths[c.id] ?? c.defaultWidth),
    0
  );

  return {
    widths,
    tableWidth,
    colStyle,
    cellTruncateClass,
    startResize,
    resetWidths,
  };
}
