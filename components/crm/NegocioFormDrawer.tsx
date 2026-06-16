"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, Sparkles } from "lucide-react";
import {
  CrmSideoverFormPanel,
} from "@/components/crm/CrmSideoverActionGroup";
import {
  crmRetrofitSideoverFooterBtnCancel,
  crmRetrofitSideoverFooterBtnPrimary,
  CrmRetrofitSideoverShell,
} from "@/components/crm/CrmRetrofitSideoverShell";
import { MERCADO_PREFIXO_PADRAO } from "@/lib/crm/negocio-cadastro";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  RF_LIGHT_INPUT_STYLE,
  RF_LIGHT_LABEL_STYLE,
  RF_LIGHT_TEXT_MUTED,
} from "@/lib/crm/crm-retrofit-dark-theme";
import {
  formatarMoedaMascara,
  moedaMascaraParaNumero,
  numeroParaMoedaMascara,
} from "@/lib/crm/moeda-brasil";

const INPUT: React.CSSProperties = {
  ...RF_LIGHT_INPUT_STYLE,
  padding: "10px 12px",
  borderRadius: 10,
  fontSize: 13,
};
const LABEL: React.CSSProperties = { ...RF_LIGHT_LABEL_STYLE, fontWeight: 600, marginBottom: 4 };

type LeadOpt = { id: string; nome: string; telefone: string | null };
type ServicoOpt = { id: string; nome: string; preco_referencia: number | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (negocioId?: string) => void;
  pipelineId?: string | null;
  defaultLeadId?: string | null;
};

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NegocioFormDrawer({
  open,
  onClose,
  onSaved,
  pipelineId = null,
  defaultLeadId = null,
}: Props) {
  const [titulo, setTitulo] = useState("");
  const [valor, setValor] = useState("");
  const [dataEntrada, setDataEntrada] = useState(hojeIso());
  const [dataEntrega, setDataEntrega] = useState("");
  const [leadId, setLeadId] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [leads, setLeads] = useState<LeadOpt[]>([]);
  const [servicos, setServicos] = useState<ServicoOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [gerandoIa, setGerandoIa] = useState(false);
  const [sugestaoMsg, setSugestaoMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitulo("");
    setValor("");
    setDataEntrada(hojeIso());
    setDataEntrega("");
    setLeadId(defaultLeadId ?? "");
    setServicoId("");
    setErro("");
    setSugestaoMsg("");
    setGerandoIa(false);

    void (async () => {
      const [leadsRes, servRes] = await Promise.all([
        fetch("/api/crm/leads?limit=40", { headers: internalApiHeaders() }),
        fetch("/api/crm/servicos-catalogo?sync_if_empty=1", { headers: internalApiHeaders() }),
      ]);
      const leadsJson = await leadsRes.json().catch(() => ({}));
      const servJson = await servRes.json().catch(() => ({}));
      if (leadsRes.ok && Array.isArray(leadsJson.data)) {
        setLeads(
          (leadsJson.data as LeadOpt[]).map((l) => ({
            id: String(l.id),
            nome: String(l.nome ?? ""),
            telefone: l.telefone ?? null,
          }))
        );
      }
      if (servRes.ok && Array.isArray(servJson.data)) {
        setServicos(
          (servJson.data as ServicoOpt[]).map((s) => ({
            id: String(s.id),
            nome: String(s.nome ?? ""),
            preco_referencia:
              s.preco_referencia != null && Number.isFinite(Number(s.preco_referencia))
                ? Number(s.preco_referencia)
                : null,
          }))
        );
      }
    })();
  }, [open, defaultLeadId]);

  function onServicoChange(id: string) {
    setServicoId(id);
    const svc = servicos.find((s) => s.id === id);
    if (svc?.preco_referencia != null && svc.preco_referencia > 0 && !valor.trim()) {
      setValor(numeroParaMoedaMascara(svc.preco_referencia));
    }
    if (svc?.nome && !titulo.trim()) {
      setTitulo(svc.nome);
    }
  }

  async function preencherComIa() {
    if (!leadId) {
      setSugestaoMsg("Selecione um lead para sugerir com base na conversa.");
      return;
    }
    setGerandoIa(true);
    setSugestaoMsg("");
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
          servico_catalogo_id?: string | null;
          descricao?: string | null;
        };
        error?: string;
      };
      if (!res.ok) {
        setSugestaoMsg(json.error || "Não foi possível gerar sugestão.");
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
      if (s.servico_catalogo_id) setServicoId(s.servico_catalogo_id);
      setSugestaoMsg(s.descricao?.trim() || "Sugestão aplicada — revise antes de criar.");
    } catch {
      setSugestaoMsg("Erro de rede ao gerar sugestão.");
    } finally {
      setGerandoIa(false);
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
    setLoading(true);
    try {
      const res = await fetch("/api/crm/negocios", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          titulo: titulo.trim(),
          prefixo_mercado: MERCADO_PREFIXO_PADRAO,
          etapa: "novo",
          status: "aberto",
          valor_estimado: valorNum,
          data_entrada: dataEntrada || null,
          data_entrega: dataEntrega || null,
          data_previsao_fechamento: dataEntrega || null,
          lead_id: leadId || null,
          lead_ids: leadId ? [leadId] : [],
          servico_catalogo_id: servicoId || null,
          pipeline_id: pipelineId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        data?: { id?: string };
      };
      if (!res.ok) {
        const base = data.error || "Não foi possível criar o negócio.";
        const detail = data.detail?.trim();
        setErro(
          process.env.NODE_ENV === "development" && detail && detail !== base
            ? `${base} — ${detail}`
            : base
        );
        return;
      }
      onSaved(data.data?.id);
      onClose();
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      theme="light"
      kindLabel="NEGÓCIO"
      title="Novo negócio"
      subtitle="Cadastro Waje — serviço do catálogo, valores e vínculo com lead."
      icon={BriefcaseBusiness}
      footer={
        <>
          {crmRetrofitSideoverFooterBtnCancel(onClose, loading, "light")}
          {crmRetrofitSideoverFooterBtnPrimary(
            loading ? "Criando…" : "Criar negócio",
            () => void salvar(),
            loading || !titulo.trim(),
            "light"
          )}
        </>
      }
    >
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-50"
          style={{
            borderColor: "rgba(63, 152, 72, 0.42)",
            color: "#b8d4bc",
            background: "rgba(6, 13, 8, 0.72)",
          }}
          onClick={() => void preencherComIa()}
          disabled={gerandoIa || loading}
        >
          <Sparkles size={13} />
          {gerandoIa ? "Gerando com IA…" : "Preencher com IA"}
        </button>
      </div>

      {sugestaoMsg ? (
        <p
          className="mb-4 rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: "rgba(63, 152, 72, 0.28)",
            background: "rgba(11, 31, 16, 0.6)",
            color: RF_LIGHT_TEXT_MUTED,
          }}
        >
          {sugestaoMsg}
        </p>
      ) : null}

      <CrmSideoverFormPanel title="Dados do negócio" theme="light">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 16 }}>
          <label style={{ gridColumn: "1 / -1" }}>
            <span style={LABEL}>Nome do negócio</span>
            <input
              style={INPUT}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Consultoria técnica"
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            <span style={LABEL}>Serviço (catálogo)</span>
            <select
              style={INPUT}
              value={servicoId}
              onChange={(e) => onServicoChange(e.target.value)}
            >
              <option value="">— Selecionar serviço —</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                  {s.preco_referencia != null && s.preco_referencia > 0
                    ? ` · R$ ${s.preco_referencia.toLocaleString("pt-BR")}`
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            <span style={LABEL}>Lead vinculado</span>
            <select style={INPUT} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              <option value="">— Sem lead —</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                  {l.telefone ? ` · ${l.telefone}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={LABEL}>Valor (R$)</span>
            <input
              style={INPUT}
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(formatarMoedaMascara(e.target.value))}
              placeholder="0,00"
            />
          </label>

          <label>
            <span style={LABEL}>Data da entrada</span>
            <input
              style={INPUT}
              type="date"
              value={dataEntrada}
              onChange={(e) => setDataEntrada(e.target.value)}
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            <span style={LABEL}>Data da entrega</span>
            <input
              style={INPUT}
              type="date"
              value={dataEntrega}
              onChange={(e) => setDataEntrega(e.target.value)}
            />
            <span className="mt-1 block text-[11px]" style={{ color: RF_TEXT_MUTED }}>
              Usada como previsão de recebimento no financeiro.
            </span>
          </label>
        </div>
      </CrmSideoverFormPanel>

      {erro ? (
        <p className="mt-3 text-xs text-[#f85149]" role="alert">
          {erro}
        </p>
      ) : null}
    </CrmRetrofitSideoverShell>
  );
}
