"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  coresDdd,
  formatarTelefoneBrasil,
  labelDddTooltip,
  parseTelefoneBrasil,
  telefoneDigitsCopia,
} from "@/lib/crm/telefone-brasil";

type Props = {
  telefone: string | null | undefined;
  /** Texto menor na coluna da lista */
  compact?: boolean;
  className?: string;
};

export function CrmTelefoneCell({ telefone, compact = false, className = "" }: Props) {
  const [copiado, setCopiado] = useState(false);
  const parsed = parseTelefoneBrasil(telefone);
  const raw = String(telefone ?? "").trim();

  if (!raw) {
    return <span className="text-[#484f58]">—</span>;
  }

  const fmt = formatarTelefoneBrasil(raw, { incluirPais: !compact });
  const cores = parsed ? coresDdd(parsed.ddd, parsed.regiao) : null;

  const copiar = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const digits = telefoneDigitsCopia(raw);
      if (!digits) return;
      try {
        await navigator.clipboard.writeText(digits);
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 1600);
      } catch {
        /* ignore */
      }
    },
    [raw]
  );

  return (
    <div
      className={`group flex min-w-0 items-center gap-1.5 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {parsed?.ddd && cores && (
        <span
          className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none"
          style={{
            background: cores.bg,
            color: cores.text,
            border: `1px solid ${cores.border}`,
          }}
          title={labelDddTooltip(parsed)}
        >
          {parsed.ddd}
        </span>
      )}
      <span
        className={`min-w-0 truncate tabular-nums ${compact ? "text-xs text-[#5d7a67]" : "text-sm text-[#0b2210]"}`}
        title={fmt}
      >
        {fmt || raw}
      </span>
      <button
        type="button"
        onClick={copiar}
        className="shrink-0 rounded p-1 text-[#6e7781] opacity-70 transition-opacity hover:bg-[#eef7eb] hover:text-[#c9a24a] group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a24a]/50"
        title={copiado ? "Copiado!" : "Copiar número (com 55 para WhatsApp)"}
        aria-label={copiado ? "Número copiado" : "Copiar número"}
      >
        {copiado ? <Check size={14} className="text-[#22C55E]" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
