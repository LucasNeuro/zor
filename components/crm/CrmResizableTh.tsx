"use client";

import type { CSSProperties, ReactNode } from "react";

type Props = {
  columnId: string;
  widthStyle: CSSProperties;
  onResizeStart: (columnId: string, clientX: number) => void;
  onResizeReset?: (columnId: string) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  align?: "left" | "right" | "center";
  variant?: "light" | "dark" | "waje";
};

export function CrmResizableTh({
  columnId,
  widthStyle,
  onResizeStart,
  onResizeReset,
  children,
  className = "",
  style,
  align = "left",
  variant = "light",
}: Props) {
  const gripColor =
    variant === "waje" ? "bg-[#86efac]/40" : variant === "dark" ? "bg-gray-600" : "bg-[#d4e3f7]";
  const hoverColor =
    variant === "waje"
      ? "hover:bg-[#3f9848]/20"
      : variant === "dark"
        ? "hover:bg-gray-500/25"
        : "hover:bg-[#61789b]/15";

  return (
    <th
      className={`relative select-none ${className}`}
      style={{
        ...widthStyle,
        textAlign: align,
        ...style,
      }}
    >
      <span className="block overflow-hidden text-ellipsis whitespace-nowrap pr-3">{children}</span>
      <button
        type="button"
        aria-label="Ajustar largura da coluna (duplo clique para restaurar)"
        title="Arraste para redimensionar · duplo clique restaura"
        className={`absolute right-0 top-0 z-20 h-full w-3 cursor-col-resize border-0 bg-transparent p-0 touch-none ${hoverColor}`}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onResizeStart(columnId, e.clientX);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onResizeReset?.(columnId);
        }}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute right-1 top-1/4 h-1/2 w-0.5 ${gripColor}`}
      />
    </th>
  );
}
