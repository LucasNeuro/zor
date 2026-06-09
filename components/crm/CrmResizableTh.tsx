"use client";

import type { CSSProperties, ReactNode } from "react";

type Props = {
  columnId: string;
  widthStyle: CSSProperties;
  onResizeStart: (columnId: string, clientX: number) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  align?: "left" | "right" | "center";
};

export function CrmResizableTh({
  columnId,
  widthStyle,
  onResizeStart,
  children,
  className = "",
  style,
  align = "left",
}: Props) {
  return (
    <th
      className={`relative select-none ${className}`}
      style={{
        ...widthStyle,
        textAlign: align,
        ...style,
      }}
    >
      <span className="block overflow-hidden text-ellipsis whitespace-nowrap pr-2">{children}</span>
      <button
        type="button"
        aria-label={`Ajustar largura da coluna`}
        className="absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize border-0 bg-transparent p-0 touch-none hover:bg-[#61789b]/15"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onResizeStart(columnId, e.clientX);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/4 h-1/2 w-px bg-[#d4e3f7]"
      />
    </th>
  );
}
