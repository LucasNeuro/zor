"use client";

import { useCallback, useEffect, useState } from "react";
import { BriefcaseBusiness } from "lucide-react";
import {
  CadastroPremiumSideover,
  CadastroSideoverPanel,
} from "@/components/crm/cadastro/CadastroPremiumSideover";
import { NEGOCIO_ETAPAS } from "@/lib/crm/negocio-cadastro";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { supabase } from "@/lib/supabase/client";
import { LeadObservacoesTab, type CrmNota } from "@/components/crm/leads/LeadObservacoesTab";
import {
  RF_ACCENT,
  RF_BORDER_STRONG,
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

const INPUT: React.CSSProperties = { ...RF_INPUT_STYLE, padding: "10px 12px", borderRadius: 10, fontSize: 13 };
const LABEL: React.CSSProperties = { ...RF_LABEL_STYLE, fontWeight: 600, marginBottom: 4 };

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
  prefixo_mercado: string;
  status: string;
  etapa: string;
  valor_estimado: number | null;
  valor_fechado: number | null;
  data_previsao_fechamento: string | null;
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
  negocio: NegocioDetailData | null;
  etapas: EstagioUi[];
  onClose: () => void;
  onUpdated?: (negocio: NegocioDetailData) => void;
  initialTab?: TabId;
};

function tempo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

export function NegocioDetailSideover({
  open,
  negocio,
  etapas,
  onClose,
  onUpdated,
  initialTab = "dados",
}: Props) {
  const [tab, setTab] = useState<TabId>(initialTab);
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
    proxima_acao: "",
    descricao: "",
  });

  const carregarDetalhe = useCallback(async (negocioId: string) => {
    const res = await fetch(`/api/crm/negocios/${encodeURIComponent(negocioId)}`, {
      headers: internalApiHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setAtividades((json.timeline ?? []) as Atividade[]);
    setNotas((json.notas ?? []) as Nota[]);
  }, []);

  useEffect(() => {
    if (!open || !negocio) return;
    setTab(initialTab);
    setErro("");
    setForm({
      titulo: negocio.titulo,
      status: negocio.status,
      etapa: negocio.etapa,
      valor_estimado: negocio.valor_estimado != null ? String(negocio.valor_estimado) : "",
      valor_fechado: negocio.valor_fechado != null ? String(negocio.valor_fechado) : "",
      data_previsao_fechamento: negocio.data_previsao_fechamento?.slice(0, 10) ?? "",
      proxima_acao: negocio.proxima_acao ?? "",
      descricao: negocio.descricao ?? "",
    });
    void carregarDetalhe(negocio.id);
  }, [open, negocio, initialTab, carregarDetalhe]);

  async function salvarDados() {
    if (!negocio) return;
    setSalvando(true);
    setErro("");
    const body: Record<string, unknown> = {
      titulo: form.titulo.trim(),
      status: form.status,
      etapa: form.etapa,
      valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
      valor_fechado: form.valor_fechado ? Number(form.valor_fechado) : null,
      data_previsao_fechamento: form.data_previsao_fechamento || null,
      proxima_acao: form.proxima_acao.trim() || null,
      descricao: form.descricao.trim() || null,
    };
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
      return;
    }
    const data = json.data as NegocioDetailData;
    onUpdated?.({ ...negocio, ...data });
    void carregarDetalhe(negocio.id);
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

  if (!open || !negocio) return null;

  const etapasOpts = etapas.length
    ? etapas
    : NEGOCIO_ETAPAS.map((e) => ({ id: e, label: e, color: "#6b7280" }));

  const tabs: { id: TabId; label: string }[] = [
    { id: "dados", label: "Dados / Editar" },
    { id: "timeline", label: "Timeline" },
    { id: "observacoes", label: `Observações (${notas.length})` },
  ];

  return (
    <CadastroPremiumSideover
      open={open}
      onClose={onClose}
      kindLabel="NEGÓCIO"
      title={negocio.titulo}
      subtitle={negocio.codigo}
      Icon={BriefcaseBusiness}
      footer={
        tab === "dados" ? (
          <button
            type="button"
            onClick={() => void salvarDados()}
            disabled={salvando}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: RF_ACCENT,
              color: "#0b1f10",
              fontWeight: 800,
              fontSize: 13,
              cursor: salvando ? "wait" : "pointer",
              opacity: salvando ? 0.6 : 1,
            }}
          >
            {salvando ? "Salvando…" : "Salvar alterações"}
          </button>
        ) : undefined
      }
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {etapasOpts.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setForm((f) => ({ ...f, etapa: e.id }))}
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 999,
              border: `1px solid ${form.etapa === e.id ? e.color : `${e.color}55`}`,
              background: form.etapa === e.id ? e.color : `${e.color}18`,
              color: form.etapa === e.id ? "#fff" : e.color,
              cursor: "pointer",
            }}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${RF_BORDER_STRONG}`,
          marginBottom: 16,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "10px 4px",
              fontSize: 11,
              fontWeight: 700,
              border: "none",
              background: "transparent",
              color: tab === t.id ? RF_ACCENT : RF_TEXT_MUTED,
              borderBottom: tab === t.id ? `2px solid ${RF_ACCENT}` : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {erro ? (
        <p style={{ color: "#f85149", fontSize: 12, marginBottom: 12 }}>{erro}</p>
      ) : null}

      {tab === "dados" ? (
        <CadastroSideoverPanel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ gridColumn: "1 / -1" }}>
              <span style={LABEL}>Título</span>
              <input
                style={INPUT}
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              />
            </label>
            <label>
              <span style={LABEL}>Status</span>
              <select
                style={INPUT}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {STATUS_OPTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={LABEL}>Etapa</span>
              <select
                style={INPUT}
                value={form.etapa}
                onChange={(e) => setForm((f) => ({ ...f, etapa: e.target.value }))}
              >
                {etapasOpts.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
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
              <span style={LABEL}>Valor fechado</span>
              <input
                style={INPUT}
                type="number"
                min={0}
                value={form.valor_fechado}
                onChange={(e) => setForm((f) => ({ ...f, valor_fechado: e.target.value }))}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <span style={LABEL}>Previsão fechamento</span>
              <input
                style={INPUT}
                type="date"
                value={form.data_previsao_fechamento}
                onChange={(e) => setForm((f) => ({ ...f, data_previsao_fechamento: e.target.value }))}
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
        </CadastroSideoverPanel>
      ) : null}

      {tab === "timeline" ? (
        <div>
          {atividades.length === 0 ? (
            <p style={{ color: RF_TEXT_MUTED, fontSize: 13, textAlign: "center", padding: "24px 0" }}>
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
                    <div style={{ width: 1, flex: 1, background: "rgba(146,255,0,0.12)", marginTop: 4 }} />
                  ) : null}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                  <p style={{ margin: 0, fontSize: 13, color: RF_TEXT_PRIMARY, lineHeight: 1.45 }}>
                    {a.descricao}
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11, color: RF_TEXT_MUTED }}>
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
        />
      ) : null}
    </CadastroPremiumSideover>
  );
}
