"use client";

import type { ReactNode } from "react";

const selectCls =
  "min-h-10 min-w-0 flex-1 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 py-2 text-sm text-[#0b2210] outline-none focus:border-[#c9a24a] sm:flex-none sm:min-w-[9rem]";

const inputCls =
  "min-h-10 w-full min-w-0 flex-1 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 py-2 text-sm text-[#0b2210] outline-none placeholder:text-[#6e7681] focus:border-[#c9a24a] sm:min-w-[12rem]";

type SelectOpt = { value: string; label: string };

type Props = {
  busca: string;
  onBuscaChange: (v: string) => void;
  buscaPlaceholder: string;
  selects: {
    id: string;
    value: string;
    onChange: (v: string) => void;
    label: string;
    options: SelectOpt[];
    minWidth?: string;
  }[];
  onLimpar: () => void;
  trailing?: ReactNode;
};

export function CadastroFiltrosBar({
  busca,
  onBuscaChange,
  buscaPlaceholder,
  selects,
  onLimpar,
  trailing,
}: Props) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder={buscaPlaceholder}
          className={inputCls}
        />
        {selects.map((s) => (
          <select
            key={s.id}
            value={s.value}
            onChange={(e) => s.onChange(e.target.value)}
            className={selectCls}
            style={s.minWidth ? { minWidth: s.minWidth } : undefined}
            aria-label={s.label}
          >
            {s.options.map((o) => (
              <option key={o.value || "__all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
        <button
          type="button"
          onClick={onLimpar}
          className="min-h-10 shrink-0 rounded-lg border border-[#dcebd8] px-3 py-2 text-xs font-semibold text-[#5d7a67] transition-colors hover:border-[#484f58] hover:text-white"
        >
          Limpar filtros
        </button>
        {trailing}
      </div>
    </div>
  );
}
