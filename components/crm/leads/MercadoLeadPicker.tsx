"use client";

import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { mercadoIcon } from "@/lib/crm/mercado-visual";
import { MERCADOS_PREFIXO_OPTIONS } from "@/lib/crm/negocio-cadastro";

type Props = {
  mercados: string[];
  onToggle: (sigla: string, ativo: boolean) => void;
  disabled?: boolean;
};

/** Mesma matriz de mercados do wizard de cadastro (hub_mercados / MERCADOS_PREFIXO). */
export function MercadoLeadPicker({ mercados, onToggle, disabled }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs leading-relaxed text-[#5d7a67]">
        Escolhe um ou mais segmentos. Se nenhum estiver activo, o lead entra em{" "}
        <strong className="text-[#0b2210]">GRL</strong> (geral / multi-setor).
      </p>
      {MERCADOS_PREFIXO_OPTIONS.map((m) => {
        const sigla = m.value;
        const ativo = mercados.includes(sigla);
        const Icon = mercadoIcon(sigla);
        const labelId = `lead-mercado-${sigla}`;
        return (
          <div
            key={sigla}
            className="flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors"
            style={{
              borderColor: ativo ? "rgba(56, 139, 253, 0.35)" : "#dcebd8",
              background: ativo ? "rgba(56, 139, 253, 0.06)" : "#ffffff",
            }}
          >
            <div
              className="mt-0.5 flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px]"
              style={{
                background: ativo ? "rgba(56, 139, 253, 0.18)" : "#eef7eb",
                color: ativo ? "#79c0ff" : "#5d7a67",
              }}
            >
              <Icon size={21} strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span id={labelId} className="text-[13px] font-bold text-[#0b2210]">
                  {m.label}
                </span>
                <span
                  className="rounded border px-1.5 py-0.5 text-[9px] font-extrabold"
                  style={{
                    color: "#79c0ff",
                    borderColor: "rgba(121, 192, 255, 0.35)",
                  }}
                >
                  {sigla}
                </span>
              </div>
              <span className="mt-1 block text-xs leading-snug text-[#5d7a67]">
                Pipeline {sigla} — visível no funil deste mercado.
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 pt-1">
              <span
                className="text-[10px] font-bold"
                style={{ color: ativo ? "#3fb950" : "#6e7781" }}
              >
                {ativo ? "ACTIVO" : "INACTIVO"}
              </span>
              <CrmToggleSwitch
                checked={ativo}
                onCheckedChange={(v) => onToggle(sigla, v)}
                disabled={disabled}
                labelledBy={labelId}
              />
            </div>
          </div>
        );
      })}
      {mercados.length > 0 && (
        <p className="text-[11px] text-[#c9a24a]">
          Mercados seleccionados: <strong>{mercados.join(", ")}</strong>
        </p>
      )}
    </div>
  );
}
