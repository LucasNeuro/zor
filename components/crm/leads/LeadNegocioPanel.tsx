"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
} from "@/components/crm/CrmSideoverActionGroup";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_LIGHT_BORDER,
  RF_LIGHT_BORDER_STRONG,
  RF_LIGHT_INPUT_STYLE,
  RF_LIGHT_LABEL_STYLE,
  RF_LIGHT_PANEL,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_SECONDARY,
  RF_TEXT_MUTED,
  RF_TEXT_SECONDARY,
  rfInnerPanelStyle,
  type CrmSideoverTheme,
} from "@/lib/crm/crm-retrofit-dark-theme";
import {
  formatarMoedaMascara,
  moedaMascaraParaNumero,
  numeroParaMoedaMascara,
} from "@/lib/crm/moeda-brasil";

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  leadId: string;
  leadNome: string;
  leadCodigo?: string | null;
  valorEstimadoLead?: number;
  theme?: CrmSideoverTheme;
  onCancel: () => void;
  onSuccess: (negocioId: string) => void;
};

export function LeadNegocioPanel({
  leadId,
  leadNome,
  leadCodigo: _leadCodigo,
  valorEstimadoLead = 0,
  theme = "light",
  onCancel,
  onSuccess,
}: Props) {
  const isLight = theme === "light";
  const styles = useMemo(
    () => ({
      input: isLight ? { ...RF_LIGHT_INPUT_STYLE, padding: "10px 12px", borderRadius: 10, fontSize: 13 } : { ...RF_INPUT_STYLE, padding: "10px 12px", borderRadius: 10, fontSize: 13 },
      label: isLight ? { ...RF_LIGHT_LABEL_STYLE, marginBottom: 4 } : { ...RF_LABEL_STYLE, marginBottom: 4 },
      panelBorder: isLight ? RF_LIGHT_BORDER_STRONG : RF_BORDER_STRONG,
      panelBg: isLight ? RF_LIGHT_PANEL : undefined,
      dividerBorder: isLight ? RF_LIGHT_BORDER : RF_BORDER,
      headingColor: isLight ? RF_LIGHT_TEXT_SECONDARY : RF_TEXT_SECONDARY,
      hintColor: isLight ? RF_LIGHT_TEXT_MUTED : RF_TEXT_MUTED,
      iaBtnBg: isLight ? "#f0fdf4" : "rgba(63, 185, 80, 0.12)",
      iaMsgBg: isLight ? "#f8fcf6" : "rgba(6, 13, 8, 0.65)",
    }),
    [isLight]
  );

  const [titulo, setTitulo] = useState(`Negócio — ${leadNome}`);
  const [valor, setValor] = useState(
    valorEstimadoLead > 0 ? numeroParaMoedaMascara(valorEstimadoLead) : ""
  );
  const [dataEntrada, setDataEntrada] = useState(hojeIso());
  const [dataEntrega, setDataEntrega] = useState("");
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [gerandoSugestao, setGerandoSugestao] = useState(false);
  const [sugestaoIaMsg, setSugestaoIaMsg] = useState("");

  useEffect(() => {
    setTitulo(`Negócio — ${leadNome}`);
    setValor(valorEstimadoLead > 0 ? numeroParaMoedaMascara(valorEstimadoLead) : "");
    setDataEntrada(hojeIso());
    setDataEntrega("");
    setErro("");
    setSugestaoIaMsg("");
    setGerandoSugestao(false);
  }, [leadId, leadNome, valorEstimadoLead]);

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

  async function carregarSugestaoIa() {
    setGerandoSugestao(true);
    setSugestaoIaMsg("");
    try {
      const res = await fetch("/api/crm/negocios/sugerir-ia", {
        method: "POST",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: {
          titulo?: string;
          valor_estimado?: number | null;
          data_entrada?: string | null;
          data_entrega?: string | null;
          descricao?: string | null;
          orcamento_na_conversa?: { valor?: number; trecho?: string } | null;
          fontes?: string[];
        };
        error?: string;
      };
      if (!res.ok) {
        setSugestaoIaMsg(json.error || "Não foi possível gerar sugestão com IA.");
        return;
      }
      const s = json.data;
      if (!s) return;

      if (s.titulo?.trim()) setTitulo(s.titulo.trim());
      if (s.valor_estimado != null && Number.isFinite(s.valor_estimado)) {
        setValor(numeroParaMoedaMascara(s.valor_estimado));
      }
      if (s.data_entrada) setDataEntrada(s.data_entrada);
      if (s.data_entrega) setDataEntrega(s.data_entrega);

      const partes: string[] = [];
      if (s.orcamento_na_conversa?.valor != null) {
        partes.push(
          `Orçamento na conversa: R$ ${Number(s.orcamento_na_conversa.valor).toFixed(2)}`
        );
      }
      if (s.descricao?.trim()) partes.push(s.descricao.trim());
      if (s.fontes?.length) partes.push(`Fontes: ${s.fontes.join(", ")}`);

      setSugestaoIaMsg(
        partes.length
          ? partes.join(" · ")
          : "Campos sugeridos com base na conversa, documentos e catálogo — revise antes de criar."
      );
    } catch {
      setSugestaoIaMsg("Erro de rede ao gerar sugestão com IA.");
    } finally {
      setGerandoSugestao(false);
    }
  }

  async function salvar() {
    setErro("");
    if (!titulo.trim()) {
      setErro("Informe o nome do negócio.");
      return;
    }
    const valorNum = moedaMascaraParaNumero(valor);
    if (valorNum != null && (!Number.isFinite(valorNum) || valorNum < 0)) {
      setErro("Valor inválido.");
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
          prefixo_mercado: "GRL",
          etapa: "novo",
          status: "aberto",
          valor_estimado: valorNum,
          data_entrada: dataEntrada || null,
          data_entrega: dataEntrega || null,
          data_previsao_fechamento: dataEntrega || null,
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
        setErro(
          process.env.NODE_ENV === "development" && detail && detail !== base
            ? `${base} — ${detail}`
            : base
        );
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

  const panelStyle = isLight
    ? {
        borderColor: styles.panelBorder,
        background: styles.panelBg,
        boxShadow: "0 1px 3px rgba(11, 34, 16, 0.06)",
      }
    : {
        ...rfInnerPanelStyle(),
        borderColor: styles.panelBorder,
      };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="rounded-xl border" style={panelStyle}>
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
          style={{ borderColor: styles.dividerBorder }}
        >
          <p
            className="m-0 text-[11px] font-bold uppercase tracking-wide"
            style={{ color: styles.headingColor }}
          >
            Novo negócio
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-50"
            style={{
              borderColor: styles.panelBorder,
              color: isLight ? RF_LIGHT_TEXT_SECONDARY : RF_ACCENT,
              background: styles.iaBtnBg,
            }}
            onClick={() => void carregarSugestaoIa()}
            disabled={gerandoSugestao || salvando}
          >
            <Sparkles size={13} />
            {gerandoSugestao ? "Gerando com IA…" : "Preencher com IA"}
          </button>
        </div>

        <div className="p-4">
          {gerandoSugestao ? (
            <p
              className="mb-3 rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: styles.panelBorder,
                background: styles.iaBtnBg,
                color: styles.headingColor,
              }}
            >
              Gerando sugestão com IA…
            </p>
          ) : null}

          {!gerandoSugestao && sugestaoIaMsg ? (
            <p
              className="mb-3 rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: styles.dividerBorder,
                background: styles.iaMsgBg,
                color: styles.hintColor,
              }}
            >
              {sugestaoIaMsg}
            </p>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ gridColumn: "1 / -1" }}>
              <span style={styles.label}>Nome do negócio</span>
              <input
                style={styles.input}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Consultoria técnica — Lucas"
              />
            </label>

            <label>
              <span style={styles.label}>Valor (R$)</span>
              <input
                style={styles.input}
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(formatarMoedaMascara(e.target.value))}
                placeholder="0,00"
              />
            </label>

            <label>
              <span style={styles.label}>Data da entrada</span>
              <input
                style={styles.input}
                type="date"
                value={dataEntrada}
                onChange={(e) => setDataEntrada(e.target.value)}
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              <span style={styles.label}>Data da entrega</span>
              <input
                style={styles.input}
                type="date"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
              />
              <span className="mt-1 block text-[11px]" style={{ color: styles.hintColor }}>
                Usada como previsão de recebimento no financeiro.
              </span>
            </label>
          </div>

          {erro ? (
            <p className="mt-3 text-xs text-[#f85149]" role="alert">
              {erro}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <CrmSideoverActionGroup theme={theme}>
              <CrmSideoverActionBtn onClick={onCancel} title="Voltar" theme={theme}>
                Cancelar
              </CrmSideoverActionBtn>
              <CrmSideoverActionBtn
                onClick={() => void salvar()}
                title="Criar negócio"
                disabled={salvando || !titulo.trim()}
                active
                theme={theme}
              >
                {salvando ? "Criando…" : "Criar negócio"}
              </CrmSideoverActionBtn>
            </CrmSideoverActionGroup>
          </div>
        </div>
      </div>
    </div>
  );
}
