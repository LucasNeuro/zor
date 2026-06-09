"use client";

import { useState } from "react";
import { ChevronDown, StickyNote } from "lucide-react";
import type { NotaPreview } from "@/components/crm/CrmKanbanNotesSection";

type Props = {
  notas: NotaPreview[];
};

function linhaUnica(s: string, n: number) {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

/** Célula colapsável de observações na tabela retrofit CRM. */
export function CrmTableNotesCell({ notas }: Props) {
  const [aberto, setAberto] = useState(false);

  if (!notas.length) {
    return <span className="text-xs text-[#90a89b]">—</span>;
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAberto((v) => !v);
        }}
        className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[#d4ecd0] bg-[#f8fcf6] px-2 py-1 text-left text-[10px] font-semibold text-[#1e4a24] hover:bg-[#f0f9ee]"
        aria-expanded={aberto}
      >
        <StickyNote size={11} aria-hidden />
        {notas.length}
        <ChevronDown
          size={12}
          aria-hidden
          className={`shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>
      {aberto ? (
        <ul className="mt-2 space-y-1.5">
          {notas.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-[#eef5ec] bg-white px-2 py-1.5 text-xs leading-snug text-[#0b2210]"
            >
              {n.conteudo}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-[#5d7a67]">{linhaUnica(notas[0].conteudo, 48)}</p>
      )}
    </div>
  );
}
