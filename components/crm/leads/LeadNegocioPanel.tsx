"use client";

import { useEffect, useState } from "react";
import {
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
  CrmSideoverFormPanel,
} from "@/components/crm/CrmSideoverActionGroup";
import {
  MERCADOS_PREFIXO_OPTIONS,
  NEGOCIO_ETAPAS,
} from "@/lib/crm/negocio-cadastro";
import {
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_TEXT_MUTED,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { internalApiHeaders } from "@/lib/internal-api-headers";

const INPUT: React.CSSProperties = { ...RF_INPUT_STYLE, padding: "10px 12px", borderRadius: 10, fontSize: 13 };
const LABEL: React.CSSProperties = { ...RF_LABEL_STYLE, fontWeight: 600, marginBottom: 4 };

const ETAPA_LABEL: Record<string, string> = {
  novo: "Novos",
  qualificando: "Qualificando",
  qualificado: "Qualificado",
  proposta: "Proposta",
  negociando: "Negociando",
  fechamento: "Fechamento",
  ganho: "Ganhos",
  perdido: "Perdidos",
};

type Props = {
  leadId: string;
  leadNome: string;
  leadCodigo?: string | null;
  valorEstimadoLead?: number;
  defaultPrefixo?: string;
  onCancel: () => void;
  onSuccess: (negocioId: string) => void;
};

export function LeadNegocioPanel({
  leadId,
  leadNome,
  leadCodigo,
  valorEstimadoLead = 0,
  defaultPrefixo = "GRL",
  onCancel,
  onSuccess,
}: Props) {
  const [titulo, setTitulo] = useState(`Negócio — ${leadNome}`);
  const [prefixo, setPrefixo] = useState(defaultPrefixo);
  const [etapa, setEtapa] = useState("novo");
  const [valor, setValor] = useState(valorEstimadoLead > 0 ? String(valorEstimadoLead) : "");
  const [dataPrevisao, setDataPrevisao] = useState("");
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setTitulo(`Negócio — ${leadNome}`);
    setPrefixo(defaultPrefixo);
    setEtapa("novo");
    setValor(valorEstimadoLead > 0 ? String(valorEstimadoLead) : "");
    setDataPrevisao("");
    setErro("");
  }, [leadId, leadNome, defaultPrefixo, valorEstimadoLead]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/crm/pipelines?tipo=negocio", {
        headers: internalApiHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json.data) && json.data[0]?.id) {
        setPipelineId(String(json.data[0].id));
      }
    })();
  }, []);

  async function salvar() {
    setErro("");
    if (!titulo.trim()) {
      setErro("Informe o título do negócio.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/crm/negocios", {
        method: "POST",
        credentials: "include",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo.trim(),
          prefixo_mercado: prefixo,
          etapa,
          status: "aberto",
          valor_estimado: valor ? Number(valor) : null,
          data_previsao_fechamento: dataPrevisao || null,
          lead_id: leadId,
          lead_ids: [leadId],
          pipeline_id: pipelineId,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        data?: { id?: string };
      };
      if (!res.ok) {
        const base = json.error || "Não foi possível criar o negócio.";
        const detail = json.detail?.trim();
        setErro(process.env.NODE_ENV === "development" && detail ? `${base} — ${detail}` : base);
        return;
      }
      const negocioId = json.data?.id;
      if (!negocioId) {
        setErro("Negócio criado, mas ID não retornado.");
        return;
      }
      onSuccess(negocioId);
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CrmSideoverFormPanel title="Novo negócio">
        <p className="mb-4 text-xs leading-relaxed" style={{ color: RF_TEXT_MUTED }}>
          Preencha os dados do negócio vinculado ao lead{" "}
          <strong style={{ color: "#92ff00" }}>
            {leadNome}
            {leadCodigo ? ` (#${leadCodigo})` : ""}
          </strong>
          .
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ gridColumn: "1 / -1" }}>
            <span style={LABEL}>Título</span>
            <input
              style={INPUT}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Proposta comercial — Danilo"
            />
          </label>

          <label>
            <span style={LABEL}>Mercado / ramo</span>
            <select style={INPUT} value={prefixo} onChange={(e) => setPrefixo(e.target.value)}>
              {MERCADOS_PREFIXO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={LABEL}>Etapa inicial</span>
            <select style={INPUT} value={etapa} onChange={(e) => setEtapa(e.target.value)}>
              {NEGOCIO_ETAPAS.filter((e) => !["ganho", "perdido"].includes(e)).map((e) => (
                <option key={e} value={e}>
                  {ETAPA_LABEL[e] || e}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={LABEL}>Valor estimado (R$)</span>
            <input
              style={INPUT}
              type="number"
              min={0}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0"
            />
          </label>

          <label>
            <span style={LABEL}>Previsão de fechamento</span>
            <input
              style={INPUT}
              type="date"
              value={dataPrevisao}
              onChange={(e) => setDataPrevisao(e.target.value)}
            />
          </label>
        </div>

        {erro ? (
          <p className="mt-3 text-xs text-[#f85149]" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <CrmSideoverActionGroup>
            <CrmSideoverActionBtn onClick={onCancel} title="Voltar">
              Cancelar
            </CrmSideoverActionBtn>
            <CrmSideoverActionBtn
              onClick={() => void salvar()}
              title="Criar negócio"
              disabled={salvando || !titulo.trim()}
              active
            >
              {salvando ? "Criando…" : "Criar negócio"}
            </CrmSideoverActionBtn>
          </CrmSideoverActionGroup>
        </div>
      </CrmSideoverFormPanel>
    </div>
  );
}
