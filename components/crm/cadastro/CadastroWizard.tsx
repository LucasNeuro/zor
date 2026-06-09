"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Building2, User, UserPlus } from "lucide-react";
import { CadastroConhecimentoBanner } from "@/components/crm/cadastro/CadastroConhecimentoBanner";
import {
  CrmRetrofitSideoverShell,
  crmRetrofitSideoverFooterBtnCancel,
  crmRetrofitSideoverFooterBtnPrimary,
} from "@/components/crm/CrmRetrofitSideoverShell";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  documentoCompleto,
  documentoValido,
  formatarCnpjMascara,
  formatarCpfMascara,
  mensagemDocumentoInvalido,
  normalizarDocumento,
} from "@/lib/crm/documento-brasil";
import type { OpenCnpjEnriquecido } from "@/lib/crm/opencnpj";
import {
  emptySuperCadastroForm,
  type SuperCadastroInput,
} from "@/lib/crm/super-cadastro-form";
import { normalizarTelefone } from "@/lib/crm/pessoa-cadastro";
import {
  buscarEnderecoPorCep,
  cepValidoParaBusca,
  formatarCepMascara,
  normalizarCep,
} from "@/lib/crm/viacep";
import { CadastroComercialSecao } from "@/components/crm/cadastro/CadastroComercialSecao";
import {
  erroVerificacaoDocumento,
  verificarDocumentoDisponivel,
} from "@/lib/crm/verificar-documento-disponivel";

const INPUT: React.CSSProperties = {
  ...RF_INPUT_STYLE,
  padding: "10px 12px",
  borderRadius: 10,
  fontSize: 13,
};

const LABEL: React.CSSProperties = {
  ...RF_LABEL_STYLE,
  fontWeight: 600,
  marginBottom: 6,
  display: "block",
};

type Props = {
  open: boolean;
  onClose: () => void;
  tipoInicial?: "PF" | "PJ";
  onSaved?: (result: {
    pessoa_id: string;
    empresa_id?: string | null;
    lead_id?: string | null;
    codigo_pessoa?: string | null;
    codigo_lead?: string | null;
    aviso?: string | null;
    pessoa?: Record<string, unknown>;
  }) => void;
};

function WizardSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        border: `1px solid ${RF_BORDER_STRONG}`,
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(6, 13, 8, 0.45)",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${RF_BORDER}`,
          background: "rgba(11, 31, 16, 0.35)",
        }}
      >
        <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: RF_ACCENT, letterSpacing: 0.04 }}>
          {title.toUpperCase()}
        </h4>
        {description ? (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
            {description}
          </p>
        ) : null}
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </section>
  );
}

export function CadastroWizard({ open, onClose, tipoInicial = "PF", onSaved }: Props) {
  const [form, setForm] = useState<SuperCadastroInput>(() => emptySuperCadastroForm(tipoInicial));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [docHint, setDocHint] = useState<string | null>(null);
  const [docHintOk, setDocHintOk] = useState(false);
  const [docVerificando, setDocVerificando] = useState(false);
  const docDisponivelRef = useRef<string | null>(null);
  const docVerifyGenRef = useRef(0);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [opencnpjSnapshot, setOpencnpjSnapshot] = useState<Record<string, unknown> | null>(null);
  const [situacaoCnpj, setSituacaoCnpj] = useState<string | null>(null);
  const cnpjConsultadoRef = useRef<string | null>(null);
  const cnpjConsultaGenRef = useRef(0);

  const tipo = form.tipo_pessoa;

  useEffect(() => {
    if (!open) return;
    setForm(emptySuperCadastroForm(tipoInicial));
    setErro("");
    setSalvando(false);
    setOpencnpjSnapshot(null);
    setSituacaoCnpj(null);
    cnpjConsultadoRef.current = null;
    cnpjConsultaGenRef.current += 1;
    setDocHint(null);
    setDocHintOk(false);
    setDocVerificando(false);
    docDisponivelRef.current = null;
    docVerifyGenRef.current += 1;
  }, [open, tipoInicial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function patch(partial: Partial<SuperCadastroInput>) {
    setForm((f: SuperCadastroInput) => ({ ...f, ...partial }));
    setErro("");
  }

  function patchComercial(partial: Partial<SuperCadastroInput["comercial"]>) {
    setForm((f: SuperCadastroInput) => ({
      ...f,
      comercial: { ...f.comercial, ...partial },
    }));
    setErro("");
  }

  function alterarTipo(t: "PF" | "PJ") {
    if (t === tipo) return;
    setForm(emptySuperCadastroForm(t));
    setErro("");
    setDocHint(null);
    setDocHintOk(false);
    docDisponivelRef.current = null;
    setOpencnpjSnapshot(null);
    setSituacaoCnpj(null);
    cnpjConsultadoRef.current = null;
    cnpjConsultaGenRef.current += 1;
  }

  const consultarCnpjPorDigits = useCallback(async (digits: string) => {
    if (!documentoCompleto("PJ", digits) || !documentoValido("PJ", digits)) return;
    if (cnpjConsultadoRef.current === digits) return;

    setBuscandoCnpj(true);
    setErro("");
    const gen = ++cnpjConsultaGenRef.current;
    try {
      const res = await fetch(`/api/crm/consultar-cnpj?cnpj=${encodeURIComponent(digits)}`, {
        headers: internalApiHeaders(),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        dados?: OpenCnpjEnriquecido;
      };
      if (gen !== cnpjConsultaGenRef.current) return;
      if (!res.ok || !data.dados) {
        cnpjConsultadoRef.current = null;
        setErro(data.error || "CNPJ não encontrado na Receita Federal.");
        return;
      }
      const d = data.dados;
      cnpjConsultadoRef.current = digits;
      setOpencnpjSnapshot(d.snapshot as Record<string, unknown>);
      setSituacaoCnpj(d.situacao_cadastral);
      setForm((f) => ({
        ...f,
        nome: d.razao_social || f.nome,
        nome_fantasia: d.nome_fantasia || f.nome_fantasia,
        email: d.email || f.email,
        telefone: d.telefone || f.telefone,
        cep: d.cep ? formatarCepMascara(d.cep) : f.cep,
        logradouro: d.logradouro || f.logradouro,
        numero: d.numero || f.numero,
        complemento: d.complemento || f.complemento,
        bairro: d.bairro || f.bairro,
        cidade: d.cidade || f.cidade,
        estado: d.estado || f.estado,
      }));
    } catch {
      if (gen === cnpjConsultaGenRef.current) {
        cnpjConsultadoRef.current = null;
        setErro("Erro ao consultar OpenCNPJ.");
      }
    } finally {
      if (gen === cnpjConsultaGenRef.current) setBuscandoCnpj(false);
    }
  }, []);

  useEffect(() => {
    if (!open || tipo !== "PJ") return;

    const digits = normalizarDocumento(String(form.documento || ""));
    if (!documentoCompleto("PJ", digits)) {
      cnpjConsultadoRef.current = null;
      setSituacaoCnpj(null);
      setOpencnpjSnapshot(null);
      return;
    }
    if (!documentoValido("PJ", digits)) return;
    if (cnpjConsultadoRef.current === digits) return;

    const gen = ++cnpjConsultaGenRef.current;
    const timer = window.setTimeout(() => {
      void consultarCnpjPorDigits(digits);
    }, 650);

    return () => {
      window.clearTimeout(timer);
      cnpjConsultaGenRef.current += 1;
    };
  }, [open, tipo, form.documento, consultarCnpjPorDigits]);

  useEffect(() => {
    if (!open) return;

    const digits = normalizarDocumento(String(form.documento || ""));
    if (!documentoCompleto(tipo, digits)) {
      setDocHint(null);
      setDocHintOk(false);
      setDocVerificando(false);
      docDisponivelRef.current = null;
      return;
    }

    if (!documentoValido(tipo, digits)) {
      setDocHint(mensagemDocumentoInvalido(tipo));
      setDocHintOk(false);
      setDocVerificando(false);
      docDisponivelRef.current = null;
      return;
    }

    if (docDisponivelRef.current === digits) {
      setDocHint("Documento válido e disponível.");
      setDocHintOk(true);
      return;
    }

    const gen = ++docVerifyGenRef.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        setDocVerificando(true);
        setDocHint(null);
        setDocHintOk(false);
        const result = await verificarDocumentoDisponivel(digits, tipo);
        if (gen !== docVerifyGenRef.current) return;
        const erro = erroVerificacaoDocumento(result);
        if (result.disponivel) {
          docDisponivelRef.current = digits;
          setDocHint("Documento válido e disponível.");
          setDocHintOk(true);
        } else if (erro) {
          docDisponivelRef.current = null;
          setDocHint(erro);
          setDocHintOk(false);
        }
        setDocVerificando(false);
      })();
    }, 550);

    return () => {
      window.clearTimeout(timer);
      docVerifyGenRef.current += 1;
    };
  }, [open, form.documento, tipo]);

  function toggleMercado(sigla: string, ativo: boolean) {
    const atual = form.comercial.mercados ?? [];
    const next = ativo
      ? atual.includes(sigla)
        ? atual
        : [...atual, sigla]
      : atual.filter((m: string) => m !== sigla);
    patchComercial({ mercados: next });
    if (tipo === "PJ" && next.length === 1) {
      patch({ prefixo_mercado: sigla as SuperCadastroInput["prefixo_mercado"] });
    }
  }

  async function buscarCep() {
    const cep = normalizarCep(String(form.cep || ""));
    if (!cepValidoParaBusca(cep)) {
      setErro("CEP inválido (8 dígitos).");
      return;
    }
    setBuscandoCep(true);
    try {
      const end = await buscarEnderecoPorCep(cep);
      if (!end.ok) {
        setErro(end.erro);
        return;
      }
      const { endereco } = end;
      patch({
        cep: formatarCepMascara(cep),
        logradouro: endereco.logradouro || form.logradouro,
        bairro: endereco.bairro || form.bairro,
        cidade: endereco.cidade || form.cidade,
        estado: endereco.estado || form.estado,
      });
    } finally {
      setBuscandoCep(false);
    }
  }

  async function salvar() {
    setErro("");

    const nome = (form.nome || "").trim();
    const tel = normalizarTelefone(form.telefone || "");
    const email = (form.email || "").trim();
    const temId =
      nome.length >= 2 ||
      (tel.length >= 10 && tel.length <= 15) ||
      (email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    if (!temId) {
      setErro("Informe ao menos nome, telefone ou e-mail para gerar o lead.");
      return;
    }

    if (tel.length > 0 && (tel.length < 10 || tel.length > 15)) {
      setErro("Telefone inválido (DDD + número, até 15 dígitos com 55).");
      return;
    }

    if (
      form.comercial.criar_lead &&
      form.comercial.lead_origem === "indicacao" &&
      !(form.comercial.indicado_por || "").trim()
    ) {
      setErro("Informe quem indicou este contacto (origem Indicação).");
      return;
    }

    const digits = normalizarDocumento(String(form.documento || ""));
    if (digits) {
      if (!documentoCompleto(tipo, digits)) {
        setErro(
          tipo === "PF" ? "CPF incompleto (11 dígitos)." : "CNPJ incompleto (14 dígitos)."
        );
        return;
      }
      if (!documentoValido(tipo, digits)) {
        setErro(mensagemDocumentoInvalido(tipo));
        return;
      }
    }

    setSalvando(true);
    try {
      const res = await fetch("/api/crm/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          ...form,
          opencnpj_snapshot: opencnpjSnapshot,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        data?: {
          pessoa_id: string;
          empresa_id?: string | null;
          lead_id?: string | null;
          codigo_pessoa?: string | null;
          codigo_lead?: string | null;
          aviso?: string | null;
          pessoa?: Record<string, unknown>;
        };
      };
      if (!res.ok) {
        const msg = [data.error || "Não foi possível salvar.", data.detail]
          .filter(Boolean)
          .join(" ");
        setErro(msg);
        return;
      }
      if (data.data?.pessoa_id) {
        onSaved?.({
          pessoa_id: data.data.pessoa_id,
          empresa_id: data.data.empresa_id,
          lead_id: data.data.lead_id,
          codigo_pessoa: data.data.codigo_pessoa,
          codigo_lead: data.data.codigo_lead,
          aviso: data.data.aviso,
          pessoa: data.data.pessoa,
        });
        onClose();
      } else {
        setErro("Resposta inválida do servidor.");
      }
    } catch {
      setErro("Erro de rede.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      title="Novo cadastro"
      subtitle="Cliente ou empresa — dados alinhados ao contexto da sua operação (base de conhecimento)."
      icon={UserPlus}
      footer={
        <>
          {crmRetrofitSideoverFooterBtnCancel(onClose, salvando)}
          {crmRetrofitSideoverFooterBtnPrimary(
            salvando ? "Salvando…" : "Salvar cadastro",
            () => void salvar(),
            salvando || buscandoCnpj
          )}
        </>
      }
    >
      <CadastroConhecimentoBanner />

      {erro ? (
        <div
          style={{
            color: "#f87171",
            background: "rgba(248, 81, 73, 0.12)",
            border: "1px solid rgba(248, 81, 73, 0.35)",
            borderRadius: 8,
            padding: 10,
            fontSize: 13,
            marginBottom: 14,
          }}
          role="alert"
        >
          {erro}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <WizardSection
              title="Tipo de cadastro"
              description="Pessoa física (cliente) ou empresa (PJ)."
            >
              <div style={{ display: "flex", gap: 10, maxWidth: 480 }}>
                {(["PF", "PJ"] as const).map((t) => {
                  const ativo = tipo === t;
                  const Icon = t === "PF" ? User : Building2;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => alterarTipo(t)}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "14px 16px",
                        borderRadius: 10,
                        border: `2px solid ${ativo ? RF_ACCENT : RF_BORDER_STRONG}`,
                        background: ativo ? "rgba(146, 255, 0, 0.1)" : "rgba(6, 13, 8, 0.6)",
                        color: RF_TEXT_PRIMARY,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <Icon size={18} strokeWidth={2} style={{ color: ativo ? RF_ACCENT : RF_TEXT_MUTED }} />
                      {t === "PF" ? "Pessoa física" : "Empresa"}
                    </button>
                  );
                })}
              </div>
            </WizardSection>

            <WizardSection
              title="Identidade"
              description={
                tipo === "PF"
                  ? "Informe nome, telefone ou e-mail — o mínimo para identificar o cliente."
                  : "Informe o CNPJ — os dados da empresa são buscados na Receita (OpenCNPJ)."
              }
            >
              {tipo === "PJ" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={LABEL}>CNPJ</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        style={{ ...INPUT, flex: "1 1 220px", minWidth: 200 }}
                        value={form.documento}
                        placeholder="00.000.000/0000-00"
                        inputMode="numeric"
                        autoFocus
                        onChange={(e) => {
                          docDisponivelRef.current = null;
                          const masked = formatarCnpjMascara(e.target.value);
                          const prevDigits = normalizarDocumento(form.documento || "");
                          const nextDigits = normalizarDocumento(masked);
                          if (prevDigits !== nextDigits) {
                            cnpjConsultadoRef.current = null;
                            setSituacaoCnpj(null);
                            setOpencnpjSnapshot(null);
                          }
                          patch({ documento: masked });
                        }}
                        onBlur={() => {
                          const digits = normalizarDocumento(form.documento || "");
                          if (!digits || !documentoCompleto("PJ", digits) || !documentoValido("PJ", digits))
                            return;
                          if (docDisponivelRef.current === digits) return;
                          const gen = ++docVerifyGenRef.current;
                          void (async () => {
                            setDocVerificando(true);
                            const result = await verificarDocumentoDisponivel(digits, "PJ");
                            if (gen !== docVerifyGenRef.current) return;
                            const erro = erroVerificacaoDocumento(result);
                            if (result.disponivel) {
                              docDisponivelRef.current = digits;
                              setDocHint("CNPJ válido e disponível.");
                              setDocHintOk(true);
                            } else if (erro) {
                              docDisponivelRef.current = null;
                              setDocHint(erro);
                              setDocHintOk(false);
                            }
                            setDocVerificando(false);
                          })();
                          if (cnpjConsultadoRef.current !== digits) {
                            void consultarCnpjPorDigits(digits);
                          }
                        }}
                      />
                      <button
                        type="button"
                        disabled={buscandoCnpj}
                        onClick={() => {
                          const digits = normalizarDocumento(form.documento || "");
                          if (!documentoCompleto("PJ", digits)) {
                            setErro("Informe o CNPJ com 14 dígitos.");
                            return;
                          }
                          cnpjConsultadoRef.current = null;
                          void consultarCnpjPorDigits(digits);
                        }}
                        style={{
                          padding: "0 16px",
                          borderRadius: 10,
                          border: `1px solid ${RF_BORDER_STRONG}`,
                          background: "rgba(146, 255, 0, 0.08)",
                          color: RF_ACCENT,
                          cursor: buscandoCnpj ? "wait" : "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {buscandoCnpj ? "Buscando…" : "Buscar CNPJ"}
                      </button>
                    </div>
                    {buscandoCnpj && (
                      <p style={{ fontSize: 11, color: RF_ACCENT, marginTop: 6 }}>
                        Consultando Receita Federal (OpenCNPJ)…
                      </p>
                    )}
                    {docVerificando && (
                      <p style={{ fontSize: 11, color: RF_TEXT_MUTED, marginTop: 6 }}>
                        Verificando se o CNPJ já está cadastrado…
                      </p>
                    )}
                    {!docVerificando && docHint ? (
                      <p
                        style={{
                          fontSize: 11,
                          color: docHintOk ? "#3fb950" : "#f87171",
                          marginTop: 6,
                        }}
                      >
                        {docHint}
                      </p>
                    ) : null}
                    {situacaoCnpj && (
                      <p style={{ fontSize: 11, color: RF_TEXT_MUTED, marginTop: 6 }}>
                        Situação cadastral: {situacaoCnpj}
                      </p>
                    )}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={LABEL}>Razão social</label>
                      <input
                        style={INPUT}
                        value={form.nome}
                        onChange={(e) => patch({ nome: e.target.value })}
                        placeholder="Preenchido automaticamente após o CNPJ"
                      />
                    </div>
                    <div>
                      <label style={LABEL}>Nome fantasia</label>
                      <input
                        style={INPUT}
                        value={form.nome_fantasia || ""}
                        onChange={(e) => patch({ nome_fantasia: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={LABEL}>Nome completo</label>
                    <input
                      style={INPUT}
                      value={form.nome}
                      onChange={(e) => patch({ nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={LABEL}>CPF (opcional)</label>
                    <input
                      style={INPUT}
                      value={form.documento}
                      onChange={(e) => {
                        docDisponivelRef.current = null;
                        patch({ documento: formatarCpfMascara(e.target.value) });
                      }}
                      onBlur={() => {
                        const digits = normalizarDocumento(form.documento || "");
                        if (!digits) return;
                        if (!documentoCompleto("PF", digits) || !documentoValido("PF", digits)) return;
                        if (docDisponivelRef.current === digits) return;
                        const gen = ++docVerifyGenRef.current;
                        void (async () => {
                          setDocVerificando(true);
                          const result = await verificarDocumentoDisponivel(digits, "PF");
                          if (gen !== docVerifyGenRef.current) return;
                          const erro = erroVerificacaoDocumento(result);
                          if (result.disponivel) {
                            docDisponivelRef.current = digits;
                            setDocHint("Documento válido e disponível.");
                            setDocHintOk(true);
                          } else if (erro) {
                            docDisponivelRef.current = null;
                            setDocHint(erro);
                            setDocHintOk(false);
                          }
                          setDocVerificando(false);
                        })();
                      }}
                    />
                    {docVerificando && (
                      <p style={{ fontSize: 11, color: RF_TEXT_MUTED, marginTop: 6 }}>
                        Verificando disponibilidade…
                      </p>
                    )}
                    {!docVerificando && docHint ? (
                      <p
                        style={{
                          fontSize: 11,
                          color: docHintOk ? "#3fb950" : "#f87171",
                          marginTop: 6,
                        }}
                      >
                        {docHint}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </WizardSection>

            <WizardSection title="Contato" description="Telefone e e-mail do cliente.">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <label style={LABEL}>Telefone</label>
                  <input
                    style={INPUT}
                    value={form.telefone}
                    onChange={(e) => patch({ telefone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={LABEL}>E-mail</label>
                  <input
                    style={INPUT}
                    type="email"
                    value={form.email || ""}
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </div>
              </div>
            </WizardSection>

            <WizardSection
              title="Localização"
              description="Telefone e e-mail para contacto e atendimentos."
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <label style={LABEL}>CEP</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      style={{ ...INPUT, flex: 1 }}
                      value={form.cep || ""}
                      onChange={(e) => patch({ cep: formatarCepMascara(e.target.value) })}
                      onBlur={() => {
                        if (cepValidoParaBusca(String(form.cep || ""))) void buscarCep();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void buscarCep()}
                      disabled={buscandoCep}
                      style={{
                        padding: "0 14px",
                        borderRadius: 10,
                        border: `1px solid ${RF_BORDER_STRONG}`,
                        background: "rgba(6, 13, 8, 0.6)",
                        color: RF_TEXT_PRIMARY,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {buscandoCep ? "…" : "Buscar"}
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: "1fr minmax(96px, 140px)",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={LABEL}>Logradouro</label>
                    <input
                      style={INPUT}
                      value={form.logradouro || ""}
                      onChange={(e) => patch({ logradouro: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={LABEL}>Número</label>
                    <input
                      style={INPUT}
                      value={form.numero || ""}
                      onChange={(e) => patch({ numero: e.target.value })}
                      placeholder="Nº"
                      maxLength={20}
                    />
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={LABEL}>Complemento</label>
                  <input
                    style={INPUT}
                    value={form.complemento || ""}
                    onChange={(e) => patch({ complemento: e.target.value })}
                    placeholder="Sala, bloco, apto…"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label style={LABEL}>Bairro</label>
                  <input
                    style={INPUT}
                    value={form.bairro || ""}
                    onChange={(e) => patch({ bairro: e.target.value })}
                  />
                </div>
                <div>
                  <label style={LABEL}>Cidade</label>
                  <input
                    style={INPUT}
                    value={form.cidade || ""}
                    onChange={(e) => patch({ cidade: e.target.value })}
                  />
                </div>
                <div>
                  <label style={LABEL}>UF</label>
                  <input
                    style={INPUT}
                    maxLength={2}
                    value={form.estado || ""}
                    onChange={(e) => patch({ estado: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
            </WizardSection>

            <WizardSection
              title="Vínculo CRM"
              description="Opcional: crie um lead no funil de vendas quando fizer sentido para a operação."
            >
              <CadastroComercialSecao
                tipo={tipo}
                nome={form.nome}
                documento={form.documento}
                comercial={form.comercial}
                onComercialChange={patchComercial}
                onMercadoToggle={toggleMercado}
              />
            </WizardSection>
          </div>
    </CrmRetrofitSideoverShell>
  );
}
