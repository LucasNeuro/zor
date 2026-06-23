"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Loader2, Save } from "lucide-react";
import { CrmRetrofitSideoverShell } from "@/components/crm/CrmRetrofitSideoverShell";
import {
  documentoCompleto,
  documentoValido,
  formatarCnpjMascara,
  normalizarDocumento,
} from "@/lib/crm/documento-brasil";
import type { OpenCnpjEnriquecido } from "@/lib/crm/opencnpj";
import { formatarCepMascara } from "@/lib/crm/viacep";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_TEXT_MUTED,
  RF_TEXT_SECONDARY,
  rfBodyOnDarkStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import type { TenantEmpresaCadastral } from "@/lib/hub/tenant-empresa-cadastral";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (empresa: TenantEmpresaCadastral | null) => void;
};

function emptyForm(): TenantEmpresaCadastral {
  return {
    cnpj: "",
    razao_social: "",
    nome_fantasia: null,
    situacao_cadastral: null,
    email: null,
    telefone: null,
    cep: null,
    logradouro: null,
    numero: null,
    complemento: null,
    bairro: null,
    cidade: null,
    estado: null,
    cnae_principal: null,
    site: null,
    descricao_curta: null,
    atualizado_em: null,
  };
}

const READONLY_INPUT = {
  ...RF_INPUT_STYLE,
  opacity: 0.85,
  cursor: "default",
} as const;

export function CrmConhecimentoEmpresaSideover({ open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [erro, setErro] = useState("");
  const [importadoCadastro, setImportadoCadastro] = useState(false);
  const [form, setForm] = useState<TenantEmpresaCadastral>(emptyForm);
  const cnpjConsultadoRef = useRef<string | null>(null);
  const cnpjConsultaGenRef = useRef(0);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    setImportadoCadastro(false);
    try {
      const r = await fetch("/api/hub/conhecimento/empresa", { headers: await crmApiHeaders() });
      const json = (await r.json()) as {
        empresa?: TenantEmpresaCadastral | null;
        preenchido_de_cadastro?: boolean;
        error?: string;
      };
      if (!r.ok) throw new Error(json.error || "Falha ao carregar dados da empresa.");
      const emp = json.empresa;
      setImportadoCadastro(Boolean(json.preenchido_de_cadastro));
      if (emp) {
        setForm({
          ...emptyForm(),
          ...emp,
          cnpj: emp.cnpj ? formatarCnpjMascara(emp.cnpj) : "",
          cep: emp.cep ? formatarCepMascara(emp.cep) : null,
        });
        cnpjConsultadoRef.current = normalizarDocumento(emp.cnpj || "");
      } else {
        setForm(emptyForm());
        cnpjConsultadoRef.current = null;
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void carregar();
  }, [open, carregar]);

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
      const cnae =
        typeof d.snapshot.cnae_principal === "string" ? d.snapshot.cnae_principal.trim() : null;
      setForm((f) => ({
        ...f,
        cnpj: formatarCnpjMascara(d.cnpj),
        razao_social: d.razao_social || f.razao_social,
        nome_fantasia: d.nome_fantasia || f.nome_fantasia,
        situacao_cadastral: d.situacao_cadastral || f.situacao_cadastral,
        email: d.email || f.email,
        telefone: d.telefone || f.telefone,
        cep: d.cep ? formatarCepMascara(d.cep) : f.cep,
        logradouro: d.logradouro || f.logradouro,
        numero: d.numero || f.numero,
        complemento: d.complemento || f.complemento,
        bairro: d.bairro || f.bairro,
        cidade: d.cidade || f.cidade,
        estado: d.estado || f.estado,
        cnae_principal: cnae || f.cnae_principal,
      }));
    } catch {
      if (gen === cnpjConsultaGenRef.current) {
        cnpjConsultadoRef.current = null;
        setErro("Erro ao consultar CNPJ.");
      }
    } finally {
      if (gen === cnpjConsultaGenRef.current) setBuscandoCnpj(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const digits = normalizarDocumento(form.cnpj);
    if (!documentoCompleto("PJ", digits)) {
      cnpjConsultadoRef.current = null;
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
  }, [open, form.cnpj, consultarCnpjPorDigits]);

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const payload = {
        ...form,
        cnpj: normalizarDocumento(form.cnpj),
        cep: form.cep ? normalizarDocumento(form.cep) : null,
      };
      const r = await fetch("/api/hub/conhecimento/empresa", {
        method: "PATCH",
        headers: { ...(await crmApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await r.json()) as { empresa?: TenantEmpresaCadastral | null; error?: string };
      if (!r.ok) throw new Error(json.error || "Falha ao salvar.");
      onSaved?.(json.empresa ?? null);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function field(
    label: string,
    key: keyof TenantEmpresaCadastral,
    opts?: { placeholder?: string; readOnly?: boolean; type?: string }
  ) {
    const val = form[key];
    return (
      <label className="block">
        <span style={RF_LABEL_STYLE}>{label}</span>
        <input
          type={opts?.type ?? "text"}
          readOnly={opts?.readOnly}
          value={typeof val === "string" ? val : ""}
          placeholder={opts?.placeholder}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value || null }))}
          style={opts?.readOnly ? READONLY_INPUT : RF_INPUT_STYLE}
        />
      </label>
    );
  }

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      kindLabel="Conhecimento"
      title="Dados da empresa"
      subtitle="CNPJ e identidade usados pelos agentes IA nas saudações e respostas."
      icon={Building2}
      loading={loading}
      loadingLabel="A carregar dados da empresa…"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="rounded-xl border px-4 py-2.5 text-xs font-bold"
            style={{
              borderColor: RF_BORDER_STRONG,
              color: RF_TEXT_SECONDARY,
              background: "transparent",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || loading}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-50"
            style={{ background: RF_ACCENT, color: "#0b1f10" }}
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      }
    >
      {!loading && (
        <div className="space-y-5 px-1 pb-4">
          {erro ? (
            <p
              className="rounded-xl px-3 py-2 text-sm"
              style={{
                border: "1px solid rgba(248, 81, 73, 0.35)",
                background: "rgba(248, 81, 73, 0.12)",
                color: "#f85149",
              }}
            >
              {erro}
            </p>
          ) : null}

          {importadoCadastro ? (
            <p
              className="rounded-xl px-3 py-2 text-sm leading-relaxed"
              style={{
                border: `1px solid ${RF_BORDER}`,
                background: "rgba(63, 152, 72, 0.12)",
                color: RF_TEXT_SECONDARY,
              }}
            >
              Dados importados do cadastro da conta (CNPJ / empresa). Revise e salve para confirmar
              nos agentes IA.
            </p>
          ) : null}

          <p style={rfBodyOnDarkStyle()}>
            Informe o CNPJ para puxar razão social e endereço automaticamente (mesma API do cadastro).
            Os agentes passam a se apresentar com o nome real da empresa — evitando respostas genéricas.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span style={RF_LABEL_STYLE}>CNPJ</span>
              <div className="relative">
                <input
                  value={form.cnpj}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cnpj: formatarCnpjMascara(e.target.value) }))
                  }
                  placeholder="00.000.000/0000-00"
                  style={RF_INPUT_STYLE}
                />
                {buscandoCnpj ? (
                  <Loader2
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
                    style={{ color: RF_ACCENT }}
                  />
                ) : null}
              </div>
            </label>
            {field("Razão social", "razao_social", { placeholder: "Preenchido pela Receita" })}
            {field("Nome fantasia", "nome_fantasia", { placeholder: "Como o cliente conhece a marca" })}
            {field("Situação cadastral", "situacao_cadastral", { readOnly: true })}
            {field("CNAE / atividade", "cnae_principal", { readOnly: true })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {field("E-mail", "email", { type: "email" })}
            {field("Telefone", "telefone")}
            {field("Site", "site", { placeholder: "https://..." })}
          </div>

          <div className="grid gap-3 sm:grid-cols-[120px_1fr_100px]">
            {field("CEP", "cep")}
            <div className="sm:col-span-2">{field("Logradouro", "logradouro")}</div>
            {field("Nº", "numero")}
            {field("Complemento", "complemento")}
            {field("Bairro", "bairro")}
            {field("Cidade", "cidade")}
            {field("UF", "estado")}
          </div>

          <label className="block">
            <span style={RF_LABEL_STYLE}>Como a empresa se apresenta ao cliente</span>
            <textarea
              value={form.descricao_curta ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, descricao_curta: e.target.value || null }))}
              rows={4}
              placeholder="Ex.: Assistência técnica de celulares e notebooks em São Paulo. Especialistas em troca de tela e bateria."
              style={{ ...RF_INPUT_STYLE, resize: "vertical", minHeight: 96 }}
            />
            <span className="mt-1 block text-[11px]" style={{ color: RF_TEXT_MUTED }}>
              Opcional — ajuda os agentes a descrever o negócio com mais contexto.
            </span>
          </label>
        </div>
      )}
    </CrmRetrofitSideoverShell>
  );
}
