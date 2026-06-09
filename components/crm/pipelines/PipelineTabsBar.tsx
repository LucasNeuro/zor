"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { labelPipelineTab } from "@/lib/crm/tenant-pipelines";
import { crmListPillStyle } from "@/lib/crm/crm-list-pill-styles";

export type PipelineTabItem = {
  id: string;
  slug: string;
  nome: string;
  mercado_sigla?: string | null;
};

type Props = {
  pipelines: PipelineTabItem[];
  activePipelineId: string | null;
  onSelect: (pipelineId: string) => void;
  pipelineCount?: (pipelineId: string) => number | undefined;
};

export function PipelineTabsBar({ pipelines, activePipelineId, onSelect, pipelineCount }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const tabs = useMemo(
    () =>
      pipelines.map((pipe) => ({
        ...pipe,
        shortLabel: labelPipelineTab(pipe) || "Pipeline",
      })),
    [pipelines]
  );

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const onResize = () => updateArrows();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateArrows, tabs.length, activePipelineId]);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -220 : 220,
      behavior: "smooth",
    });
  }

  if (tabs.length === 0) return null;

  return (
    <div className="relative border-b border-[#dcebd8] bg-[#f8fcf6] px-3 py-3 sm:px-4">
      {canScrollLeft ? (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-3 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#d4ecd0] bg-white text-[#5d7a67] shadow-lg sm:inline-flex"
          aria-label="Rolar pipelines para a esquerda"
        >
          <ChevronLeft size={16} />
        </button>
      ) : null}
      {canScrollRight ? (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-3 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#d4ecd0] bg-white text-[#5d7a67] shadow-lg sm:inline-flex"
          aria-label="Rolar pipelines para a direita"
        >
          <ChevronRight size={16} />
        </button>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={updateArrows}
        className="flex gap-2 overflow-x-auto scrollbar-none sm:px-10"
      >
        {tabs.map((pipe) => {
          const active = activePipelineId === pipe.id;
          const count = pipelineCount?.(pipe.id);
          return (
            <button
              key={pipe.id}
              type="button"
              onClick={() => onSelect(pipe.id)}
              style={crmListPillStyle(active)}
              title={pipe.nome}
            >
              {pipe.shortLabel}
              {typeof count === "number" ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
