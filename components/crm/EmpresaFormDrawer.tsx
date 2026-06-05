"use client";

import { useEffect, useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { EMPRESA_SEGMENTOS, MERCADOS_PREFIXO_OPTIONS } from "@/lib/crm/empresa-cadastro";
import {
  documentoCompleto,
  formatarCnpjMascara,
  normalizarDocumento,
} from "@/lib/crm/documento-brasil";
import {
  buscarEnderecoPorCep,
  cepValidoParaBusca,
  formatarCepMascara,
  normalizarCep,
} from "@/lib/crm/viacep";

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #dcebd8",
  background: "#ffffff",
  color: "#0b2210",
  fontSize: 14,
  boxSizing: "border-box",
};

const LABEL: React.CSSProperties = {
  color: "#5d7a67",
  fontSize: 12,
  fontWeight: 600,
  display: "block",
  marginBottom: 6,
};

const SECTION: React.CSSProperties = {
  marginTop: 4,
  paddingTop: 14,
  borderTop: "1px solid #eef7eb",
};

type FormState = {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  email: string;
  telefone: string;
  segmento: string;
  prefixo_mercado: string;
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
};

const emptyForm = (): FormState => ({
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  email: "",
  telefone: "",
  segmento: "cliente",
  prefixo_mercado: "IMB",
  cep: "",
  logradouro: "",
  bairro: "",
  cidade: "",
  estado: "",
});

type Props = {
  open: boolean;
  onClose: () => void;
  /** Recebe o id da empresa criada para abrir detalhes. */
  onSaved: (empresaId?: string) => void;
};

export function EmpresaFormDrawer({ open, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setErro("");
    setLoading(false);
    setBuscandoCep(false);
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

  async function buscarCep() {
    const cep = normalizarCep(form.cep);
    if (!cepValidoParaBusca(cep)) {
      setErro("CEP inválido (use 8 dígitos).");
      return;
    }
    setBuscandoCep(true);
    setErro("");
    try {
      const end = await buscarEnderecoPorCep(cep);
      if (!end.ok) {
        setErro(end.erro);
        return;
      }
      const { endereco } = end;
      setForm((f) => ({
        ...f,
        cep: formatarCepMascara(cep),
        logradouro: endereco.logradouro || f.logradouro,
        bairro: endereco.bairro || f.bairro,
        cidade: endereco.cidade || f.cidade,
        estado: endereco.estado || f.estado,
      }));
    } catch {
      setErro("Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

  async function salvar() {
    setErro("");
    if (!documentoCompleto("PJ", form.cnpj)) {
      setErro("Informe o CNPJ com 14 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/crm/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          razao_social: form.razao_social,
          nome_fantasia: form.nome_fantasia || null,
          cnpj: normalizarDocumento(form.cnpj),
          email: form.email || null,
          telefone: form.telefone || null,
          segmento: form.segmento || null,
          prefixo_mercado: form.prefixo_mercado,
          cep: form.cep || null,
          logradouro: form.logradouro || null,
          bairro: form.bairro || null,
          cidade: form.cidade || null,
          estado: form.estado || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        data?: { id?: string };
      };
      if (!res.ok) {
        const base = data.error || "Não foi possível salvar a empresa.";
        const detail = data.detail?.trim();
        setErro(
          process.env.NODE_ENV === "development" && detail
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

  const cnpjOk = documentoCompleto("PJ", form.cnpj);
  const podeSalvar = form.razao_social.trim().length >= 2 && cnpjOk && !loading;

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="empresa-form-title"
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}
    >
      <div style={{ flex: 1, background: "rgba(1, 4, 9, 0.72)" }} onClick={onClose} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          height: "100%",
          maxHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          background: "#f8fcf6",
          borderLeft: "1px solid #dcebd8",
          boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #dcebd8",
            flexShrink: 0,
          }}
        >
          <h2 id="empresa-form-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0b2210" }}>
            Nova empresa
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "none",
              color: "#5d7a67",
              fontSize: 22,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <label style={LABEL}>Razão social *</label>
            <input
              value={form.razao_social}
              onChange={(e) => campo("razao_social", e.target.value)}
              placeholder="Ex.: Construtora Alfa Ltda"
              style={INPUT}
              autoFocus
            />
          </div>

          <div>
            <label style={LABEL}>Nome fantasia</label>
            <input
              value={form.nome_fantasia}
              onChange={(e) => campo("nome_fantasia", e.target.value)}
              placeholder="Opcional"
              style={INPUT}
            />
          </div>

          <div>
            <label style={LABEL}>CNPJ *</label>
            <input
              value={form.cnpj}
              onChange={(e) => campo("cnpj", formatarCnpjMascara(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              style={INPUT}
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
            <label style={LABEL}>Segmento</label>
            <select
              value={form.segmento}
              onChange={(e) => campo("segmento", e.target.value)}
              style={{ ...INPUT, cursor: "pointer" }}
            >
              {EMPRESA_SEGMENTOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={LABEL}>E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => campo("email", e.target.value)}
              placeholder="contato@empresa.com.br"
              style={INPUT}
            />
          </div>

          <div>
            <label style={LABEL}>Telefone</label>
            <input
              value={form.telefone}
              onChange={(e) => campo("telefone", e.target.value)}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              style={INPUT}
            />
          </div>

          <div style={SECTION}>
            <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#0b2210" }}>Endereço</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={LABEL}>CEP</label>
                <input
                  value={form.cep}
                  onChange={(e) => campo("cep", formatarCepMascara(e.target.value))}
                  placeholder="00000-000"
                  inputMode="numeric"
                  style={INPUT}
                />
              </div>
              <button
                type="button"
                onClick={() => void buscarCep()}
                disabled={buscandoCep}
                style={{
                  alignSelf: "flex-end",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #dcebd8",
                  background: "#ffffff",
                  color: "#c9a24a",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: buscandoCep ? "wait" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {buscandoCep ? "..." : "Buscar CEP"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={LABEL}>Logradouro</label>
                <input
                  value={form.logradouro}
                  onChange={(e) => campo("logradouro", e.target.value)}
                  style={INPUT}
                />
              </div>
              <div>
                <label style={LABEL}>Bairro</label>
                <input value={form.bairro} onChange={(e) => campo("bairro", e.target.value)} style={INPUT} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 2 }}>
                  <label style={LABEL}>Cidade</label>
                  <input value={form.cidade} onChange={(e) => campo("cidade", e.target.value)} style={INPUT} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={LABEL}>UF</label>
                  <input
                    value={form.estado}
                    onChange={(e) => campo("estado", e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="SP"
                    style={INPUT}
                    maxLength={2}
                  />
                </div>
              </div>
            </div>
          </div>

          {erro && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{erro}</p>}
        </div>

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid #dcebd8",
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
              border: "1px solid #dcebd8",
              background: "transparent",
              color: "#5d7a67",
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
            disabled={!podeSalvar}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 10,
              border: "none",
              background: !podeSalvar ? "#dcebd8" : "#003b26",
              color: !podeSalvar ? "#5d7a67" : "#c9a24a",
              fontSize: 13,
              fontWeight: 800,
              cursor: !podeSalvar ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Salvando..." : "Salvar empresa"}
          </button>
        </div>
      </div>
    </div>
  );
}
