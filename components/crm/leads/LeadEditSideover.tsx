"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Briefcase, History, MessageSquare, UserRound } from "lucide-react";
import { crmRetrofitPageXClass } from "@/components/crm/CrmRetrofitTablePanel";
import {
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
  CrmSideoverFormPanel,
  CrmSideoverToolbarRow,
} from "@/components/crm/CrmSideoverActionGroup";
import { CadastroTipoBadge } from "@/components/crm/cadastro/CadastroPremiumSideover";
import {
  crmRetrofitSideoverFooterBtnPrimary,
  CrmRetrofitSideoverShell,
} from "@/components/crm/CrmRetrofitSideoverShell";
import { LeadChatTab } from "@/components/crm/leads/LeadChatTab";
import { LeadEmailChatTab } from "@/components/crm/leads/LeadEmailChatTab";
import { LeadNegocioPanel } from "@/components/crm/leads/LeadNegocioPanel";
import { LeadNegociosListPanel } from "@/components/crm/leads/LeadNegociosListPanel";
import { LeadSideoverChatToggle } from "@/components/crm/leads/LeadSideoverChatRail";
import {
  LeadSideoverNavRail,
  type LeadSideoverNavId,
} from "@/components/crm/leads/LeadSideoverNavRail";
import { LeadObservacoesTab, type CrmNota } from "@/components/crm/leads/LeadObservacoesTab";
import { LeadTimelineTab } from "@/components/crm/leads/LeadTimelineTab";
import { LeadStatusTimelineTab } from "@/components/crm/leads/LeadStatusTimelineTab";
import { LEAD_ORIGENS } from "@/lib/crm/lead-cadastro";
import { estagioParaColunaKanban } from "@/lib/crm/estagio-map";
import {
  RF_LIGHT_INPUT_STYLE,
  RF_LIGHT_LABEL_STYLE,
  RF_LIGHT_TEXT_MUTED,
  type CrmSideoverTheme,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import { leadEhCanalEmail, leadEhCanalWhatsapp } from "@/lib/crm/lead-canal";
import { isEmailChannelEnabledClient } from "@/lib/feature-flags";
import type { LeadTimelineEvent } from "@/lib/crm/lead-timeline";

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

const INPUT: React.CSSProperties = {
  ...RF_LIGHT_INPUT_STYLE,
  padding: "10px 12px",
  borderRadius: 10,
  fontSize: 13,
};
const LABEL: React.CSSProperties = { ...RF_LIGHT_LABEL_STYLE, fontWeight: 600, marginBottom: 4 };

const LEAD_SIDEOVER_THEME: CrmSideoverTheme = "light";

export type LeadEditData = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  campanha: string | null;
  estagio: string;
  estagio_funil?: string | null;
  estagio_atendimento?: string | null;
  score: number;
  valor_estimado: number;
  agente_responsavel: string | null;
  humano_responsavel: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  criado_em: string;
  atualizado_em: string;
  codigo?: string | null;
};

type EstagioUi = { id: string; label: string; color: string };

type ScreenId = LeadSideoverNavId | "negocio" | "status_timeline";

type Props = {
  open: boolean;
  lead: LeadEditData | null;
  estagios: EstagioUi[];
  /** Estágios do funil de atendimento (status separado do comercial). */
  estagiosAtendimento?: EstagioUi[];
  isMobile?: boolean;
  onClose: () => void;
  onUpdated?: (lead: LeadEditData) => void;
  onNotasChanged?: () => void;
  onEncaminhado?: (lead: LeadEditData) => void;
  onNegocioCreated?: (lead: LeadEditData, negocioId: string) => void;
  /** Abre sideover de detalhe do negócio (Agent 2). */
  onOpenNegocio?: (negocioId: string) => void;
  initialTab?: LeadSideoverNavId | "chat" | "status_timeline";
  /** Funil comercial (padrão) ou funil de atendimento (estagio_atendimento). */
  context?: "vendas" | "atendimento";
  /** Funil comercial sem chat — só timeline, dados, negócio e histórico. */
  salesTimelineOnly?: boolean;
  /** Ocupa a página em vez de drawer (módulo Atendimentos). */
  fullPage?: boolean;
  fullPageBackHref?: string;
  fullPageBackLabel?: string;
};

export function LeadEditSideover({
  open,
  lead,
  estagios,
  estagiosAtendimento,
  onClose,
  onUpdated,
  onNotasChanged,
  onEncaminhado,
  onNegocioCreated,
  onOpenNegocio,
  initialTab = "timeline",
  context = "vendas",
  salesTimelineOnly = false,
  fullPage = false,
  fullPageBackHref = "/crm/atendimentos",
  fullPageBackLabel = "Atendimentos",
}: Props) {
  const hideChat = salesTimelineOnly;
  const [screen, setScreen] = useState<ScreenId>("timeline");
  const [notas, setNotas] = useState<CrmNota[]>([]);
  const [leadMetadata, setLeadMetadata] = useState<unknown>(null);
  const [timelineEvents, setTimelineEvents] = useState<LeadTimelineEvent[]>([]);
  const [novaNota, setNovaNota] = useState("");
  const [adicionandoNota, setAdicionandoNota] = useState(false);
  const [erroObservacao, setErroObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    email: "",
    origem: "",
    valor_estimado: "",
    score: "",
    agente_responsavel: "",
    humano_responsavel: "",
    proxima_acao: "",
    campanha: "",
  });

  const navActive: LeadSideoverNavId | null =
    screen === "negocio" || screen === "status_timeline" ? null : screen;

  const canalLead = useMemo(() => {
    if (!lead) return { showWhatsapp: true, showEmail: false };
    const input = {
      origem: lead.origem,
      telefone: lead.telefone,
      email: lead.email,
      metadata: leadMetadata,
    };
    return {
      showWhatsapp: leadEhCanalWhatsapp(input),
      showEmail: isEmailChannelEnabledClient() && leadEhCanalEmail(input),
    };
  }, [lead, leadMetadata]);

  useEffect(() => {
    if (hideChat) {
      if (screen === "conversas" || screen === "conversas_email") setScreen("timeline");
      return;
    }
    if (screen === "conversas" && !canalLead.showWhatsapp) {
      setScreen(canalLead.showEmail ? "conversas_email" : "timeline");
    } else if (screen === "conversas_email" && !canalLead.showEmail) {
      setScreen(canalLead.showWhatsapp ? "conversas" : "timeline");
    }
  }, [screen, canalLead.showWhatsapp, canalLead.showEmail, hideChat]);

  const carregarDetalhe = useCallback(async (leadId: string) => {
    const headers = await crmApiHeaders();
    const res = await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`, {
      headers,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;

    setNotas((json.notas ?? []) as CrmNota[]);
    setLeadMetadata(json.data?.metadata ?? null);
    setTimelineEvents((json.timeline_events ?? []) as LeadTimelineEvent[]);
  }, []);

  useEffect(() => {
    if (!open || !lead) return;
    const canalInput = {
      origem: lead.origem,
      telefone: lead.telefone,
      email: lead.email,
      metadata: null,
    };
    const abrirWhatsapp = leadEhCanalWhatsapp(canalInput);
    const abrirEmail = isEmailChannelEnabledClient() && leadEhCanalEmail(canalInput);
    if (hideChat) {
      setScreen(
        initialTab === "status_timeline"
          ? "status_timeline"
          : initialTab === "chat" || initialTab === "conversas" || initialTab === "conversas_email"
            ? "timeline"
            : initialTab
      );
    } else {
      setScreen(
        initialTab === "chat"
          ? abrirWhatsapp
            ? "conversas"
            : abrirEmail
              ? "conversas_email"
              : "timeline"
          : initialTab === "conversas_email"
            ? abrirEmail
              ? "conversas_email"
              : abrirWhatsapp
                ? "conversas"
                : "timeline"
          : initialTab === "status_timeline"
            ? "status_timeline"
            : initialTab
      );
    }
    setErro("");
    setErroObservacao("");
    setNovaNota("");
    setForm({
      nome: lead.nome,
      telefone: lead.telefone ?? "",
      email: lead.email ?? "",
      origem: lead.origem ?? "",
      valor_estimado: lead.valor_estimado > 0 ? String(lead.valor_estimado) : "",
      score: String(lead.score ?? 0),
      agente_responsavel: lead.agente_responsavel ?? "",
      humano_responsavel: lead.humano_responsavel ?? "",
      proxima_acao: lead.proxima_acao ?? "",
      campanha: lead.campanha ?? "",
    });
    void carregarDetalhe(lead.id);
  }, [open, lead, initialTab, carregarDetalhe]);

  async function adicionarNota() {
    if (!lead || !novaNota.trim()) return;
    setAdicionandoNota(true);
    setErroObservacao("");
    const headers = { ...(await crmApiHeaders()), "Content-Type": "application/json" };
    const res = await fetch(`/api/crm/leads/${encodeURIComponent(lead.id)}/notas`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ conteudo: novaNota.trim(), criado_por: "humano" }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: CrmNota;
      error?: string;
    };
    setAdicionandoNota(false);
    if (!res.ok || !json.data) {
      setErroObservacao(
        typeof json.error === "string" ? json.error : "Não foi possível guardar a observação."
      );
      return;
    }
    setNotas((prev) => [json.data as CrmNota, ...prev]);
    setNovaNota("");
    void carregarDetalhe(lead.id);
    onNotasChanged?.();
  }

  async function salvarDados() {
    if (!lead) return;
    setSalvando(true);
    setErro("");
    const body: Record<string, unknown> = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      origem: form.origem || null,
      agente_responsavel: form.agente_responsavel.trim() || null,
      humano_responsavel: form.humano_responsavel.trim() || null,
      proxima_acao: form.proxima_acao.trim() || null,
      score: Number(form.score) || 0,
      valor_estimado: Number(form.valor_estimado) || 0,
    };
    const res = await patchLeadCrm(lead.id, body);
    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    const data = res.data as LeadEditData;
    onUpdated?.({ ...lead, ...data });
  }

  async function moverEstagio(novoEstagio: string) {
    if (!lead) return;
    const patch =
      context === "atendimento"
        ? { estagio_atendimento: novoEstagio }
        : { estagio: novoEstagio, _estagio_anterior: lead.estagio };
    const res = await patchLeadCrm(lead.id, patch);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    const data = res.data as {
      estagio?: string;
      estagio_funil?: string;
      estagio_atendimento?: string;
    };
    if (context === "atendimento") {
      const est = String(data.estagio_atendimento ?? novoEstagio);
      onUpdated?.({ ...lead, estagio_atendimento: est });
    } else {
      const est = String(data.estagio_funil ?? data.estagio ?? novoEstagio);
      onUpdated?.({ ...lead, estagio: est, estagio_funil: est });
    }
    void carregarDetalhe(lead.id);
  }

  function toggleScreen(next: ScreenId) {
    setScreen((prev) => (prev === next ? "timeline" : next));
    setErro("");
  }

  if (!open || !lead) return null;

  const estagioAtual =
    context === "atendimento"
      ? lead.estagio_atendimento || "novo"
      : estagioParaColunaKanban(lead.estagio);
  const subtitleParts = [
    lead.telefone,
    lead.email,
    lead.codigo ? `#${lead.codigo}` : null,
  ].filter(Boolean);

  const headerToolbar = (
    <CrmSideoverToolbarRow>
      <CrmSideoverActionGroup theme={LEAD_SIDEOVER_THEME}>
        {onNegocioCreated ? (
          <CrmSideoverActionBtn
            active={screen === "negocio"}
            onClick={() => toggleScreen("negocio")}
            title="Criar negócio"
            theme={LEAD_SIDEOVER_THEME}
          >
            <Briefcase size={14} />
            Negócio
          </CrmSideoverActionBtn>
        ) : null}
        <CrmSideoverActionBtn
          active={screen === "status_timeline"}
          onClick={() => toggleScreen("status_timeline")}
          title="Histórico de mudanças de status"
          theme={LEAD_SIDEOVER_THEME}
        >
          <History size={14} />
          Histórico
        </CrmSideoverActionBtn>
      </CrmSideoverActionGroup>

      <CrmSideoverActionGroup className="min-w-max" theme={LEAD_SIDEOVER_THEME}>
        {estagios.map((e) => (
          <CrmSideoverActionBtn
            key={e.id}
            active={estagioAtual === e.id}
            onClick={() => void moverEstagio(e.id)}
            title={
              context === "atendimento"
                ? `Atendimento: ${e.label}`
                : `Funil comercial: ${e.label}`
            }
            theme={LEAD_SIDEOVER_THEME}
          >
            {e.label}
          </CrmSideoverActionBtn>
        ))}
      </CrmSideoverActionGroup>

    </CrmSideoverToolbarRow>
  );

  const workspaceBody = (
    <div className="flex min-h-0 min-w-0 flex-1">
      {!salesTimelineOnly ? (
        <LeadSideoverNavRail
          active={navActive}
          onChange={(id) => {
            setScreen(id);
            setErro("");
          }}
          observacoesCount={notas.length}
          showWhatsappTab={!hideChat && canalLead.showWhatsapp}
          showEmailTab={!hideChat && canalLead.showEmail}
          showNegociosTab={context === "atendimento" || Boolean(onNegocioCreated)}
          theme={LEAD_SIDEOVER_THEME}
        />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {erro &&
        screen !== "negocio" &&
        screen !== "status_timeline" &&
        screen !== "negocios" &&
        screen !== "conversas" &&
        screen !== "conversas_email" ? (
          <p className="shrink-0 px-6 pt-4 text-xs text-[#f85149]" role="alert">
            {erro}
          </p>
        ) : null}

        <div
          className={`min-h-0 flex-1 ${
            screen === "conversas" || screen === "conversas_email"
              ? "flex flex-col overflow-hidden px-6 py-4"
              : "overflow-y-auto px-6 py-4"
          }`}
        >
          {screen === "conversas" && !hideChat ? (
            <LeadChatTab
              leadId={lead.id}
              leadNome={lead.nome}
              metadata={leadMetadata}
              humanoResponsavel={lead.humano_responsavel}
              agenteResponsavel={lead.agente_responsavel}
              notasExternas={notas}
              onHumanoResponsavelChange={(valor) => {
                onUpdated?.({ ...lead, humano_responsavel: valor });
              }}
              onMetadataChange={setLeadMetadata}
            />
          ) : null}
          {isEmailChannelEnabledClient() && screen === "conversas_email" && !hideChat ? (
            <LeadEmailChatTab
              leadId={lead.id}
              leadNome={lead.nome}
              leadEmail={lead.email}
              humanoResponsavel={lead.humano_responsavel}
              agenteResponsavel={lead.agente_responsavel}
              onHumanoResponsavelChange={(valor) => {
                onUpdated?.({ ...lead, humano_responsavel: valor });
              }}
            />
          ) : null}

          {screen === "negocio" && onNegocioCreated ? (
            <LeadNegocioPanel
              leadId={lead.id}
              leadNome={lead.nome}
              leadCodigo={lead.codigo}
              valorEstimadoLead={lead.valor_estimado}
              theme={LEAD_SIDEOVER_THEME}
              onCancel={() => setScreen(context === "atendimento" ? "negocios" : "timeline")}
              onSuccess={(negocioId) => {
                setScreen(context === "atendimento" ? "negocios" : "timeline");
                void carregarDetalhe(lead.id);
                onNegocioCreated(lead, negocioId);
              }}
            />
          ) : null}

          {screen === "negocios" ? (
            <LeadNegociosListPanel
              leadId={lead.id}
              theme={LEAD_SIDEOVER_THEME}
              onOpenNegocio={onOpenNegocio}
              onCreateNegocio={onNegocioCreated ? () => setScreen("negocio") : undefined}
            />
          ) : null}

          {screen === "status_timeline" ? (
            <LeadStatusTimelineTab
              leadNome={lead.nome}
              events={timelineEvents}
              theme={LEAD_SIDEOVER_THEME}
              compact
            />
          ) : null}

          {screen === "timeline" ? (
            <LeadTimelineTab
              leadId={lead.id}
              leadNome={lead.nome}
              metadata={leadMetadata}
              theme={LEAD_SIDEOVER_THEME}
              compact
              initialEvents={timelineEvents}
            />
          ) : null}

          {screen === "dados" && !salesTimelineOnly ? (
            <CrmSideoverFormPanel theme={LEAD_SIDEOVER_THEME}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={LABEL}>Nome</span>
                  <input
                    style={INPUT}
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  />
                </label>
                <label>
                  <span style={LABEL}>Telefone</span>
                  <input
                    style={INPUT}
                    value={form.telefone}
                    onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                  />
                </label>
                <label>
                  <span style={LABEL}>E-mail</span>
                  <input
                    style={INPUT}
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </label>
                <label>
                  <span style={LABEL}>Origem</span>
                  <select
                    style={INPUT}
                    value={form.origem}
                    onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value }))}
                  >
                    <option value="">—</option>
                    {LEAD_ORIGENS.map((o) => (
                      <option key={o} value={o}>
                        {ORIGENS_LABEL[o] || o}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={LABEL}>Valor estimado</span>
                  <input
                    style={INPUT}
                    type="number"
                    min={0}
                    value={form.valor_estimado}
                    onChange={(e) => setForm((f) => ({ ...f, valor_estimado: e.target.value }))}
                  />
                </label>
                <label>
                  <span style={LABEL}>Score</span>
                  <input
                    style={INPUT}
                    type="number"
                    min={0}
                    max={100}
                    value={form.score}
                    onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
                  />
                </label>
                <label>
                  <span style={LABEL}>Agente</span>
                  <input
                    style={INPUT}
                    value={form.agente_responsavel}
                    onChange={(e) => setForm((f) => ({ ...f, agente_responsavel: e.target.value }))}
                  />
                </label>
                <label>
                  <span style={LABEL}>Responsável humano</span>
                  <input
                    style={INPUT}
                    value={form.humano_responsavel}
                    onChange={(e) => setForm((f) => ({ ...f, humano_responsavel: e.target.value }))}
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={LABEL}>Próxima ação</span>
                  <input
                    style={INPUT}
                    value={form.proxima_acao}
                    onChange={(e) => setForm((f) => ({ ...f, proxima_acao: e.target.value }))}
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={LABEL}>Campanha</span>
                  <input
                    style={INPUT}
                    value={form.campanha}
                    onChange={(e) => setForm((f) => ({ ...f, campanha: e.target.value }))}
                  />
                </label>
              </div>
              <div
                className="mt-4 flex flex-wrap gap-3 text-xs"
                style={{ color: RF_LIGHT_TEXT_MUTED }}
              >
                <span>Criado: {new Date(lead.criado_em).toLocaleDateString("pt-BR")}</span>
                <span>Atualizado: {new Date(lead.atualizado_em).toLocaleDateString("pt-BR")}</span>
              </div>
            </CrmSideoverFormPanel>
          ) : null}

          {screen === "observacoes" && !salesTimelineOnly ? (
            <>
              {erroObservacao ? (
                <p className="mb-3 text-xs text-[#f85149]" role="alert">
                  {erroObservacao}
                </p>
              ) : null}
              <LeadObservacoesTab
                notas={notas}
                novaNota={novaNota}
                onNovaNotaChange={setNovaNota}
                onAdicionar={adicionarNota}
                adicionando={adicionandoNota}
                theme={LEAD_SIDEOVER_THEME}
              />
              {!hideChat ? (
                <p className="mt-3 text-[11px] leading-relaxed" style={{ color: RF_LIGHT_TEXT_MUTED }}>
                  As observações aparecem no chat como anotações internas — o cliente não as vê nem
                  recebe no WhatsApp.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fcf6]">
        <header
          className={`shrink-0 border-b border-[#dcebd8] bg-white px-4 py-4 sm:px-6 ${crmRetrofitPageXClass}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link
                href={fullPageBackHref}
                className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6b8a76] hover:text-[#166534]"
              >
                <ArrowLeft size={14} />
                {fullPageBackLabel}
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <UserRound size={18} className="text-[#166534]" />
                <h1 className="truncate text-lg font-bold text-[#0b2210]">{lead.nome}</h1>
                {lead.origem ? (
                  <CadastroTipoBadge label={ORIGENS_LABEL[lead.origem] || lead.origem} tone="green" />
                ) : null}
              </div>
              {subtitleParts.length ? (
                <p className="mt-1 text-xs text-[#6b8a76]">{subtitleParts.join(" · ")}</p>
              ) : null}
            </div>
            {!hideChat ? (
              <LeadSideoverChatToggle
                active={screen === "conversas" || screen === "conversas_email"}
                onClick={() => {
                  if (screen === "conversas" || screen === "conversas_email") {
                    setScreen("timeline");
                  } else {
                    setScreen(canalLead.showWhatsapp ? "conversas" : "conversas_email");
                  }
                }}
                theme={LEAD_SIDEOVER_THEME}
              />
            ) : null}
          </div>
          <div className="mt-3">{headerToolbar}</div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">{workspaceBody}</div>
        {screen === "dados"
          ? crmRetrofitSideoverFooterBtnPrimary(
              salvando ? "Salvando…" : "Salvar alterações",
              () => void salvarDados(),
              salvando || !form.nome.trim(),
              LEAD_SIDEOVER_THEME
            )
          : null}
      </div>
    );
  }

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      wide
      theme={LEAD_SIDEOVER_THEME}
      kindLabel={context === "atendimento" ? "Atendimento" : "Vendas"}
      title={lead.nome}
      subtitle={subtitleParts.join(" · ") || undefined}
      icon={UserRound}
      badge={
        lead.origem ? (
          <CadastroTipoBadge label={ORIGENS_LABEL[lead.origem] || lead.origem} tone="green" />
        ) : undefined
      }
      headerExtra={
        hideChat ? (
          salesTimelineOnly ? (
            <Link
              href={`/crm/atendimentos/${encodeURIComponent(lead.id)}?tab=chat`}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[#dcebd8] bg-white px-3 text-[11px] font-bold text-[#15803d] hover:bg-[#f0fdf4]"
            >
              <MessageSquare size={15} />
              Atendimento
            </Link>
          ) : undefined
        ) : (
          <LeadSideoverChatToggle
            active={screen === "conversas" || screen === "conversas_email"}
            onClick={() => {
              if (screen === "conversas" || screen === "conversas_email") {
                setScreen("timeline");
              } else {
                setScreen(canalLead.showWhatsapp ? "conversas" : "conversas_email");
              }
            }}
            theme={LEAD_SIDEOVER_THEME}
          />
        )
      }
      headerToolbar={headerToolbar}
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
      footer={
        screen === "dados"
          ? crmRetrofitSideoverFooterBtnPrimary(
              salvando ? "Salvando…" : "Salvar alterações",
              () => void salvarDados(),
              salvando || !form.nome.trim(),
              LEAD_SIDEOVER_THEME
            )
          : undefined
      }
    >
      {workspaceBody}
    </CrmRetrofitSideoverShell>
  );
}
