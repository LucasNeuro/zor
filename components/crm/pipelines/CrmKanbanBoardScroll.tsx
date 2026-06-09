"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  isMobile?: boolean;
};

/** Área kanban com scroll horizontal nas colunas. */
export function CrmKanbanBoardScroll({ children, isMobile }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={`min-h-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain ${
          isMobile ? "snap-x snap-mandatory scroll-pl-3 scrollbar-none" : ""
        }`}
      >
        <div
          className={`flex h-full w-max min-w-full ${
            isMobile ? "gap-3 px-3 py-3" : "gap-4 p-4"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
