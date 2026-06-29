"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  ExternalLink,
  History,
  StickyNote,
  UserRound,
} from "lucide-react";
import {
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
  CrmSideoverToolbarRow,
} from "@/components/crm/CrmSideoverActionGroup";
import { LeadChatTab } from "@/components/crm/leads/LeadChatTab";
import { LeadEmailChatTab } from "@/components/crm/leads/LeadEmailChatTab";
import { LeadNegocioPanel } from "@/components/crm/leads/LeadNegocioPanel";
import { LeadNegociosListPanel } from "@/components/crm/leads/LeadNegociosListPanel";
import { LeadObservacoesTab, type CrmNota } from "@/components/crm/leads/LeadObservacoesTab";
import { LeadStatusTimelineTab } from "@/components/crm/leads/LeadStatusTimelineTab";
import { LeadTimelineTab } from "@/components/crm/leads/LeadTimelineTab";
import { crmRetrofitPageXClass } from "@/components/crm/CrmRetrofitTablePanel";
import { useCrmToast } from "@/lib/crm/crm-feedback";
import {
  type EstagioAtendimentoUi,
  tempo,
} from "@/lib/crm/atendimento-shared";
import { leadEhCanalEmail, leadEhCanalWhatsapp } from "@/lib/crm/lead-canal";
import type { LeadTimelineEvent } from "@/lib/crm/lead-timeline";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import {
  effectiveHumanoResponsavel,
  formatHumanoDisplayName,
} from "@/lib/crm/resolve-crm-actor";
import { isEmailChannelEnabledClient } from "@/lib/feature-flags";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import type { CrmLeadRow } from "@/hooks/useCrmLeadsQueries";

const ORIGENS_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  linkedin: "LinkedIn",
  site: "Site",
  indicacao: "Indicação",
  outro: "Outro",
};

type PainelAtendimento = "chat" | "negocio" | "negocios" | "historico";

type Props = {
  leadId: string;
  estagios: EstagioAtendimentoUi[];
  initialLead?: CrmLeadRow | null;
  onLeadUpdated?: (lead: CrmLeadRow) => void;
  onNegocioCreated?: (lead: CrmLeadRow, negocioId: string) => void;
  onOpenNegocio?: (negocioId: string) => void;
};

type SidebarTab = "timeline" | "notas";

export function AtendimentoWorkspace360({
  leadId,
  estagios,
  initialLead,
  onLeadUpdated,
  onNegocioCreated,
  onOpenNegocio,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error: toastError } = useCrmToast();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;

  const [lead, setLead] = useState<CrmLeadRow | null>(initialLead ?? null);
  const [loading, setLoading] = useState(!initialLead);
  const [erro, setErro] = useState("");
  const [notas, setNotas] = useState<CrmNota[]>([]);
  const [leadMetadata, setLeadMetadata] = useState<unknown>(null);
  const [timelineEvents, setTimelineEvents] = useState<LeadTimelineEvent[]>([]);
  const [novaNota, setNovaNota] = useState("");
  const [adicionandoNota, setAdicionandoNota] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("timeline");
  const [painel, setPainel] = useState<PainelAtendimento>("chat");

  const canal = useMemo(() => {
    const input = {
      origem: lead?.origem,
      telefone: lead?.telefone,
      email: lead?.email,
      metadata: leadMetadata,
    };
    return {
      whatsapp: leadEhCanalWhatsapp(input),
      email: isEmailChannelEnabledClient() && leadEhCanalEmail(input),
    };
  }, [lead, leadMetadata]);

  const chatTab = searchParams.get("tab");
  const showEmailChat =
    chatTab === "conversas_email" || chatTab === "email"
      ? canal.email
      : chatTab === "chat"
        ? canal.whatsapp
        : canal.whatsapp || !canal.email;

  useEffect(() => {
    if (chatTab === "chat" || chatTab === "conversas_email" || chatTab === "email") {
      setPainel("chat");
    }
    if (chatTab === "historico" || chatTab === "status_timeline") setPainel("historico");
    if (chatTab === "negocios") setPainel("negocios");
  }, [chatTab]);

  const carregarDetalhe = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const headers = await crmApiHeaders();
      const res = await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`, { headers });
      const json = (await res.json().catch(() => ({}))) as {
        data?: CrmLeadRow;
        notas?: CrmNota[];
        timeline_events?: LeadTimelineEvent[];
        error?: string;
      };
      if (!res.ok || !json.data) {
        setErro(json.error || "Lead não encontrado");
        setLead(null);
        return;
      }
      setLead(json.data);
      setNotas(json.notas ?? []);
      setLeadMetadata(json.data.metadata ?? null);
      setTimelineEvents(json.timeline_events ?? []);
    } catch {
      setErro("Erro ao carregar atendimento");
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void carregarDetalhe();
  }, [carregarDetalhe]);

  async function moverEstagio(novoEstagio: string) {
    if (!lead || (lead.estagio_atendimento || "novo") === novoEstagio) return;
    const res = await patchLeadCrm(lead.id, { estagio_atendimento: novoEstagio });
    if (!res.ok) {
      toastError(res.error);
      return;
    }
    const data = res.data as { estagio_atendimento?: string };
    const atualizado = {
      ...lead,
      estagio_atendimento: String(data.estagio_atendimento ?? novoEstagio),
    };
    setLead(atualizado);
    onLeadUpdated?.(atualizado);
  }

  async function adicionarNota() {
    if (!lead || !novaNota.trim()) return;
    setAdicionandoNota(true);
    try {
      const headers = await crmApiHeaders();
      const res = await fetch(`/api/crm/leads/${encodeURIComponent(lead.id)}/notas`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: novaNota.trim(), criado_por: "humano" }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: CrmNota;
        nota?: CrmNota;
        error?: string;
      };
      if (!res.ok) {
        toastError(json.error || "Erro ao guardar observação");
        return;
      }
      const nota = json.data ?? json.nota;
      if (nota) setNotas((prev) => [nota, ...prev]);
      setNovaNota("");
    } finally {
      setAdicionandoNota(false);
    }
  }

  if (loading && !lead) {
    return (
      <p className={`py-12 text-center text-sm text-[#6b8a76] ${crmRetrofitPageXClass}`}>
        A carregar atendimento…
      </p>
    );
  }

  if (erro || !lead) {
    return (
      <div className={`py-12 text-center ${crmRetrofitPageXClass}`}>
        <p className="text-sm text-[#b91c1c]">{erro || "Atendimento não encontrado"}</p>
        <Link
          href="/crm/atendimentos"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#166534]"
        >
          <ArrowLeft size={16} />
          Voltar aos atendimentos
        </Link>
      </div>
    );
  }

  const codigo = lead.codigo || lead._pessoa_codigo;
  const humano = effectiveHumanoResponsavel(lead.humano_responsavel);
  const estagioAtual = lead.estagio_atendimento || "novo";
  const estagioInfo = estagios.find((e) => e.id === estagioAtual);
  const atualizado = lead.ultima_mensagem_fila_em || lead.atualizado_em;
  const origemLabel = lead.origem ? ORIGENS_LABEL[lead.origem] || lead.origem : null;

  const hubspotChat = (
    <div
      className={`flex min-h-0 flex-1 flex-col ${isMobile ? "" : "lg:flex-row"} overflow-hidden`}
    >
      <main
        className={`min-h-0 flex-1 overflow-hidden ${isMobile ? "min-h-[50vh]" : "border-r border-[#dcebd8] lg:min-w-0 lg:flex-[1.45]"}`}
      >
        {showEmailChat && canal.email ? (
          <LeadEmailChatTab
            leadId={lead.id}
            leadNome={lead.nome}
            leadEmail={lead.email}
            humanoResponsavel={lead.humano_responsavel}
            agenteResponsavel={lead.agente_responsavel}
            onHumanoResponsavelChange={(valor) =>
              setLead((prev) => (prev ? { ...prev, humano_responsavel: valor } : prev))
            }
          />
        ) : (
          <div className="flex h-full min-h-0 flex-col px-3 py-2 sm:px-4">
            <LeadChatTab
              leadId={lead.id}
              leadNome={lead.nome}
              metadata={leadMetadata}
              humanoResponsavel={lead.humano_responsavel}
              agenteResponsavel={lead.agente_responsavel}
              notasExternas={notas}
              embedded
              onHumanoResponsavelChange={(valor) =>
                setLead((prev) => (prev ? { ...prev, humano_responsavel: valor } : prev))
              }
              onMetadataChange={setLeadMetadata}
            />
          </div>
        )}
      </main>

      <aside
        className={`flex min-h-0 flex-col overflow-hidden bg-white ${isMobile ? "border-t border-[#dcebd8]" : "w-full lg:w-[340px] lg:shrink-0"}`}
      >
        <div className="shrink-0 border-b border-[#dcebd8] px-3 py-2">
          <div className="mb-2 flex gap-2 text-[11px]">
            <div className="min-w-0 flex-1 rounded-md border border-[#dcebd8] bg-[#f8fcf6] px-2 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#6b8a76]">
                Consultor
              </span>
              <p className="truncate font-semibold text-[#0b2210]">
                {humano ? formatHumanoDisplayName(humano) : "—"}
              </p>
            </div>
            <div className="min-w-0 flex-1 rounded-md border border-[#dcebd8] bg-[#f8fcf6] px-2 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#6b8a76]">
                Agente IA
              </span>
              <p className="truncate font-semibold text-[#0b2210]">
                {lead.agente_responsavel || "—"}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setSidebarTab("timeline")}
              className={`inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold ${
                sidebarTab === "timeline"
                  ? "bg-[#166534] text-white"
                  : "bg-[#f8fcf6] text-[#374151]"
              }`}
            >
              <History size={13} />
              Timeline
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("notas")}
              className={`inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold ${
                sidebarTab === "notas"
                  ? "bg-[#166534] text-white"
                  : "bg-[#f8fcf6] text-[#374151]"
              }`}
            >
              <StickyNote size={13} />
              Notas
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {sidebarTab === "timeline" ? (
            <LeadTimelineTab
              leadId={lead.id}
              leadNome={lead.nome}
              metadata={leadMetadata}
              theme="light"
              compact
              initialEvents={timelineEvents}
            />
          ) : (
            <LeadObservacoesTab
              notas={notas}
              novaNota={novaNota}
              onNovaNotaChange={setNovaNota}
              onAdicionar={() => void adicionarNota()}
              adicionando={adicionandoNota}
              theme="light"
            />
          )}
        </div>
      </aside>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fcf6]">
      <header
        className={`shrink-0 border-b border-[#dcebd8] bg-white px-3 py-2 sm:px-4 ${crmRetrofitPageXClass}`}
      >
        <button
          type="button"
          onClick={() => router.push("/crm/atendimentos")}
          className="mb-1.5 inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[11px] font-semibold text-[#6b8a76] hover:text-[#166534]"
        >
          <ArrowLeft size={13} />
          Atendimentos
        </button>

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <UserRound size={16} className="shrink-0 text-[#166534]" />
            <h1 className="truncate text-base font-bold text-[#0b2210]">{lead.nome}</h1>
            {origemLabel ? (
              <span
                className="shrink-0 rounded-full border border-[#fdba74] bg-[#fff7ed] px-2 py-0.5 text-[10px] font-bold text-[#c2410c]"
              >
                {origemLabel}
              </span>
            ) : null}
            {estagioInfo ? (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                style={{ background: estagioInfo.color }}
              >
                {estagioInfo.label}
              </span>
            ) : null}
            <span className="hidden truncate text-[11px] text-[#6b8a76] sm:inline">
              {[lead.telefone, codigo ? `#${codigo}` : null, tempo(atualizado)]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <CrmSideoverToolbarRow>
              <CrmSideoverActionGroup className="min-w-max" theme="light">
                {onNegocioCreated ? (
                  <CrmSideoverActionBtn
                    active={painel === "negocio" || painel === "negocios"}
                    onClick={() => setPainel((p) => (p === "negocios" ? "chat" : "negocios"))}
                    title="Negócios do lead"
                    theme="light"
                  >
                    <Briefcase size={14} />
                    Negócio
                  </CrmSideoverActionBtn>
                ) : null}
                <CrmSideoverActionBtn
                  active={painel === "historico"}
                  onClick={() => setPainel((p) => (p === "historico" ? "chat" : "historico"))}
                  title="Histórico de mudanças de status"
                  theme="light"
                >
                  <History size={14} />
                  Histórico
                </CrmSideoverActionBtn>
              </CrmSideoverActionGroup>
              <CrmSideoverActionGroup className="min-w-max" theme="light">
                {estagios.map((e) => (
                  <CrmSideoverActionBtn
                    key={e.id}
                    active={estagioAtual === e.id}
                    onClick={() => void moverEstagio(e.id)}
                    title={`Mover para ${e.label}`}
                    theme="light"
                  >
                    {e.label}
                  </CrmSideoverActionBtn>
                ))}
              </CrmSideoverActionGroup>
            </CrmSideoverToolbarRow>
            <Link
              href={`/crm/leads?lead=${encodeURIComponent(lead.id)}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dcebd8] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#374151] hover:bg-[#f8fcf6]"
            >
              <Briefcase size={13} />
              Ver no funil
              <ExternalLink size={11} className="opacity-60" />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {painel === "chat" ? hubspotChat : null}

        {painel === "historico" ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-white p-6">
            <LeadStatusTimelineTab
              leadNome={lead.nome}
              events={timelineEvents}
              theme="light"
              compact
            />
          </div>
        ) : null}

        {painel === "negocios" ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-white p-6">
            <LeadNegociosListPanel
              leadId={lead.id}
              theme="light"
              onOpenNegocio={onOpenNegocio}
              onCreateNegocio={onNegocioCreated ? () => setPainel("negocio") : undefined}
            />
          </div>
        ) : null}

        {painel === "negocio" && onNegocioCreated ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-white p-6">
            <LeadNegocioPanel
              leadId={lead.id}
              leadNome={lead.nome}
              leadCodigo={lead.codigo}
              valorEstimadoLead={lead.valor_estimado}
              theme="light"
              onCancel={() => setPainel("negocios")}
              onSuccess={(negocioId) => {
                setPainel("negocios");
                void carregarDetalhe();
                onNegocioCreated(lead, negocioId);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
