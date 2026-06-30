"use client";

import { Briefcase, Plus } from "lucide-react";
import {
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
  type CrmSideoverTheme,
} from "@/components/crm/CrmSideoverActionGroup";

type Props = {
  theme?: CrmSideoverTheme;
  listaActive?: boolean;
  criarActive?: boolean;
  onVerNegocios: () => void;
  onNovoNegocio: () => void;
};

/** Ações de negócios no header do funil / atendimento — lista + criar outro negócio. */
export function LeadNegocioToolbarBtns({
  theme = "light",
  listaActive = false,
  criarActive = false,
  onVerNegocios,
  onNovoNegocio,
}: Props) {
  return (
    <CrmSideoverActionGroup theme={theme}>
      <CrmSideoverActionBtn
        active={listaActive}
        onClick={onVerNegocios}
        title="Ver negócios deste lead"
        theme={theme}
      >
        <Briefcase size={14} />
        Negócios
      </CrmSideoverActionBtn>
      <CrmSideoverActionBtn
        active={criarActive}
        onClick={onNovoNegocio}
        title="Criar novo negócio para este cliente"
        theme={theme}
      >
        <Plus size={14} />
        Novo negócio
      </CrmSideoverActionBtn>
    </CrmSideoverActionGroup>
  );
}
