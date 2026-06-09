"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Briefcase, UserRound } from "lucide-react";
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
import { LeadEncaminharPanel } from "@/components/crm/leads/LeadEncaminharPanel";
import { LeadChatTab } from "@/components/crm/leads/LeadChatTab";
import { LeadNegocioPanel } from "@/components/crm/leads/LeadNegocioPanel";
import { LeadSideoverChatToggle } from "@/components/crm/leads/LeadSideoverChatRail";
import {
  LeadSideoverNavRail,
  type LeadSideoverNavId,
} from "@/components/crm/leads/LeadSideoverNavRail";
import { LeadObservacoesTab, type CrmNota } from "@/components/crm/leads/LeadObservacoesTab";
import { LeadTimelineTab } from "@/components/crm/leads/LeadTimelineTab";
import { LEAD_ORIGENS } from "@/lib/crm/lead-cadastro";
import { estagioParaColunaKanban } from "@/lib/crm/estagio-map";
import {
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_TEXT_MUTED,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import type { LeadTimelineEvent } from "@/lib/crm/lead-timeline";

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

const INPUT: React.CSSProperties = { ...RF_INPUT_STYLE, padding: "10px 12px", borderRadius: 10, fontSize: 13 };
const LABEL: React.CSSProperties = { ...RF_LABEL_STYLE, fontWeight: 600, marginBottom: 4 };

export type LeadEditData = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  campanha: string | null;
  estagio: string;
  estagio_funil?: string | null;
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

type ScreenId = LeadSideoverNavId | "encaminhar" | "negocio";

type Props = {
  open: boolean;
  lead: LeadEditData | null;
  estagios: EstagioUi[];
  isMobile?: boolean;
  onClose: () => void;
  onUpdated?: (lead: LeadEditData) => void;
  onNotasChanged?: () => void;
  onEncaminhado?: (lead: LeadEditData) => void;
  onNegocioCreated?: (lead: LeadEditData, negocioId: string) => void;
  initialTab?: LeadSideoverNavId | "chat";
};

export function LeadEditSideover({
  open,
  lead,
  estagios,
  onClose,
  onUpdated,
  onNotasChanged,
  onEncaminhado,
  onNegocioCreated,
  initialTab = "timeline",
}: Props) {
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
    screen === "encaminhar" || screen === "negocio" ? null : screen;

  const carregarDetalhe = useCallback(async (leadId: string) => {
    const res = await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`, {
      headers: internalApiHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;

    setNotas((json.notas ?? []) as CrmNota[]);
    setLeadMetadata(json.data?.metadata ?? null);
    setTimelineEvents((json.timeline_events ?? []) as LeadTimelineEvent[]);
  }, []);

  useEffect(() => {
    if (!open || !lead) return;
    setScreen(initialTab === "chat" ? "conversas" : initialTab);
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
    const res = await fetch(`/api/crm/leads/${encodeURIComponent(lead.id)}/notas`, {
      method: "POST",
      credentials: "include",
      headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
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
    const res = await patchLeadCrm(lead.id, {
      estagio: novoEstagio,
      _estagio_anterior: lead.estagio,
    });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    const data = res.data as { estagio?: string; estagio_funil?: string };
    const est = String(data.estagio_funil ?? data.estagio ?? novoEstagio);
    onUpdated?.({ ...lead, estagio: est, estagio_funil: est });
    void carregarDetalhe(lead.id);
  }

  function toggleScreen(next: ScreenId) {
    setScreen((prev) => (prev === next ? "timeline" : next));
    setErro("");
  }

  if (!open || !lead) return null;

  const estagioAtual = estagioParaColunaKanban(lead.estagio);
  const subtitleParts = [
    lead.telefone,
    lead.email,
    lead.codigo ? `#${lead.codigo}` : null,
  ].filter(Boolean);

  const headerToolbar = (
    <CrmSideoverToolbarRow>
      {(onEncaminhado || onNegocioCreated) ? (
        <CrmSideoverActionGroup>
          {onEncaminhado ? (
            <CrmSideoverActionBtn
              active={screen === "encaminhar"}
              onClick={() => toggleScreen("encaminhar")}
              title="Encaminhar lead (funil comercial — parceiro/responsável)"
            >
              <ArrowUpRight size={14} />
              Encaminhar
            </CrmSideoverActionBtn>
          ) : null}
          {onNegocioCreated ? (
            <CrmSideoverActionBtn
              active={screen === "negocio"}
              onClick={() => toggleScreen("negocio")}
              title="Criar negócio"
            >
              <Briefcase size={14} />
              Negócio
            </CrmSideoverActionBtn>
          ) : null}
        </CrmSideoverActionGroup>
      ) : null}

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
      kindLabel="Vendas"
      title={lead.nome}
      subtitle={subtitleParts.join(" · ") || undefined}
      icon={UserRound}
      badge={
        lead.origem ? (
          <CadastroTipoBadge label={ORIGENS_LABEL[lead.origem] || lead.origem} tone="green" />
        ) : undefined
      }
      headerExtra={
        <LeadSideoverChatToggle
          active={screen === "conversas"}
          onClick={() => setScreen((s) => (s === "conversas" ? "timeline" : "conversas"))}
        />
      }
      headerToolbar={headerToolbar}
      bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
      footer={
        screen === "dados"
          ? crmRetrofitSideoverFooterBtnPrimary(
              salvando ? "Salvando…" : "Salvar alterações",
              () => void salvarDados(),
              salvando || !form.nome.trim()
            )
          : undefined
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1">
        <LeadSideoverNavRail
          active={navActive}
          onChange={(id) => {
            setScreen(id);
            setErro("");
          }}
          observacoesCount={notas.length}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {erro && screen !== "negocio" && screen !== "encaminhar" && screen !== "conversas" ? (
            <p className="shrink-0 px-6 pt-4 text-xs text-[#f85149]" role="alert">
              {erro}
            </p>
          ) : null}

          <div
            className={`min-h-0 flex-1 ${
              screen === "conversas"
                ? "flex flex-col overflow-hidden px-6 py-4"
                : "overflow-y-auto px-6 py-4"
            }`}
          >
            {screen === "conversas" ? (
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
                onAgenteResponsavelChange={(valor) => {
                  onUpdated?.({ ...lead, agente_responsavel: valor });
                }}
                onMetadataChange={setLeadMetadata}
              />
            ) : null}

            {screen === "encaminhar" && onEncaminhado ? (
              <LeadEncaminharPanel
                leadId={lead.id}
                leadNome={lead.nome}
                onCancel={() => setScreen("timeline")}
                onSuccess={() => {
                  setScreen("timeline");
                  void carregarDetalhe(lead.id);
                  onEncaminhado(lead);
                }}
              />
            ) : null}

            {screen === "negocio" && onNegocioCreated ? (
              <LeadNegocioPanel
                leadId={lead.id}
                leadNome={lead.nome}
                leadCodigo={lead.codigo}
                valorEstimadoLead={lead.valor_estimado}
                onCancel={() => setScreen("timeline")}
                onSuccess={(negocioId) => {
                  setScreen("timeline");
                  void carregarDetalhe(lead.id);
                  onNegocioCreated(lead, negocioId);
                }}
              />
            ) : null}

            {screen === "timeline" ? (
              <LeadTimelineTab
                leadId={lead.id}
                leadNome={lead.nome}
                metadata={leadMetadata}
                theme="dark"
                compact
                initialEvents={timelineEvents}
              />
            ) : null}

            {screen === "dados" ? (
              <CrmSideoverFormPanel>
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
                  style={{ color: RF_TEXT_MUTED }}
                >
                  <span>Criado: {new Date(lead.criado_em).toLocaleDateString("pt-BR")}</span>
                  <span>Atualizado: {new Date(lead.atualizado_em).toLocaleDateString("pt-BR")}</span>
                </div>
              </CrmSideoverFormPanel>
            ) : null}

            {screen === "observacoes" ? (
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
                  variant="sideover"
                />
                <p className="mt-3 text-[11px] leading-relaxed" style={{ color: RF_TEXT_MUTED }}>
                  As observações aparecem no chat como anotações internas — o cliente não as vê nem
                  recebe no WhatsApp.
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </CrmRetrofitSideoverShell>
  );
}
