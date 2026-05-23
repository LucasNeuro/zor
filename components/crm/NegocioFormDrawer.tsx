"use client";

import { useEffect, useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { MERCADOS_PREFIXO_OPTIONS, NEGOCIO_ETAPAS } from "@/lib/crm/negocio-cadastro";

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #30363d",
  background: "#161b22",
  color: "#e6edf3",
  fontSize: 14,
  boxSizing: "border-box",
};

const LABEL: React.CSSProperties = {
  color: "#8b949e",
  fontSize: 12,
  fontWeight: 600,
  display: "block",
  marginBottom: 6,
};

type LeadOpt = { id: string; nome: string; telefone: string | null };
type PessoaOpt = { id: string; nome: string; codigo: string | null };

type FormState = {
  titulo: string;
  prefixo_mercado: string;
  etapa: string;
  valor_estimado: string;
  data_previsao_fechamento: string;
  lead_id: string;
  pessoa_id: string;
};

const emptyForm = (): FormState => ({
  titulo: "",
  prefixo_mercado: "IMB",
  etapa: "briefing",
  valor_estimado: "",
  data_previsao_fechamento: "",
  lead_id: "",
  pessoa_id: "",
});

const ETAPA_LABEL: Record<string, string> = {
  briefing: "Briefing",
  match: "Match",
  "sit-down": "Sit-down",
  concluido: "Concluído",
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function NegocioFormDrawer({ open, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [leads, setLeads] = useState<LeadOpt[]>([]);
  const [pessoas, setPessoas] = useState<PessoaOpt[]>([]);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [carregandoOpts, setCarregandoOpts] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setErro("");
    setLoading(false);
    setCarregandoOpts(true);

    const headers = internalApiHeaders();
    Promise.all([
      fetch("/api/crm/leads?limit=50", { headers }).then((r) => r.json()),
      fetch("/api/crm/pessoas?offset=0", { headers }).then((r) => r.json()),
    ])
      .then(([leadsRes, pessoasRes]) => {
        setLeads((leadsRes.data ?? []) as LeadOpt[]);
        setPessoas((pessoasRes.data ?? []) as PessoaOpt[]);
      })
      .catch(() => {})
      .finally(() => setCarregandoOpts(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function campo<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErro("");
  }

  async function salvar() {
    setErro("");
    setLoading(true);
    try {
      const res = await fetch("/api/crm/negocios", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          titulo: form.titulo,
          prefixo_mercado: form.prefixo_mercado,
          etapa: form.etapa,
          status: "aberto",
          valor_estimado: form.valor_estimado || null,
          data_previsao_fechamento: form.data_previsao_fechamento || null,
          lead_id: form.lead_id || null,
          pessoa_id: form.pessoa_id || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        const base = data.error || "Não foi possível salvar o negócio.";
        const detail = data.detail?.trim();
        setErro(
          process.env.NODE_ENV === "development" && detail
            ? `${base} — ${detail}`
            : base
        );
        return;
      }
      onSaved();
      onClose();
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="negocio-form-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
      }}
    >
      <div
        style={{ flex: 1, background: "rgba(1, 4, 9, 0.72)" }}
        onClick={onClose}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          height: "100%",
          maxHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          background: "#0d1117",
          borderLeft: "1px solid #30363d",
          boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #30363d",
            flexShrink: 0,
          }}
        >
          <h2 id="negocio-form-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e6edf3" }}>
            Novo negócio
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "none",
              color: "#8b949e",
              fontSize: 22,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={LABEL}>Título *</label>
            <input
              value={form.titulo}
              onChange={(e) => campo("titulo", e.target.value)}
              placeholder="Ex.: Reforma apartamento 120m²"
              style={INPUT}
              autoFocus
            />
          </div>

          <div>
            <label style={LABEL}>Mercado *</label>
            <select
              value={form.prefixo_mercado}
              onChange={(e) => campo("prefixo_mercado", e.target.value)}
              style={{ ...INPUT, cursor: "pointer" }}
            >
              {MERCADOS_PREFIXO_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={LABEL}>Etapa inicial</label>
            <select
              value={form.etapa}
              onChange={(e) => campo("etapa", e.target.value)}
              style={{ ...INPUT, cursor: "pointer" }}
            >
              {NEGOCIO_ETAPAS.map((e) => (
                <option key={e} value={e}>
                  {ETAPA_LABEL[e] || e}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={LABEL}>Valor estimado (R$)</label>
            <input
              type="number"
              min={0}
              value={form.valor_estimado}
              onChange={(e) => campo("valor_estimado", e.target.value)}
              placeholder="0"
              style={INPUT}
            />
          </div>

          <div>
            <label style={LABEL}>Previsão de fechamento</label>
            <input
              type="date"
              value={form.data_previsao_fechamento}
              onChange={(e) => campo("data_previsao_fechamento", e.target.value)}
              style={INPUT}
            />
          </div>

          <div>
            <label style={LABEL}>Vincular lead (opcional)</label>
            <select
              value={form.lead_id}
              onChange={(e) => campo("lead_id", e.target.value)}
              disabled={carregandoOpts}
              style={{ ...INPUT, cursor: "pointer" }}
            >
              <option value="">Nenhum</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                  {l.telefone ? ` · ${l.telefone}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={LABEL}>Vincular pessoa (opcional)</label>
            <select
              value={form.pessoa_id}
              onChange={(e) => campo("pessoa_id", e.target.value)}
              disabled={carregandoOpts}
              style={{ ...INPUT, cursor: "pointer" }}
            >
              <option value="">Nenhuma</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.codigo ? ` (${p.codigo})` : ""}
                </option>
              ))}
            </select>
          </div>

          {erro && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{erro}</p>}
        </div>

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid #30363d",
            flexShrink: 0,
            display: "flex",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 10,
              border: "1px solid #30363d",
              background: "transparent",
              color: "#8b949e",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={loading || !form.titulo.trim()}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 10,
              border: "none",
              background: loading ? "#30363d" : "#003b26",
              color: loading ? "#8b949e" : "#c9a24a",
              fontSize: 13,
              fontWeight: 800,
              cursor: loading || !form.titulo.trim() ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Salvando..." : "Salvar negócio"}
          </button>
        </div>
      </div>
    </div>
  );
}
