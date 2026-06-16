"use client";

import { useCallback, useEffect, useState } from "react";
import { BriefcaseBusiness } from "lucide-react";
import {
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
  CrmSideoverFormPanel,
  CrmSideoverToolbarRow,
} from "@/components/crm/CrmSideoverActionGroup";
import {
  crmRetrofitSideoverFooterBtnPrimary,
  CrmRetrofitSideoverShell,
} from "@/components/crm/CrmRetrofitSideoverShell";
import { NEGOCIO_ETAPAS } from "@/lib/crm/negocio-cadastro";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { supabase } from "@/lib/supabase/client";
import { LeadObservacoesTab, type CrmNota } from "@/components/crm/leads/LeadObservacoesTab";
import {
  RF_LIGHT_INPUT_STYLE,
  RF_LIGHT_LABEL_STYLE,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_PRIMARY,
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  type CrmSideoverTheme,
} from "@/lib/crm/crm-retrofit-dark-theme";

const ATIVIDADE_ICON: Record<string, string> = {
  mensagem: "💬",
  status_change: "📍",
  nota: "📝",
  proposta: "📄",
  ia_acao: "🤖",
};

const STATUS_OPTS = [
  { id: "aberto", label: "Aberto" },
  { id: "em_negociacao", label: "Em negociação" },
  { id: "fechado_ganho", label: "Ganho" },
  { id: "fechado_perdido", label: "Perdido" },
  { id: "cancelado", label: "Cancelado" },
];

export type NegocioDetailData = {
  id: string;
  codigo: string;
  titulo: string;
  status: string;
  etapa: string;
  valor_estimado: number | null;
  valor_fechado: number | null;
  data_previsao_fechamento: string | null;
  data_entrada?: string | null;
  data_entrega?: string | null;
  servico_catalogo_id?: string | null;
  servico_nome?: string | null;
  lead_nome?: string | null;
  proxima_acao?: string | null;
  descricao?: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

type EstagioUi = { id: string; label: string; color: string };

type Atividade = {
  id: string;
  tipo: string;
  descricao: string;
  feito_por: string;
  feito_por_tipo: string;
  criado_em: string;
};

type Nota = CrmNota;

type TabId = "dados" | "timeline" | "observacoes";

type Props = {
  open: boolean;
  /** Abre por id — busca dados na API se `negocio` não for passado. */
  negocioId?: string | null;
  negocio?: NegocioDetailData | null;
  etapas?: EstagioUi[];
  onClose: () => void;
  onUpdated?: (negocio: NegocioDetailData) => void;
  initialTab?: TabId;
  theme?: CrmSideoverTheme;
};

function tempo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function moeda(v: number | null | undefined) {
  if (v == null || v <= 0) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(v);
}

function negocioFromApi(
  data: Record<string, unknown>,
  extras?: { servico?: { nome?: string } | null; lead?: { nome?: string } | null }
): NegocioDetailData {
  return {
    id: String(data.id),
    codigo: String(data.codigo ?? ""),
    titulo: String(data.titulo ?? ""),
    status: String(data.status ?? "aberto"),
    etapa: String(data.etapa ?? ""),
    valor_estimado: data.valor_estimado != null ? Number(data.valor_estimado) : null,
    valor_fechado: data.valor_fechado != null ? Number(data.valor_fechado) : null,
    data_previsao_fechamento:
      data.data_previsao_fechamento != null ? String(data.data_previsao_fechamento) : null,
    data_entrada: data.data_entrada != null ? String(data.data_entrada) : null,
    data_entrega: data.data_entrega != null ? String(data.data_entrega) : null,
    servico_catalogo_id:
      data.servico_catalogo_id != null ? String(data.servico_catalogo_id) : null,
    servico_nome: extras?.servico?.nome ?? null,
    lead_nome: extras?.lead?.nome ?? null,
    proxima_acao: data.proxima_acao != null ? String(data.proxima_acao) : null,
    descricao: data.descricao != null ? String(data.descricao) : null,
    criado_em: data.criado_em != null ? String(data.criado_em) : null,
    atualizado_em: data.atualizado_em != null ? String(data.atualizado_em) : null,
  };
}

export function NegocioDetailSideover({
  open,
  negocioId,
  negocio: negocioProp,
  etapas = [],
  onClose,
  onUpdated,
  initialTab = "dados",
  theme = "light",
}: Props) {
  const isLight = theme === "light";
  const INPUT: React.CSSProperties = {
    ...(isLight ? RF_LIGHT_INPUT_STYLE : RF_INPUT_STYLE),
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
  };
  const LABEL: React.CSSProperties = {
    ...(isLight ? RF_LIGHT_LABEL_STYLE : RF_LABEL_STYLE),
    fontWeight: 600,
    marginBottom: 4,
  };
  const textMuted = isLight ? RF_LIGHT_TEXT_MUTED : RF_TEXT_MUTED;
  const textPrimary = isLight ? RF_LIGHT_TEXT_PRIMARY : RF_TEXT_PRIMARY;
  const [tab, setTab] = useState<TabId>(initialTab);
  const [negocioLocal, setNegocioLocal] = useState<NegocioDetailData | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [novaNota, setNovaNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    titulo: "",
    status: "",
    etapa: "",
    valor_estimado: "",
    valor_fechado: "",
    data_previsao_fechamento: "",
    data_entrada: "",
    data_entrega: "",
    proxima_acao: "",
    descricao: "",
  });

  const effectiveId = negocioProp?.id ?? negocioId ?? null;
  const negocio = negocioProp ?? negocioLocal;

  const carregarDetalhe = useCallback(async (id: string) => {
    const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
      headers: internalApiHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(typeof json?.error === "string" ? json.error : "Não foi possível carregar o negócio.");
      return;
    }
    if (json.data) {
      const parsed = negocioFromApi(json.data as Record<string, unknown>, {
        servico: (json.servico as { nome?: string } | null) ?? null,
        lead: (json.lead as { nome?: string } | null) ?? null,
      });
      setNegocioLocal(parsed);
      setForm({
        titulo: parsed.titulo,
        status: parsed.status,
        etapa: parsed.etapa,
        valor_estimado: parsed.valor_estimado != null ? String(parsed.valor_estimado) : "",
        valor_fechado: parsed.valor_fechado != null ? String(parsed.valor_fechado) : "",
        data_previsao_fechamento: parsed.data_previsao_fechamento?.slice(0, 10) ?? "",
        data_entrada: parsed.data_entrada?.slice(0, 10) ?? "",
        data_entrega: parsed.data_entrega?.slice(0, 10) ?? "",
        proxima_acao: parsed.proxima_acao ?? "",
        descricao: parsed.descricao ?? "",
      });
    }
    setAtividades((json.timeline ?? []) as Atividade[]);
    setNotas((json.notas ?? []) as Nota[]);
  }, []);

  useEffect(() => {
    if (!open || !effectiveId) return;
    setTab(initialTab);
    setErro("");

    if (negocioProp) {
      setForm({
        titulo: negocioProp.titulo,
        status: negocioProp.status,
        etapa: negocioProp.etapa,
        valor_estimado: negocioProp.valor_estimado != null ? String(negocioProp.valor_estimado) : "",
        valor_fechado: negocioProp.valor_fechado != null ? String(negocioProp.valor_fechado) : "",
        data_previsao_fechamento: negocioProp.data_previsao_fechamento?.slice(0, 10) ?? "",
        data_entrada: negocioProp.data_entrada?.slice(0, 10) ?? "",
        data_entrega: negocioProp.data_entrega?.slice(0, 10) ?? "",
        proxima_acao: negocioProp.proxima_acao ?? "",
        descricao: negocioProp.descricao ?? "",
      });
      void carregarDetalhe(negocioProp.id);
      return;
    }

    setCarregando(true);
    void carregarDetalhe(effectiveId).finally(() => setCarregando(false));
  }, [open, effectiveId, negocioProp, initialTab, carregarDetalhe]);

  useEffect(() => {
    if (!open) {
      setNegocioLocal(null);
      setAtividades([]);
      setNotas([]);
      setNovaNota("");
      setErro("");
    }
  }, [open]);

  async function patchNegocio(body: Record<string, unknown>) {
    if (!negocio) return false;
    setSalvando(true);
    setErro("");
    const res = await fetch(`/api/crm/negocios/${encodeURIComponent(negocio.id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro(typeof json?.error === "string" ? json.error : "Erro ao salvar");
      return false;
    }
    const data = negocioFromApi((json.data ?? {}) as Record<string, unknown>);
    const merged = { ...negocio, ...data, servico_nome: negocio.servico_nome, lead_nome: negocio.lead_nome };
    setNegocioLocal(merged);
    setForm((f) => ({
      ...f,
      titulo: merged.titulo,
      status: merged.status,
      etapa: merged.etapa,
      valor_estimado: merged.valor_estimado != null ? String(merged.valor_estimado) : "",
      valor_fechado: merged.valor_fechado != null ? String(merged.valor_fechado) : "",
      data_previsao_fechamento: merged.data_previsao_fechamento?.slice(0, 10) ?? "",
      data_entrada: merged.data_entrada?.slice(0, 10) ?? "",
      data_entrega: merged.data_entrega?.slice(0, 10) ?? "",
      proxima_acao: merged.proxima_acao ?? "",
      descricao: merged.descricao ?? "",
    }));
    onUpdated?.(merged);
    void carregarDetalhe(negocio.id);
    return true;
  }

  async function salvarDados() {
    await patchNegocio({
      titulo: form.titulo.trim(),
      status: form.status,
      etapa: form.etapa,
      valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
      valor_fechado: form.valor_fechado ? Number(form.valor_fechado) : null,
      data_previsao_fechamento: form.data_entrega || form.data_previsao_fechamento || null,
      data_entrada: form.data_entrada || null,
      data_entrega: form.data_entrega || null,
      proxima_acao: form.proxima_acao.trim() || null,
      descricao: form.descricao.trim() || null,
    });
  }

  async function moverEtapa(novaEtapa: string) {
    if (!negocio || negocio.etapa === novaEtapa) return;
    setForm((f) => ({ ...f, etapa: novaEtapa }));
    await patchNegocio({ etapa: novaEtapa });
  }

  async function mudarStatus(novoStatus: string) {
    if (!negocio || negocio.status === novoStatus) return;
    setForm((f) => ({ ...f, status: novoStatus }));
    await patchNegocio({ status: novoStatus });
  }

  async function adicionarNota() {
    if (!negocio || !novaNota.trim()) return;
    const { data } = await supabase
      .from("hub_notas")
      .insert({ negocio_id: negocio.id, conteudo: novaNota.trim(), criado_por: "humano" })
      .select()
      .single();
    if (data) {
      setNotas((prev) => [data as Nota, ...prev]);
      await supabase.from("hub_atividades").insert({
        negocio_id: negocio.id,
        tipo: "nota",
        descricao: novaNota.trim().slice(0, 80),
        feito_por: "humano",
        feito_por_tipo: "humano",
      });
      setNovaNota("");
      void carregarDetalhe(negocio.id);
    }
  }

  if (!open || !effectiveId) return null;

  const etapasOpts = etapas.length
    ? etapas
    : NEGOCIO_ETAPAS.map((e) => ({ id: e, label: e, color: "#6b7280" }));

  const valorExibicao = moeda(negocio?.valor_fechado ?? negocio?.valor_estimado);
  const subtitleParts = [
    negocio?.codigo,
    negocio?.servico_nome,
    negocio?.lead_nome ? `Lead: ${negocio.lead_nome}` : null,
    valorExibicao !== "—" ? valorExibicao : null,
  ].filter(Boolean);
  const subtitle = subtitleParts.join(" · ");

  const tabs: { id: TabId; label: string }[] = [
    { id: "dados", label: "Dados" },
    { id: "timeline", label: "Timeline" },
    { id: "observacoes", label: `Observações (${notas.length})` },
  ];

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      theme={theme}
      wide
      kindLabel="NEGÓCIO"
      title={negocio?.titulo ?? (carregando ? "Carregando…" : "Negócio")}
      subtitle={subtitle || undefined}
      icon={BriefcaseBusiness}
      footer={
        tab === "dados"
          ? crmRetrofitSideoverFooterBtnPrimary(
              salvando ? "Salvando…" : "Salvar alterações",
              () => void salvarDados(),
              salvando || carregando || !negocio,
              theme
            )
          : undefined
      }
    >
      {carregando && !negocio ? (
        <p className="text-center text-sm" style={{ color: textMuted }}>
          Carregando negócio…
        </p>
      ) : null}

      {negocio ? (
        <>
          <div className="mb-3 min-w-0 max-w-full overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
            <CrmSideoverToolbarRow>
              <CrmSideoverActionGroup className="min-w-max" theme={theme}>
                {etapasOpts.map((e) => (
                  <CrmSideoverActionBtn
                    key={e.id}
                    active={form.etapa === e.id}
                    onClick={() => void moverEtapa(e.id)}
                    title={`Etapa: ${e.label}`}
                    disabled={salvando}
                    theme={theme}
                  >
                    {e.label}
                  </CrmSideoverActionBtn>
                ))}
              </CrmSideoverActionGroup>

              <CrmSideoverActionGroup className="min-w-max" theme={theme}>
                {STATUS_OPTS.map((s) => (
                  <CrmSideoverActionBtn
                    key={s.id}
                    active={form.status === s.id}
                    onClick={() => void mudarStatus(s.id)}
                    title={`Status: ${s.label}`}
                    disabled={salvando}
                    theme={theme}
                  >
                    {s.label}
                  </CrmSideoverActionBtn>
                ))}
              </CrmSideoverActionGroup>

              <CrmSideoverActionGroup className="min-w-max" theme={theme}>
                {tabs.map((t) => (
                  <CrmSideoverActionBtn
                    key={t.id}
                    active={tab === t.id}
                    onClick={() => setTab(t.id)}
                    title={t.label}
                    theme={theme}
                  >
                    {t.label}
                  </CrmSideoverActionBtn>
                ))}
              </CrmSideoverActionGroup>
            </CrmSideoverToolbarRow>
          </div>

          {erro ? (
            <p className="mb-3 text-xs text-[#f85149]" role="alert">
              {erro}
            </p>
          ) : null}

          {tab === "dados" ? (
            <CrmSideoverFormPanel title="Dados do negócio" theme={theme}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 16 }}>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={LABEL}>Título</span>
                  <input
                    style={INPUT}
                    value={form.titulo}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  />
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
                  <span style={LABEL}>Valor fechado</span>
                  <input
                    style={INPUT}
                    type="number"
                    min={0}
                    value={form.valor_fechado}
                    onChange={(e) => setForm((f) => ({ ...f, valor_fechado: e.target.value }))}
                  />
                </label>
                <label>
                  <span style={LABEL}>Data da entrada</span>
                  <input
                    style={INPUT}
                    type="date"
                    value={form.data_entrada}
                    onChange={(e) => setForm((f) => ({ ...f, data_entrada: e.target.value }))}
                  />
                </label>
                <label>
                  <span style={LABEL}>Data da entrega</span>
                  <input
                    style={INPUT}
                    type="date"
                    value={form.data_entrega}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        data_entrega: e.target.value,
                        data_previsao_fechamento: e.target.value,
                      }))
                    }
                  />
                </label>
                {negocio.servico_nome ? (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={LABEL}>Serviço</span>
                    <p className="m-0 mt-1 text-sm" style={{ color: textPrimary }}>
                      {negocio.servico_nome}
                    </p>
                  </div>
                ) : null}
                <label style={{ gridColumn: "1 / -1" }}>
                  <span style={LABEL}>Previsão fechamento</span>
                  <input
                    style={INPUT}
                    type="date"
                    value={form.data_previsao_fechamento}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, data_previsao_fechamento: e.target.value }))
                    }
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
                  <span style={LABEL}>Descrição</span>
                  <textarea
                    style={{ ...INPUT, resize: "vertical" }}
                    rows={3}
                    value={form.descricao}
                    onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  />
                </label>
              </div>
            </CrmSideoverFormPanel>
          ) : null}

          {tab === "timeline" ? (
            <div>
              {atividades.length === 0 ? (
                <p
                  style={{ color: textMuted, fontSize: 13, textAlign: "center", padding: "24px 0" }}
                >
                  Nenhuma atividade registrada
                </p>
              ) : (
                atividades.map((a, i) => (
                  <div key={a.id} style={{ display: "flex", gap: 12, paddingBottom: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "rgba(18,56,43,0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                        }}
                      >
                        {ATIVIDADE_ICON[a.tipo] || "•"}
                      </div>
                      {i < atividades.length - 1 ? (
                        <div
                          style={{ width: 1, flex: 1, background: "rgba(146,255,0,0.12)", marginTop: 4 }}
                        />
                      ) : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                      <p style={{ margin: 0, fontSize: 13, color: textPrimary, lineHeight: 1.45 }}>
                        {a.descricao}
                      </p>
                      <div
                        style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11, color: textMuted }}
                      >
                        <span>{a.feito_por}</span>
                        <span>·</span>
                        <span>{tempo(a.criado_em)} atrás</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {tab === "observacoes" ? (
            <LeadObservacoesTab
              notas={notas}
              novaNota={novaNota}
              onNovaNotaChange={setNovaNota}
              onAdicionar={adicionarNota}
              theme={theme}
            />
          ) : null}
        </>
      ) : null}
    </CrmRetrofitSideoverShell>
  );
}
