"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Briefcase, StickyNote, UserRound, XCircle } from "lucide-react";
import {
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
  CrmSideoverActionScrollRow,
  CrmSideoverFormPanel,
  CrmSideoverInlinePanel,
  CrmSideoverTabGroup,
} from "@/components/crm/CrmSideoverActionGroup";
import {
  crmRetrofitSideoverFooterBtnPrimary,
  CrmRetrofitSideoverShell,
} from "@/components/crm/CrmRetrofitSideoverShell";
import { LeadEncaminharPanel } from "@/components/crm/leads/LeadEncaminharPanel";
import { LeadChatTab } from "@/components/crm/leads/LeadChatTab";
import { LEAD_ORIGENS } from "@/lib/crm/lead-cadastro";
import { estagioParaColunaKanban } from "@/lib/crm/estagio-map";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import { LeadObservacoesTab, type CrmNota } from "@/components/crm/leads/LeadObservacoesTab";
import { MOTIVOS_PERDA, MOTIVOS_PERDA_LABEL } from "@/lib/crm/pipelines";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { supabase } from "@/lib/supabase/client";
import { LeadTimelineTab } from "@/components/crm/leads/LeadTimelineTab";
import type { LeadTimelineEvent } from "@/lib/crm/lead-timeline";
import {
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_TEXT_MUTED,
} from "@/lib/crm/crm-retrofit-dark-theme";

const INPUT: React.CSSProperties = { ...RF_INPUT_STYLE, padding: "10px 12px", borderRadius: 10, fontSize: 13 };
const LABEL: React.CSSProperties = { ...RF_LABEL_STYLE, fontWeight: 600, marginBottom: 4 };

export type LeadDetailData = {
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
  motivo_perda: string | null;
  tags: string[];
  criado_em: string;
  atualizado_em: string;
  codigo?: string | null;
};

type EstagioUi = { id: string; label: string; color: string };

type Nota = CrmNota;

type TabId = "dados" | "timeline" | "chat" | "observacoes";

type Props = {
  open: boolean;
  lead: LeadDetailData | null;
  estagios: EstagioUi[];
  onClose: () => void;
  onUpdated?: (lead: LeadDetailData) => void;
  onEncaminhado?: (lead: LeadDetailData) => void;
  onConverterNegocio?: (lead: LeadDetailData) => void;
  convertendoNegocio?: boolean;
  initialTab?: TabId;
};

function tempo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function moeda(v: number) {
  if (v <= 0) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(v);
}

export function LeadDetailSideover({
  open,
  lead,
  estagios,
  onClose,
  onUpdated,
  onEncaminhado,
  onConverterNegocio,
  convertendoNegocio = false,
  initialTab = "dados",
}: Props) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [painelEncaminhar, setPainelEncaminhar] = useState(false);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [leadMetadata, setLeadMetadata] = useState<unknown>(null);
  const [timelineEvents, setTimelineEvents] = useState<LeadTimelineEvent[]>([]);
  const [novaNota, setNovaNota] = useState("");
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
  const [confirmandoPerda, setConfirmandoPerda] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [motivoPerdaOutro, setMotivoPerdaOutro] = useState("");
  const [perdaComoSpam, setPerdaComoSpam] = useState(false);

  const carregarDetalhe = useCallback(async (leadId: string) => {
    const headers = await crmApiHeaders();
    const res = await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`, {
      headers,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;

    setNotas((json.notas ?? []) as Nota[]);
    setLeadMetadata(json.data?.metadata ?? null);
    setTimelineEvents((json.timeline_events ?? []) as LeadTimelineEvent[]);
  }, []);

  useEffect(() => {
    if (!open || !lead) return;
    setTab(initialTab);
    setPainelEncaminhar(false);
    setErro("");
    setConfirmandoPerda(false);
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
      campanha: form.campanha.trim() || null,
      score: Number(form.score) || 0,
      valor_estimado: Number(form.valor_estimado) || 0,
    };
    const res = await patchLeadCrm(lead.id, body);
    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    const data = res.data as LeadDetailData;
    onUpdated?.({ ...lead, ...data });
  }

  async function moverEstagio(novoEstagio: string, extra?: Record<string, unknown>) {
    if (!lead) return;
    const res = await patchLeadCrm(lead.id, {
      estagio: novoEstagio,
      _estagio_anterior: lead.estagio,
      ...extra,
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

  async function marcarPerdido() {
    const motivo =
      motivoPerda === "outro" ? motivoPerdaOutro.trim() : motivoPerda.trim();
    if (!lead || !motivo) return;
    const estagio = perdaComoSpam ? "spam_invalido" : "perdido";
    await moverEstagio(estagio, { motivo_perda: motivo });
    setConfirmandoPerda(false);
    setMotivoPerda("");
    setPerdaComoSpam(false);
    onClose();
  }

  async function adicionarNota() {
    if (!lead || !novaNota.trim()) return;
    const { data } = await supabase
      .from("hub_notas")
      .insert({ lead_id: lead.id, conteudo: novaNota.trim(), criado_por: "humano" })
      .select()
      .single();
    if (data) {
      setNotas((prev) => [data as Nota, ...prev]);
      await supabase.from("hub_atividades").insert({
        lead_id: lead.id,
        tipo: "nota",
        descricao: novaNota.trim().slice(0, 80),
        feito_por: "humano",
        feito_por_tipo: "humano",
      });
      setNovaNota("");
      void carregarDetalhe(lead.id);
    }
  }

  if (!open || !lead) return null;

  const estagioAtual = estagioParaColunaKanban(lead.estagio);

  const tabs: { id: TabId; label: string }[] = [
    { id: "timeline", label: "Timeline" },
    { id: "chat", label: "Chat" },
    { id: "dados", label: "Dados / Editar" },
    { id: "observacoes", label: `Observações (${notas.length})` },
  ];

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      kindLabel="Vendas"
      title={lead.nome}
      subtitle={[lead.telefone, lead.email].filter(Boolean).join(" · ") || undefined}
      icon={UserRound}
      footer={
        tab === "dados"
          ? crmRetrofitSideoverFooterBtnPrimary(
              salvando ? "Salvando…" : "Salvar alterações",
              () => void salvarDados(),
              salvando
            )
          : undefined
      }
    >
      <CrmSideoverActionScrollRow label="Estágio do funil">
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
      </CrmSideoverActionScrollRow>

      <CrmSideoverActionScrollRow label="Ações">
        <CrmSideoverActionGroup>
          {onEncaminhado ? (
            <CrmSideoverActionBtn
              active={painelEncaminhar}
              onClick={() => {
                setConfirmandoPerda(false);
                setPainelEncaminhar((o) => !o);
              }}
              title="Encaminhar lead"
            >
              <ArrowUpRight size={14} />
              Encaminhar
            </CrmSideoverActionBtn>
          ) : null}
          {onConverterNegocio ? (
            <CrmSideoverActionBtn
              onClick={() => onConverterNegocio(lead)}
              title="Criar negócio"
              disabled={convertendoNegocio}
            >
              <Briefcase size={14} />
              {convertendoNegocio ? "Criando…" : "Negócio"}
            </CrmSideoverActionBtn>
          ) : null}
          <CrmSideoverActionBtn onClick={() => setTab("observacoes")} title="Adicionar nota">
            <StickyNote size={14} />
            Nota
          </CrmSideoverActionBtn>
          <CrmSideoverActionBtn
            variant="danger"
            active={confirmandoPerda}
            onClick={() => {
              setPainelEncaminhar(false);
              setPerdaComoSpam(false);
              setConfirmandoPerda((o) => !o);
            }}
            title="Marcar como perdido"
          >
            <XCircle size={14} />
            Perdido
          </CrmSideoverActionBtn>
        </CrmSideoverActionGroup>
      </CrmSideoverActionScrollRow>

      {painelEncaminhar && onEncaminhado ? (
        <LeadEncaminharPanel
          leadId={lead.id}
          leadNome={lead.nome}
          onCancel={() => setPainelEncaminhar(false)}
          onSuccess={() => {
            setPainelEncaminhar(false);
            void carregarDetalhe(lead.id);
            onEncaminhado(lead);
          }}
        />
      ) : null}

      <CrmSideoverTabGroup tabs={tabs} active={tab} onChange={setTab} />

      {erro ? (
        <p className="mb-3 text-xs text-[#f85149]" role="alert">
          {erro}
        </p>
      ) : null}

      {tab === "dados" ? (
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
                    {o}
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
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              fontSize: 12,
              color: RF_TEXT_MUTED,
            }}
          >
            <span>Valor: {moeda(lead.valor_estimado)}</span>
            <span>Criado: {new Date(lead.criado_em).toLocaleDateString("pt-BR")}</span>
          </div>
        </CrmSideoverFormPanel>
      ) : null}

      {tab === "timeline" ? (
        <LeadTimelineTab
          leadId={lead.id}
          leadNome={lead.nome}
          metadata={leadMetadata}
          theme="dark"
          compact
          initialEvents={timelineEvents}
        />
      ) : null}

      {tab === "chat" ? (
        <LeadChatTab leadId={lead.id} leadNome={lead.nome} metadata={leadMetadata} interactive={false} />
      ) : null}

      {tab === "observacoes" ? (
        <LeadObservacoesTab
          notas={notas}
          novaNota={novaNota}
          onNovaNotaChange={setNovaNota}
          onAdicionar={adicionarNota}
        />
      ) : null}

      {confirmandoPerda ? (
        <CrmSideoverInlinePanel title="Marcar como perdido" tone="danger">
          <p className="mb-3 text-xs" style={{ color: "#fca5a5" }}>
            {perdaComoSpam ? "Motivo (spam/inválido):" : "Motivo da perda (obrigatório):"}
          </p>
          <select
            value={motivoPerda}
            onChange={(e) => setMotivoPerda(e.target.value)}
            style={{ ...INPUT, width: "100%", marginBottom: 8 }}
          >
            <option value="">Selecione…</option>
            {MOTIVOS_PERDA.map((m) => (
              <option key={m} value={m}>
                {MOTIVOS_PERDA_LABEL[m] ?? m}
              </option>
            ))}
          </select>
          {motivoPerda === "outro" ? (
            <input
              value={motivoPerdaOutro}
              onChange={(e) => setMotivoPerdaOutro(e.target.value)}
              placeholder="Descreva o motivo…"
              style={{ ...INPUT, width: "100%", marginBottom: 8 }}
            />
          ) : null}
          <CrmSideoverActionGroup>
            <CrmSideoverActionBtn onClick={() => setConfirmandoPerda(false)} title="Cancelar">
              Cancelar
            </CrmSideoverActionBtn>
            <CrmSideoverActionBtn
              variant="danger"
              active
              onClick={() => void marcarPerdido()}
              title="Confirmar perda"
              disabled={!motivoPerda.trim() || (motivoPerda === "outro" && !motivoPerdaOutro.trim())}
            >
              Confirmar
            </CrmSideoverActionBtn>
          </CrmSideoverActionGroup>
        </CrmSideoverInlinePanel>
      ) : null}
    </CrmRetrofitSideoverShell>
  );
}
