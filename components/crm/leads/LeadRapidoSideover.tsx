"use client";

import { useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { CadastroConhecimentoBanner } from "@/components/crm/cadastro/CadastroConhecimentoBanner";
import { CadastroPremiumSideover } from "@/components/crm/cadastro/CadastroPremiumSideover";
import { LEAD_ORIGENS } from "@/lib/crm/lead-cadastro";
import { labelPipelineTab } from "@/lib/crm/tenant-pipelines";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";

const ORIGEM_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  linkedin: "LinkedIn",
  site: "Site",
  indicacao: "Indicação",
  outro: "Outro",
};

const inputCls =
  "w-full min-h-10 rounded-lg border border-[rgba(63,152,72,0.42)] bg-[rgba(6,13,8,0.85)] px-3 py-2 text-sm text-[#e8f5e9] outline-none placeholder:text-[#7a9a7e] focus:border-[#92ff00]";

const labelCls = "mb-1 block text-xs font-semibold text-[#92ff00]";

const secaoCls = "text-[11px] font-extrabold uppercase tracking-wide text-[#92ff00]";

type LeadCriado = {
  id: string;
  codigo?: string | null;
  nome: string;
};

type PipelineEstagio = {
  slug: string;
  label: string;
  ordem: number;
};

type PipelineOption = {
  id: string;
  nome: string;
  estagios: PipelineEstagio[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (lead: LeadCriado) => void;
  /** Pipeline ativo na página de leads — pré-selecionado no formulário. */
  activePipelineId?: string | null;
};

const formInicial = {
  pipeline_id: "" as string,
  nome: "",
  telefone: "",
  email: "",
  origem: "whatsapp",
  valor_estimado: "",
  notas: "",
  indicado_por: "",
};

function primeiroEstagio(pipe: PipelineOption | null): string {
  if (!pipe?.estagios?.length) return "novo";
  const sorted = [...pipe.estagios].sort((a, b) => a.ordem - b.ordem);
  return sorted[0]?.slug || "novo";
}

export function LeadRapidoSideover({ open, onClose, onSaved, activePipelineId }: Props) {
  const [form, setForm] = useState(formInicial);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [carregandoPipelines, setCarregandoPipelines] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(formInicial);
    setErro("");
    setSalvando(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCarregandoPipelines(true);
    void (async () => {
      try {
        const headers = await crmApiHeaders();
        const res = await fetch("/api/crm/pipelines?tipo=lead", { headers });
        const json = (await res.json().catch(() => ({}))) as { data?: PipelineOption[] };
        if (cancelled) return;
        const list = json.data || [];
        setPipelines(list);
        const preferred =
          (activePipelineId && list.some((p) => p.id === activePipelineId)
            ? activePipelineId
            : list[0]?.id) || "";
        setForm((prev) => ({ ...prev, pipeline_id: preferred }));
      } catch {
        if (!cancelled) setPipelines([]);
      } finally {
        if (!cancelled) setCarregandoPipelines(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activePipelineId]);

  const pipelineSelecionado = useMemo(
    () => pipelines.find((p) => p.id === form.pipeline_id) ?? null,
    [pipelines, form.pipeline_id]
  );

  const estagioInicial = useMemo(() => primeiroEstagio(pipelineSelecionado), [pipelineSelecionado]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function salvar() {
    setErro("");
    const nome = form.nome.trim();
    if (nome.length < 2) {
      setErro("Informe o nome (mín. 2 caracteres).");
      return;
    }

    const telefone = form.telefone.replace(/\D/g, "");
    if (!telefone || telefone.length < 10) {
      setErro("Telefone é obrigatório (DDD + número).");
      return;
    }

    if (form.origem === "indicacao" && !form.indicado_por.trim()) {
      setErro("Informe quem indicou.");
      return;
    }

    if (!form.pipeline_id) {
      setErro("Selecione um pipeline.");
      return;
    }

    setSalvando(true);
    try {
      const notas = form.notas.trim();
      const body: Record<string, unknown> = {
        nome,
        telefone: form.telefone.trim(),
        email: form.email.trim() || null,
        origem: form.origem,
        estagio: estagioInicial,
        valor_estimado: form.valor_estimado.trim() || 0,
        pipeline_id: form.pipeline_id,
        metadata: notas ? { notas, observacoes: notas } : {},
      };
      if (form.origem === "indicacao" && form.indicado_por.trim()) {
        body.indicado_por = form.indicado_por.trim();
      }

      const headers = await crmApiHeaders();
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        data?: LeadCriado;
        error?: string;
        lead_id?: string;
      };

      if (!res.ok) {
        setErro(data.error || "Não foi possível criar o lead.");
        return;
      }

      const criado = data.data;
      if (criado?.id) {
        onSaved?.(criado);
        onClose();
      } else {
        setErro("Lead gravado, mas a resposta veio incompleta.");
      }
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <CadastroPremiumSideover
      open={open}
      onClose={onClose}
      kindLabel="Vendas"
      title="Novo lead"
      subtitle="Cadastro rápido no funil"
      Icon={UserPlus}
      accent="#3B82F6"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="min-h-10 rounded-lg border border-[rgba(63,152,72,0.42)] px-4 py-2 text-sm font-semibold text-[#7a9a7e] hover:text-[#92ff00] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || carregandoPipelines}
            className="min-h-10 rounded-lg px-5 py-2 text-sm font-bold text-[#92ff00] disabled:opacity-50"
            style={{ background: salvando ? "#6e7681" : "#c9a24a" }}
          >
            {salvando ? "Salvando…" : "Criar lead"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <CadastroConhecimentoBanner />
        <p className="text-xs leading-relaxed text-[#5d7a67]">
          Preencha os dados de contacto. O lead entra na primeira etapa do pipeline selecionado e
          gera vínculo com a pessoa pelo telefone.
        </p>

        <section>
          <p className={`${secaoCls} mb-3`}>Pipeline</p>
          {carregandoPipelines ? (
            <p className="text-xs text-[#7a9a7e]">Carregando pipelines…</p>
          ) : pipelines.length === 0 ? (
            <p className="text-xs text-[#fca5a5]">Nenhum pipeline disponível.</p>
          ) : pipelines.length === 1 ? (
            <p className="rounded-lg border border-[rgba(63,152,72,0.42)] bg-[rgba(6,13,8,0.85)] px-3 py-2 text-sm text-[#e8f5e9]">
              {labelPipelineTab(pipelineSelecionado || pipelines[0])}
            </p>
          ) : (
            <select
              value={form.pipeline_id}
              onChange={(e) => set("pipeline_id", e.target.value)}
              className={inputCls}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {labelPipelineTab(p)}
                </option>
              ))}
            </select>
          )}
          {pipelineSelecionado && (
            <p className="mt-2 text-[11px] text-[#7a9a7e]">
              Etapa inicial:{" "}
              <span className="text-[#92ff00]">
                {pipelineSelecionado.estagios.find((e) => e.slug === estagioInicial)?.label ||
                  "Novos"}
              </span>
            </p>
          )}
        </section>

        <section>
          <p className={`${secaoCls} mb-3`}>Contacto</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls} htmlFor="lead-rapido-nome">
                Nome *
              </label>
              <input
                id="lead-rapido-nome"
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                className={inputCls}
                placeholder="Nome do contacto"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="lead-rapido-tel">
                  Telefone *
                </label>
                <input
                  id="lead-rapido-tel"
                  value={form.telefone}
                  onChange={(e) => set("telefone", e.target.value)}
                  className={inputCls}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="lead-rapido-email">
                  E-mail
                </label>
                <input
                  id="lead-rapido-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className={inputCls}
                  placeholder="opcional"
                />
              </div>
            </div>
          </div>
        </section>

        <section>
          <p className={`${secaoCls} mb-3`}>Comercial</p>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="lead-rapido-origem">
                  Origem
                </label>
                <select
                  id="lead-rapido-origem"
                  value={form.origem}
                  onChange={(e) => set("origem", e.target.value)}
                  className={inputCls}
                >
                  {LEAD_ORIGENS.map((o) => (
                    <option key={o} value={o}>
                      {ORIGEM_LABEL[o] || o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="lead-rapido-valor">
                  Valor estimado (R$)
                </label>
                <input
                  id="lead-rapido-valor"
                  value={form.valor_estimado}
                  onChange={(e) => set("valor_estimado", e.target.value)}
                  className={inputCls}
                  placeholder="0"
                  inputMode="decimal"
                />
              </div>
            </div>
            {form.origem === "indicacao" && (
              <div>
                <label className={labelCls} htmlFor="lead-rapido-indicacao">
                  Quem indicou? *
                </label>
                <input
                  id="lead-rapido-indicacao"
                  value={form.indicado_por}
                  onChange={(e) => set("indicado_por", e.target.value)}
                  className={inputCls}
                  placeholder="Nome de quem indicou"
                />
              </div>
            )}
          </div>
        </section>

        <section>
          <p className={`${secaoCls} mb-3`}>Observações</p>
          <textarea
            value={form.notas}
            onChange={(e) => set("notas", e.target.value)}
            className={`${inputCls} min-h-[88px] resize-y`}
            placeholder="Contexto, necessidade, próximos passos…"
            rows={3}
          />
        </section>

        {erro && (
          <p className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#fca5a5]">
            {erro}
          </p>
        )}
      </div>
    </CadastroPremiumSideover>
  );
}
