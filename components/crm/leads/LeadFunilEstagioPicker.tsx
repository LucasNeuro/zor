"use client";

import {
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
  type CrmSideoverTheme,
} from "@/components/crm/CrmSideoverActionGroup";
import { RF_LIGHT_TEXT_MUTED, RF_TEXT_MUTED } from "@/lib/crm/crm-retrofit-dark-theme";

export type LeadFunilEstagioUi = {
  id: string;
  label: string;
  color?: string;
};

type Props = {
  estagios: LeadFunilEstagioUi[];
  estagioAtual: string;
  onMover: (estagioId: string) => void;
  theme?: CrmSideoverTheme;
  disabled?: boolean;
};

/** Seletor de estágio dentro do resumo / histórico do funil (não no header). */
export function LeadFunilEstagioPicker({
  estagios,
  estagioAtual,
  onMover,
  theme = "light",
  disabled = false,
}: Props) {
  const muted = theme === "light" ? RF_LIGHT_TEXT_MUTED : RF_TEXT_MUTED;

  if (!estagios.length) return null;

  return (
    <div className="mb-4 rounded-xl border border-[#dcebd8] bg-white p-3">
      <p
        className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em]"
        style={{ color: muted }}
      >
        Estágio no funil
      </p>
      <CrmSideoverActionGroup theme={theme} className="max-w-full">
        {estagios.map((e) => (
          <CrmSideoverActionBtn
            key={e.id}
            active={estagioAtual === e.id}
            disabled={disabled}
            onClick={() => onMover(e.id)}
            title={`Mover para ${e.label}`}
            theme={theme}
          >
            {e.label}
          </CrmSideoverActionBtn>
        ))}
      </CrmSideoverActionGroup>
    </div>
  );
}
