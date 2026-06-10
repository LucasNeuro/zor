"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, UserRound } from "lucide-react";
import {
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
  CrmSideoverToolbarRow,
} from "@/components/crm/CrmSideoverActionGroup";
import { CadastroTipoBadge } from "@/components/crm/cadastro/CadastroPremiumSideover";
import { CrmRetrofitSideoverShell } from "@/components/crm/CrmRetrofitSideoverShell";
import { LeadChatTab } from "@/components/crm/leads/LeadChatTab";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import { RF_TEXT_MUTED } from "@/lib/crm/crm-retrofit-dark-theme";
import { useCrmToast } from "@/lib/crm/crm-feedback";

const ORIGENS_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  linkedin: "LinkedIn",
  site: "Site",
  indicacao: "Indicação",
  outro: "Outro",
};

export type AtendimentoLeadData = {
  id: string;
  nome: string;
  telefone: string | null;
  email?: string | null;
  origem: string | null;
  estagio_atendimento: string;
  agente_responsavel: string | null;
  humano_responsavel: string | null;
  codigo?: string | null;
  _pessoa_codigo?: string | null;
  atualizado_em?: string;
  score?: number;
  valor_estimado?: number;
  criado_em?: string;
  ultima_mensagem_fila?: string | null;
  ultima_mensagem_fila_em?: string | null;
};

type EstagioUi = { id: string; label: string; color: string };

type Props = {
  open: boolean;
  lead: AtendimentoLeadData | null;
  estagios: EstagioUi[];
  isMobile?: boolean;
  onClose: () => void;
  onUpdated?: (lead: AtendimentoLeadData) => void;
};

export function AtendimentoEditSideover({
  open,
  lead,
  estagios,
  onClose,
  onUpdated,
}: Props) {
  const { error: toastError } = useCrmToast();
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (open) setErro("");
  }, [open, lead?.id]);

  async function moverEstagio(novoEstagio: string) {
    if (!lead) return;
    if (lead.estagio_atendimento === novoEstagio) return;
    const res = await patchLeadCrm(lead.id, { estagio_atendimento: novoEstagio });
    if (!res.ok) {
      setErro(res.error);
      toastError(res.error);
      return;
    }
    const data = res.data as { estagio_atendimento?: string };
    onUpdated?.({
      ...lead,
      estagio_atendimento: String(data.estagio_atendimento ?? novoEstagio),
    });
  }

  if (!open || !lead) return null;

  const codigo = lead.codigo || lead._pessoa_codigo;
  const subtitleParts = [lead.telefone, codigo ? `#${codigo}` : null].filter(Boolean);
  const estagioAtual = lead.estagio_atendimento || "novo";

  const headerToolbar = (
    <CrmSideoverToolbarRow>
      <CrmSideoverActionGroup className="min-w-max">
        {estagios.map((e) => (
          <CrmSideoverActionBtn
            key={e.id}
            active={estagioAtual === e.id}
            onClick={() => void moverEstagio(e.id)}
            title={`Mover para ${e.label}`}
          >
            {e.label}
          </CrmSideoverActionBtn>
        ))}
      </CrmSideoverActionGroup>
    </CrmSideoverToolbarRow>
  );

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      wide
      kindLabel="Atendimento"
      title={lead.nome}
      subtitle={subtitleParts.join(" · ") || undefined}
      icon={UserRound}
      badge={
        lead.origem ? (
          <CadastroTipoBadge label={ORIGENS_LABEL[lead.origem] || lead.origem} tone="green" />
        ) : undefined
      }
      headerExtra={
        <MessageSquare size={16} style={{ color: "#c9a24a", marginTop: 2, flexShrink: 0 }} aria-hidden />
      }
      headerToolbar={headerToolbar}
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {erro ? (
          <p className="shrink-0 px-6 pt-4 text-xs text-[#f85149]" role="alert">
            {erro}
          </p>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4">
          <div
            className="mb-3 flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-xs"
            style={{ color: RF_TEXT_MUTED }}
          >
            {lead.agente_responsavel ? <span>Agente: {lead.agente_responsavel}</span> : null}
            {lead.humano_responsavel ? <span>Humano: {lead.humano_responsavel}</span> : null}
            {!lead.humano_responsavel && !lead.agente_responsavel ? (
              <span>Sem responsável definido</span>
            ) : null}
          </div>
          <LeadChatTab
            leadId={lead.id}
            leadNome={lead.nome}
            humanoResponsavel={lead.humano_responsavel}
            agenteResponsavel={lead.agente_responsavel}
            onHumanoResponsavelChange={(valor) => {
              onUpdated?.({ ...lead, humano_responsavel: valor });
            }}
            onAgenteResponsavelChange={(valor) => {
              onUpdated?.({ ...lead, agente_responsavel: valor });
            }}
          />
        </div>
      </div>
    </CrmRetrofitSideoverShell>
  );
}
