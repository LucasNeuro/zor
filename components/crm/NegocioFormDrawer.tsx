"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import {
  CadastroPremiumSideover,
  CadastroSideoverPanel,
  CadastroTipoBadge,
} from "@/components/crm/cadastro/CadastroPremiumSideover";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  labelMercadoPrefixo,
  MERCADOS_PREFIXO_OPTIONS,
  NEGOCIO_ETAPAS,
} from "@/lib/crm/negocio-cadastro";

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

const HINT: React.CSSProperties = {
  margin: 0,
  color: "#8b949e",
  fontSize: 11,
  lineHeight: 1.5,
};

type LeadOpt = { id: string; nome: string; telefone: string | null };
type PessoaOpt = { id: string; nome: string; codigo: string | null };
type EmpresaOpt = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  codigo: string | null;
};
type ParceiroOpt = {
  id: string;
  nome: string;
  codigo: string | null;
  telefone: string | null;
};

type FormState = {
  titulo: string;
  prefixo_mercado: string;
  etapa: string;
  valor_estimado: string;
  data_previsao_fechamento: string;
  lead_ids: string[];
  pessoa_ids: string[];
  empresa_ids: string[];
  parceiro_ids: string[];
};

type PickerState = {
  lead_id: string;
  pessoa_id: string;
  empresa_id: string;
  parceiro_id: string;
};

type WizardStepId = "essenciais" | "envolvidos" | "comercial" | "copiloto";

type ChatMsg = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

const emptyForm = (): FormState => ({
  titulo: "",
  prefixo_mercado: "IMB",
  etapa: "novo",
  valor_estimado: "",
  data_previsao_fechamento: "",
  lead_ids: [],
  pessoa_ids: [],
  empresa_ids: [],
  parceiro_ids: [],
});

const emptyPicker = (): PickerState => ({
  lead_id: "",
  pessoa_id: "",
  empresa_id: "",
  parceiro_id: "",
});

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

const WIZARD_STEPS: Array<{ id: WizardStepId; short: string; label: string; optional?: boolean }> = [
  { id: "essenciais", short: "01", label: "Essenciais" },
  { id: "envolvidos", short: "02", label: "Envolvidos" },
  { id: "comercial", short: "03", label: "Comercial" },
  { id: "copiloto", short: "IA", label: "Copiloto IA", optional: true },
];

const QUICK_PROMPTS = [
  "O que está faltando neste negócio?",
  "Sugira um título melhor para este negócio.",
  "Quais envolvidos devo vincular para ter rastreio completo?",
  "Revise este draft e diga o próximo melhor passo.",
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  pipelineId?: string | null;
  defaultMercado?: string | null;
};

function metricCard(label: string, value: string, color: string) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid #2c384b",
        background: "#161b22",
        padding: 10,
      }}
    >
      <p style={{ ...LABEL, marginBottom: 4 }}>{label}</p>
      <p style={{ margin: 0, color, fontSize: 13, fontWeight: 800 }}>{value}</p>
    </div>
  );
}

export function NegocioFormDrawer({ open, onClose, onSaved, pipelineId, defaultMercado }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [picker, setPicker] = useState<PickerState>(emptyPicker);
  const [leads, setLeads] = useState<LeadOpt[]>([]);
  const [pessoas, setPessoas] = useState<PessoaOpt[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);
  const [parceiros, setParceiros] = useState<ParceiroOpt[]>([]);
  const [step, setStep] = useState<WizardStepId>("essenciais");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatErro, setChatErro] = useState("");
  const [catalogoErro, setCatalogoErro] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [carregandoOpts, setCarregandoOpts] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...emptyForm(),
      prefixo_mercado: defaultMercado || prev.prefixo_mercado || "IMB",
    }));
    setPicker(emptyPicker());
    setStep("essenciais");
    setErro("");
    setChatErro("");
    setCatalogoErro("");
    setLoading(false);
    setChatLoading(false);
    setChatInput("");
    setChatMessages([
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content:
          "Sou o copiloto opcional do wizard de negócios. Posso revisar o draft, sugerir título, apontar lacunas e orientar quais envolvidos vincular para garantir rastreio completo, mas você pode criar o negócio sem usar esta ajuda.",
      },
    ]);
    setCarregandoOpts(true);

    const headers = internalApiHeaders();
    const fetchJson = async (url: string, label: string) => {
      const res = await fetch(url, { headers });
      const data = (await res.json().catch(() => ({}))) as {
        data?: unknown;
        error?: string;
        erro?: string;
        parceiros?: unknown;
      };
      if (!res.ok) {
        throw new Error(data.error || data.erro || `Erro ao carregar ${label}.`);
      }
      return data;
    };

    Promise.allSettled([
      fetchJson("/api/crm/leads?limit=100", "leads"),
      fetchJson("/api/crm/pessoas?offset=0&limit=100", "pessoas"),
      fetchJson("/api/crm/empresas?offset=0&limit=100", "empresas"),
      fetchJson("/api/parceiros", "parceiros"),
    ])
      .then(([leadsRes, pessoasRes, empresasRes, parceirosRes]) => {
        setLeads(
          leadsRes.status === "fulfilled" ? ((leadsRes.value.data ?? []) as LeadOpt[]) : []
        );
        setPessoas(
          pessoasRes.status === "fulfilled" ? ((pessoasRes.value.data ?? []) as PessoaOpt[]) : []
        );
        setEmpresas(
          empresasRes.status === "fulfilled" ? ((empresasRes.value.data ?? []) as EmpresaOpt[]) : []
        );
        setParceiros(
          parceirosRes.status === "fulfilled"
            ? ((parceirosRes.value.parceiros ?? []) as ParceiroOpt[])
            : []
        );

        const falhas = [leadsRes, pessoasRes, empresasRes, parceirosRes]
          .filter((result): result is PromiseRejectedResult => result.status === "rejected")
          .map((result) => result.reason)
          .map((reason) => (reason instanceof Error ? reason.message : String(reason)))
          .filter(Boolean);
        setCatalogoErro(falhas.join(" | "));
      })
      .finally(() => setCarregandoOpts(false));
  }, [open, defaultMercado]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  function campo<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErro("");
  }

  function campoPicker<K extends keyof PickerState>(key: K, value: PickerState[K]) {
    setPicker((prev) => ({ ...prev, [key]: value }));
    setErro("");
  }

  function adicionarVinculo(
    key: "lead_ids" | "pessoa_ids" | "empresa_ids" | "parceiro_ids",
    pickerKey: keyof PickerState
  ) {
    const selected = picker[pickerKey];
    if (!selected) return;
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(selected) ? prev[key] : [...prev[key], selected],
    }));
    setPicker((prev) => ({ ...prev, [pickerKey]: "" }));
    setErro("");
  }

  function removerVinculo(
    key: "lead_ids" | "pessoa_ids" | "empresa_ids" | "parceiro_ids",
    id: string
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((item) => item !== id),
    }));
  }

  function labelLead(id: string) {
    const item = leads.find((lead) => lead.id === id);
    return item ? `${item.nome}${item.telefone ? ` · ${item.telefone}` : ""}` : id;
  }

  function labelPessoa(id: string) {
    const item = pessoas.find((pessoa) => pessoa.id === id);
    return item ? `${item.nome}${item.codigo ? ` (${item.codigo})` : ""}` : id;
  }

  function labelEmpresa(id: string) {
    const item = empresas.find((empresa) => empresa.id === id);
    if (!item) return id;
    const nome = item.nome_fantasia || item.razao_social;
    return `${nome}${item.codigo ? ` (${item.codigo})` : ""}`;
  }

  function labelParceiro(id: string) {
    const item = parceiros.find((parceiro) => parceiro.id === id);
    return item ? `${item.nome}${item.codigo ? ` (${item.codigo})` : ""}` : id;
  }

  const stepIndex = WIZARD_STEPS.findIndex((item) => item.id === step);
  const lastRequiredStepIndex = WIZARD_STEPS.findIndex((item) => item.id === "comercial");
  const podeSalvar = form.titulo.trim().length >= 2;
  const totalVinculos =
    form.lead_ids.length +
    form.pessoa_ids.length +
    form.empresa_ids.length +
    form.parceiro_ids.length;
  const resumoMercado = labelMercadoPrefixo(form.prefixo_mercado);

  const pendencias = useMemo(() => {
    const items: string[] = [];
    if (!form.titulo.trim()) items.push("Definir um título comercial claro.");
    if (!form.valor_estimado.trim()) items.push("Informar valor estimado.");
    if (!form.data_previsao_fechamento.trim()) items.push("Preencher previsão de fechamento.");
    if (totalVinculos === 0) items.push("Vincular pelo menos um envolvido para rastreio.");
    if (form.pessoa_ids.length === 0 && form.lead_ids.length === 0) {
      items.push("Adicionar um lead ou contacto principal.");
    }
    return items;
  }, [form, totalVinculos]);

  async function enviarCopiloto(textoBase?: string) {
    const texto = (textoBase ?? chatInput).trim();
    if (!texto || chatLoading) return;

    const optimisticUser: ChatMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: texto,
    };
    const nextMessages = [...chatMessages, optimisticUser];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatErro("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/crm/negocios/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          draft: {
            ...form,
            pipeline_id: pipelineId || null,
          },
          messages: nextMessages.map((msg) => ({ role: msg.role, content: msg.content })),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; reply?: string };
      const reply = typeof data.reply === "string" ? data.reply.trim() : "";
      if (!res.ok || !reply) {
        setChatErro(data.error || "Não foi possível falar com o copiloto agora.");
        setChatMessages((prev) => prev.filter((msg) => msg.id !== optimisticUser.id));
        setChatInput(texto);
        return;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: reply,
        },
      ]);
    } catch {
      setChatErro("Falha de rede ao conversar com o copiloto.");
      setChatMessages((prev) => prev.filter((msg) => msg.id !== optimisticUser.id));
      setChatInput(texto);
    } finally {
      setChatLoading(false);
    }
  }

  function proximoPasso() {
    const next = WIZARD_STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  }

  function passoAnterior() {
    const prev = WIZARD_STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
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
          lead_id: form.lead_ids[0] || null,
          pessoa_id: form.pessoa_ids[0] || null,
          empresa_id: form.empresa_ids[0] || null,
          parceiro_id: form.parceiro_ids[0] || null,
          lead_ids: form.lead_ids,
          pessoa_ids: form.pessoa_ids,
          empresa_ids: form.empresa_ids,
          parceiro_ids: form.parceiro_ids,
          pipeline_id: pipelineId || null,
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
          process.env.NODE_ENV === "development" && detail ? `${base} — ${detail}` : base
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
    <CadastroPremiumSideover
      open={open}
      onClose={onClose}
      kindLabel="Negócio"
      title="Novo negócio"
      subtitle="Wizard com etapas guiadas, vínculos múltiplos e copiloto IA opcional."
      Icon={BriefcaseBusiness}
      badge={<CadastroTipoBadge label="CRM Negócios" tone="gold" />}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              minWidth: 120,
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid #30363d",
              background: "transparent",
              color: "#8b949e",
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Cancelar
          </button>
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={passoAnterior}
              disabled={loading || chatLoading}
              style={{
                minWidth: 120,
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid #30363d",
                background: "#161b22",
                color: "#c8d1dc",
                fontSize: 13,
                fontWeight: 700,
                cursor: loading || chatLoading ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <ChevronLeft size={14} />
              Voltar
            </button>
          ) : null}
          {stepIndex < lastRequiredStepIndex ? (
            <button
              type="button"
              onClick={proximoPasso}
              disabled={loading || chatLoading}
              style={{
                minWidth: 130,
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid #2f81f7",
                background: "#2f81f720",
                color: "#9ecbff",
                fontSize: 13,
                fontWeight: 800,
                cursor: loading || chatLoading ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              Próximo
              <ChevronRight size={14} />
            </button>
          ) : null}
          {step !== "copiloto" && stepIndex >= lastRequiredStepIndex ? (
            <button
              type="button"
              onClick={() => setStep("copiloto")}
              disabled={loading || chatLoading}
              style={{
                minWidth: 152,
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid #22c55e55",
                background: "#05281466",
                color: "#86efac",
                fontSize: 13,
                fontWeight: 800,
                cursor: loading || chatLoading ? "not-allowed" : "pointer",
              }}
            >
              IA opcional
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={loading || !podeSalvar}
            style={{
              minWidth: 160,
              padding: "12px 16px",
              borderRadius: 10,
              border: "none",
              background: loading ? "#30363d" : "#003b26",
              color: loading ? "#8b949e" : "#c9a24a",
              fontSize: 13,
              fontWeight: 800,
              cursor: loading || !podeSalvar ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Salvando..." : "Salvar negócio"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          {WIZARD_STEPS.map((item, index) => {
            const active = item.id === step;
            const done = index < stepIndex;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(item.id)}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${active ? "#c9a24a55" : done ? "#22c55e55" : "#2c384b"}`,
                  background: active ? "#c9a24a18" : done ? "#22c55e14" : "#141d29",
                  padding: "10px 12px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    fontWeight: 800,
                    color: active ? "#d6b976" : done ? "#86efac" : "#6e8099",
                    letterSpacing: 0.6,
                  }}
                >
                  {item.short}
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    fontWeight: 800,
                    color: active ? "#f3ddb0" : "#e6edf3",
                  }}
                >
                  {item.label}
                </p>
                {item.optional ? (
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 10,
                      fontWeight: 700,
                      color: active ? "#86efac" : "#8b949e",
                    }}
                  >
                    opcional
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>

        <CadastroSideoverPanel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
            {metricCard("Mercado", resumoMercado, "#e6edf3")}
            {metricCard("Etapa", ETAPA_LABEL[form.etapa] || form.etapa, "#e6edf3")}
            {metricCard("Valor", form.valor_estimado.trim() || "não definido", "#22c55e")}
            {metricCard("Vínculos", String(totalVinculos), "#c9a24a")}
          </div>
        </CadastroSideoverPanel>

        {step === "essenciais" ? (
          <CadastroSideoverPanel>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={LABEL}>Título *</label>
                <input
                  value={form.titulo}
                  onChange={(e) => campo("titulo", e.target.value)}
                  placeholder="Ex.: Retrofit prédio comercial · fase 1"
                  style={INPUT}
                  autoFocus
                />
                <p style={{ ...HINT, marginTop: 6 }}>
                  Use um título curto, comercial e fácil de localizar na operação.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                    {NEGOCIO_ETAPAS.map((item) => (
                      <option key={item} value={item}>
                        {ETAPA_LABEL[item] || item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid #2f81f744",
                  background: "#0f1f3322",
                  padding: 12,
                }}
              >
                <p style={{ margin: 0, color: "#9ecbff", fontSize: 12, fontWeight: 800 }}>
                  Enquadramento do negócio
                </p>
                <p style={{ ...HINT, marginTop: 6 }}>
                  Defina bem mercado, etapa e naming antes de avançar. O copiloto usa isso para
                  sugerir próximos passos e composição de envolvidos.
                </p>
              </div>
            </div>
          </CadastroSideoverPanel>
        ) : null}

        {step === "envolvidos" ? (
          <CadastroSideoverPanel>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {carregandoOpts ? (
                <p style={{ ...HINT, color: "#9ecbff" }}>Carregando listas de envolvidos…</p>
              ) : null}
              {catalogoErro ? (
                <p
                  style={{
                    margin: 0,
                    color: "#fca5a5",
                    fontSize: 12,
                    lineHeight: 1.5,
                    border: "1px solid rgba(239,68,68,0.25)",
                    background: "rgba(127,29,29,0.18)",
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                >
                  Algumas listas não carregaram totalmente: {catalogoErro}
                </p>
              ) : null}
              <div>
                <label style={LABEL}>Leads envolvidos</label>
                <p style={{ ...HINT, marginBottom: 8 }}>
                  {carregandoOpts
                    ? "A carregar leads…"
                    : leads.length
                      ? `${leads.length} lead(s) disponível(is) para vincular.`
                      : "Nenhum lead disponível para vincular."}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <select
                    value={picker.lead_id}
                    onChange={(e) => campoPicker("lead_id", e.target.value)}
                    disabled={carregandoOpts}
                    style={{ ...INPUT, cursor: "pointer" }}
                  >
                    <option value="">Selecionar lead</option>
                    {leads.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                        {item.telefone ? ` · ${item.telefone}` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!picker.lead_id}
                    onClick={() => adicionarVinculo("lead_ids", "lead_id")}
                    style={{
                      padding: "0 14px",
                      borderRadius: 10,
                      border: "1px solid #30363d",
                      background: picker.lead_id ? "#003b26" : "#161b22",
                      color: picker.lead_id ? "#c9a24a" : "#6e7681",
                      fontWeight: 700,
                      cursor: picker.lead_id ? "pointer" : "not-allowed",
                    }}
                  >
                    + Add
                  </button>
                </div>
                {form.lead_ids.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {form.lead_ids.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => removerVinculo("lead_ids", id)}
                        style={{
                          borderRadius: 999,
                          border: "1px solid #2f81f7",
                          background: "#2f81f722",
                          color: "#9ecbff",
                          padding: "6px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                        title="Remover lead"
                      >
                        {labelLead(id)} ×
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label style={LABEL}>Pessoas / contactos</label>
                <p style={{ ...HINT, marginBottom: 8 }}>
                  {carregandoOpts
                    ? "A carregar pessoas…"
                    : pessoas.length
                      ? `${pessoas.length} pessoa(s) disponível(is) para vincular.`
                      : "Nenhuma pessoa disponível para vincular."}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <select
                    value={picker.pessoa_id}
                    onChange={(e) => campoPicker("pessoa_id", e.target.value)}
                    disabled={carregandoOpts}
                    style={{ ...INPUT, cursor: "pointer" }}
                  >
                    <option value="">Selecionar pessoa</option>
                    {pessoas.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                        {item.codigo ? ` (${item.codigo})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!picker.pessoa_id}
                    onClick={() => adicionarVinculo("pessoa_ids", "pessoa_id")}
                    style={{
                      padding: "0 14px",
                      borderRadius: 10,
                      border: "1px solid #30363d",
                      background: picker.pessoa_id ? "#003b26" : "#161b22",
                      color: picker.pessoa_id ? "#c9a24a" : "#6e7681",
                      fontWeight: 700,
                      cursor: picker.pessoa_id ? "pointer" : "not-allowed",
                    }}
                  >
                    + Add
                  </button>
                </div>
                {form.pessoa_ids.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {form.pessoa_ids.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => removerVinculo("pessoa_ids", id)}
                        style={{
                          borderRadius: 999,
                          border: "1px solid #8b5cf6",
                          background: "#8b5cf622",
                          color: "#c4b5fd",
                          padding: "6px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                        title="Remover pessoa"
                      >
                        {labelPessoa(id)} ×
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label style={LABEL}>Empresas / fornecedores</label>
                <p style={{ ...HINT, marginBottom: 8 }}>
                  {carregandoOpts
                    ? "A carregar empresas…"
                    : empresas.length
                      ? `${empresas.length} empresa(s) disponível(is) para vincular.`
                      : "Nenhuma empresa disponível para vincular."}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <select
                    value={picker.empresa_id}
                    onChange={(e) => campoPicker("empresa_id", e.target.value)}
                    disabled={carregandoOpts}
                    style={{ ...INPUT, cursor: "pointer" }}
                  >
                    <option value="">Selecionar empresa</option>
                    {empresas.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome_fantasia || item.razao_social}
                        {item.codigo ? ` (${item.codigo})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!picker.empresa_id}
                    onClick={() => adicionarVinculo("empresa_ids", "empresa_id")}
                    style={{
                      padding: "0 14px",
                      borderRadius: 10,
                      border: "1px solid #30363d",
                      background: picker.empresa_id ? "#003b26" : "#161b22",
                      color: picker.empresa_id ? "#c9a24a" : "#6e7681",
                      fontWeight: 700,
                      cursor: picker.empresa_id ? "pointer" : "not-allowed",
                    }}
                  >
                    + Add
                  </button>
                </div>
                {form.empresa_ids.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {form.empresa_ids.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => removerVinculo("empresa_ids", id)}
                        style={{
                          borderRadius: 999,
                          border: "1px solid #22c55e",
                          background: "#22c55e22",
                          color: "#86efac",
                          padding: "6px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                        title="Remover empresa"
                      >
                        {labelEmpresa(id)} ×
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label style={LABEL}>Parceiros / corretores</label>
                <p style={{ ...HINT, marginBottom: 8 }}>
                  {carregandoOpts
                    ? "A carregar parceiros…"
                    : parceiros.length
                      ? `${parceiros.length} parceiro(s) disponível(is) para vincular.`
                      : "Nenhum parceiro disponível para vincular."}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <select
                    value={picker.parceiro_id}
                    onChange={(e) => campoPicker("parceiro_id", e.target.value)}
                    disabled={carregandoOpts}
                    style={{ ...INPUT, cursor: "pointer" }}
                  >
                    <option value="">Selecionar parceiro</option>
                    {parceiros.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                        {item.codigo ? ` (${item.codigo})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!picker.parceiro_id}
                    onClick={() => adicionarVinculo("parceiro_ids", "parceiro_id")}
                    style={{
                      padding: "0 14px",
                      borderRadius: 10,
                      border: "1px solid #30363d",
                      background: picker.parceiro_id ? "#003b26" : "#161b22",
                      color: picker.parceiro_id ? "#c9a24a" : "#6e7681",
                      fontWeight: 700,
                      cursor: picker.parceiro_id ? "pointer" : "not-allowed",
                    }}
                  >
                    + Add
                  </button>
                </div>
                {form.parceiro_ids.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {form.parceiro_ids.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => removerVinculo("parceiro_ids", id)}
                        style={{
                          borderRadius: 999,
                          border: "1px solid #f59e0b",
                          background: "#f59e0b22",
                          color: "#fcd34d",
                          padding: "6px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                        title="Remover parceiro"
                      >
                        {labelParceiro(id)} ×
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <p style={{ ...HINT, color: "#c8d1dc" }}>
                O primeiro item de cada grupo vira o vínculo principal no negócio. Os demais
                continuam rastreados em `hub_negocio_vinculos`.
              </p>
            </div>
          </CadastroSideoverPanel>
        ) : null}

        {step === "comercial" ? (
          <>
            <CadastroSideoverPanel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
              </div>
            </CadastroSideoverPanel>

            <CadastroSideoverPanel>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ margin: 0, color: "#e6edf3", fontSize: 13, fontWeight: 800 }}>
                  Checklist operacional
                </p>
                {pendencias.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#fca5a5", fontSize: 12, lineHeight: 1.6 }}>
                    {pendencias.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0, color: "#86efac", fontSize: 12, fontWeight: 700 }}>
                    Draft bem preenchido. Próximo passo: salvar o negócio ou usar a IA opcional para
                    revisar antes.
                  </p>
                )}
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid #22c55e33",
                    background: "#05281466",
                    padding: 12,
                  }}
                >
                  <p style={{ margin: 0, color: "#86efac", fontSize: 12, fontWeight: 800 }}>
                    Leitura do negócio
                  </p>
                  <p style={{ ...HINT, marginTop: 6 }}>
                    Mercado {resumoMercado}, etapa {ETAPA_LABEL[form.etapa] || form.etapa}, valor{" "}
                    {form.valor_estimado.trim() || "não definido"} e {totalVinculos} vínculo(s)
                    carregado(s).
                  </p>
                </div>
              </div>
            </CadastroSideoverPanel>
          </>
        ) : null}

        {step === "copiloto" ? (
          <>
            <CadastroSideoverPanel>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    border: "1px solid #22c55e44",
                    background: "#003b2622",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={18} color="#86efac" />
                </div>
                <div>
                  <p style={{ margin: 0, color: "#e6edf3", fontSize: 13, fontWeight: 800 }}>
                    Copiloto opcional de criação
                  </p>
                  <p style={{ ...HINT, marginTop: 6 }}>
                    Use a IA apenas se quiser ajuda extra para revisar o draft, sugerir título,
                    apontar lacunas e decidir os envolvidos do negócio. Ela não é obrigatória para
                    criar o negócio.
                  </p>
                </div>
              </div>
            </CadastroSideoverPanel>

            <CadastroSideoverPanel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                {metricCard("Leads", String(form.lead_ids.length), "#9ecbff")}
                {metricCard("Pessoas", String(form.pessoa_ids.length), "#c4b5fd")}
                {metricCard("Empresas", String(form.empresa_ids.length), "#86efac")}
                {metricCard("Parceiros", String(form.parceiro_ids.length), "#fcd34d")}
              </div>
            </CadastroSideoverPanel>

            <CadastroSideoverPanel>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void enviarCopiloto(prompt)}
                      disabled={chatLoading}
                      style={{
                        borderRadius: 999,
                        border: "1px solid #2d394b",
                        background: "#161b22",
                        color: "#c8d1dc",
                        padding: "8px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: chatLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid #2c384b",
                    background: "#0d1117",
                    minHeight: 260,
                    maxHeight: 360,
                    overflowY: "auto",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {chatMessages.map((msg) => {
                    const isUser = msg.role === "user";
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: "flex",
                          justifyContent: isUser ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "88%",
                            borderRadius: 12,
                            padding: "10px 12px",
                            background: isUser ? "#2f81f720" : "#141d29",
                            border: `1px solid ${isUser ? "#2f81f755" : "#2c384b"}`,
                            color: isUser ? "#cfe7ff" : "#e6edf3",
                            fontSize: 12,
                            lineHeight: 1.55,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 6,
                              color: isUser ? "#9ecbff" : "#86efac",
                              fontSize: 10,
                              fontWeight: 800,
                            }}
                          >
                            {isUser ? <Users size={12} /> : <Bot size={12} />}
                            {isUser ? "Você" : "Copiloto IA"}
                          </div>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                  {chatLoading ? (
                    <p style={{ margin: 0, color: "#8b949e", fontSize: 12 }}>Copiloto a pensar…</p>
                  ) : null}
                  <div ref={chatEndRef} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Peça ajuda: revisar draft, sugerir título, apontar lacunas, montar envolvidos…"
                    rows={3}
                    style={{ ...INPUT, resize: "none", minHeight: 84 }}
                  />
                  <button
                    type="button"
                    onClick={() => void enviarCopiloto()}
                    disabled={chatLoading || !chatInput.trim()}
                    style={{
                      width: 48,
                      borderRadius: 12,
                      border: "1px solid #22c55e44",
                      background: chatLoading || !chatInput.trim() ? "#161b22" : "#003b26",
                      color: chatLoading || !chatInput.trim() ? "#6e7681" : "#86efac",
                      cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                    }}
                    aria-label="Enviar mensagem ao copiloto"
                  >
                    <Send size={16} />
                  </button>
                </div>
                {chatErro ? <p style={{ margin: 0, color: "#fca5a5", fontSize: 12 }}>{chatErro}</p> : null}
              </div>
            </CadastroSideoverPanel>
          </>
        ) : null}

        {erro ? <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{erro}</p> : null}
      </div>
    </CadastroPremiumSideover>
  );
}
