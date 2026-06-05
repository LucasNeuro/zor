"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";

export type PipelineTabItem = {
  id: string;
  slug: string;
  nome: string;
  mercado_sigla?: string | null;
};

function labelAbreviadoPipeline(pipe: PipelineTabItem): string {
  if (pipe.mercado_sigla) return labelMercadoPrefixo(pipe.mercado_sigla);
  return pipe.nome
    .replace(/^Leads\s+[—-]\s+/i, "")
    .replace(/^Negócios\s+[—-]\s+/i, "")
    .trim();
}

type Props = {
  pipelines: PipelineTabItem[];
  activePipelineId: string | null;
  onSelect: (pipelineId: string) => void;
};

export function PipelineTabsBar({ pipelines, activePipelineId, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const tabs = useMemo(
    () =>
      pipelines.map((pipe) => ({
        ...pipe,
        shortLabel: labelAbreviadoPipeline(pipe) || "Pipeline",
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
    <div className="relative border-b border-[#dcebd8] bg-[#111827] px-3 py-2 sm:px-4">
      {canScrollLeft ? (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-3 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#dcebd8] bg-[#f8fcf6]/95 text-[#5d7a67] shadow-lg backdrop-blur sm:inline-flex"
          aria-label="Rolar pipelines para a esquerda"
        >
          <ChevronLeft size={16} />
        </button>
      ) : null}
      {canScrollRight ? (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-3 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#dcebd8] bg-[#f8fcf6]/95 text-[#5d7a67] shadow-lg backdrop-blur sm:inline-flex"
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
          return (
            <button
              key={pipe.id}
              type="button"
              onClick={() => onSelect(pipe.id)}
              className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors"
              style={{
                borderColor: active ? "#c9a24a" : "#dcebd8",
                background: active ? "rgba(201,162,74,0.12)" : "#ffffff",
                color: active ? "#0b2210" : "#5d7a67",
              }}
              title={pipe.nome}
            >
              {pipe.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
