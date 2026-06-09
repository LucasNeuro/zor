"use client";

import type { ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

type Props = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  onExport: () => void;
  advancedFilters?: ReactNode;
  exportLabel?: string;
  className?: string;
};

/** Barra de busca + filtros avançados + exportar (padrão Conta/Equipe Waje). */
export function CrmRetrofitListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar…",
  showAdvancedFilters,
  onToggleAdvancedFilters,
  onExport,
  advancedFilters,
  exportLabel = "Exportar",
  className = "",
}: Props) {
  return (
    <div className={`border-b border-[#eef5ec] px-4 py-3 ${className}`.trim()}>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
        <div className="flex h-10 items-center gap-2 rounded-xl border border-[#d4ecd0] bg-white px-3">
          <Search size={14} className="text-[#6b8a76]" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-sm text-[#1e3a23] outline-none placeholder:text-[#90a89b]"
          />
        </div>
        <button
          type="button"
          onClick={onToggleAdvancedFilters}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
          style={{ borderColor: "#d4ecd0", color: "#1e4a24", background: "#fff" }}
          aria-expanded={showAdvancedFilters}
        >
          <SlidersHorizontal size={13} />
          Filtros avançados
        </button>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
          style={{ borderColor: "#d4ecd0", color: "#1e4a24", background: "#fff" }}
        >
          {exportLabel}
        </button>
      </div>
      {showAdvancedFilters && advancedFilters ? (
        <div className="mt-3">{advancedFilters}</div>
      ) : null}
    </div>
  );
}
