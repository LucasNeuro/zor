"use client";

import type { ReactNode } from "react";
import { estagioIcon } from "@/lib/crm/pipeline-card-icons";

type Props = {
  stageId: string;
  label: string;
  color: string;
  count: number;
  totalValue?: string | null;
  dragOver?: boolean;
  isMobile?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  children: ReactNode;
};

export function CrmKanbanColumn({
  stageId,
  label,
  color,
  count,
  totalValue,
  dragOver,
  isMobile,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: Props) {
  const Icon = estagioIcon(stageId);

  return (
    <div
      className={`flex flex-shrink-0 flex-col ${
        isMobile ? "w-[clamp(13rem,78vw,20rem)] snap-start" : "min-w-[360px] w-[360px]"
      }`}
    >
      <div
        className="rounded-t-[18px] border border-b-0 px-3 py-3"
        style={{
          background: "linear-gradient(165deg, #ffffff 0%, #fafdfa 100%)",
          borderColor: "rgba(18, 56, 43, 0.14)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: `${color}18`,
              border: `1px solid ${color}33`,
              color,
            }}
          >
            <Icon size={16} strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-extrabold text-[#0b2210]">{label}</span>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-[#0b2210]"
                style={{ background: `${color}22`, border: `1px solid ${color}33` }}
              >
                {count}
              </span>
            </div>
            {totalValue ? (
              <p className="mt-0.5 text-[11px] font-bold" style={{ color }}>
                {totalValue}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="flex-1 space-y-2 overflow-y-auto rounded-b-[18px] border p-2 transition-colors"
        style={{
          minHeight: 80,
          borderColor: "rgba(18, 56, 43, 0.14)",
          background: dragOver ? `${color}0f` : "#f8fcf6",
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {children}
      </div>
    </div>
  );
}
