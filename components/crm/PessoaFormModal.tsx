"use client";



import { useEffect, useState } from "react";

import { internalApiHeaders } from "@/lib/internal-api-headers";

import {
  AREA_ATUACAO_OUTRO_VALUE,
  AREA_ATUACAO_SELECT_OPTIONS,
} from "@/lib/crm/areas-atuacao";

import type { TipoPessoaCadastro } from "@/lib/crm/pessoa-cadastro";

import {
  documentoCompleto,
  formatarCnpjMascara,
  formatarCpfMascara,
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



const SECTION: React.CSSProperties = {

  marginTop: 4,

  paddingTop: 14,

  borderTop: "1px solid #21262d",

};



type FormState = {

  nome: string;

  documento: string;

  email: string;

  telefone: string;

  empresa: string;

  area_atuacao: string;

  area_atuacao_outro: string;

  cep: string;

  logradouro: string;

  bairro: string;

  cidade: string;

  estado: string;

};



const emptyForm = (): FormState => ({

  nome: "",

  documento: "",

  email: "",

  telefone: "",

  empresa: "",

  area_atuacao: "",

  area_atuacao_outro: "",

  cep: "",

  logradouro: "",

  bairro: "",

  cidade: "",

  estado: "",

});



type Props = {

  open: boolean;

  onClose: () => void;

  /** Recebe o id da pessoa criada para abrir detalhes. */
  onSaved: (pessoaId?: string) => void;

};



export function PessoaFormModal({ open, onClose, onSaved }: Props) {

  const [tipo, setTipo] = useState<TipoPessoaCadastro>("PF");

  const [form, setForm] = useState<FormState>(emptyForm);

  const [erro, setErro] = useState("");

  const [docErro, setDocErro] = useState("");

  const [docOk, setDocOk] = useState(false);

  const [cepErro, setCepErro] = useState("");

  const [loading, setLoading] = useState(false);

  const [verificandoDoc, setVerificandoDoc] = useState(false);

  const [buscandoCep, setBuscandoCep] = useState(false);



  useEffect(() => {

    if (!open) return;

    setTipo("PF");

    setForm(emptyForm());

    setErro("");

    setDocErro("");

    setDocOk(false);

    setCepErro("");

    setLoading(false);

    setVerificandoDoc(false);

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

    setForm((f) => {

      const next = { ...f, [key]: value };

      if (key === "area_atuacao" && value !== AREA_ATUACAO_OUTRO_VALUE) {

        next.area_atuacao_outro = "";

      }

      return next;

    });

    setErro("");

    if (key === "cep") setCepErro("");

    if (key === "documento") {
      setDocErro("");
      setDocOk(false);
    }

  }



  function onDocumentoChange(valor: string) {
    const mascarado = tipo === "PF" ? formatarCpfMascara(valor) : formatarCnpjMascara(valor);
    campo("documento", mascarado);
  }



  async function verificarDocumento(): Promise<{ ok: true } | { ok: false; erro: string }> {
    setDocErro("");
    setDocOk(false);
    const digits = normalizarDocumento(form.documento);
    if (!digits) {
      const erro = tipo === "PF" ? "CPF é obrigatório." : "CNPJ é obrigatório.";
      setDocErro(erro);
      return { ok: false, erro };
    }
    if (!documentoCompleto(tipo, digits)) {
      const erro =
        tipo === "PF" ? "Informe os 11 dígitos do CPF." : "Informe os 14 dígitos do CNPJ.";
      setDocErro(erro);
      return { ok: false, erro };
    }

    setVerificandoDoc(true);
    try {
      const params = new URLSearchParams({
        documento: digits,
        tipo_pessoa: tipo,
      });
      const res = await fetch(`/api/crm/pessoas/verificar-documento?${params}`, {
        headers: internalApiHeaders(),
      });
      const data = (await res.json().catch(() => ({}))) as {
        disponivel?: boolean;
        error?: string;
      };
      if (!res.ok) {
        const erro = data.error || "Não foi possível validar o documento.";
        setDocErro(erro);
        return { ok: false, erro };
      }
      if (!data.disponivel) {
        const erro = data.error || "Documento já cadastrado ou inválido.";
        setDocErro(erro);
        return { ok: false, erro };
      }
      setDocOk(true);
      return { ok: true };
    } catch {
      const erro = "Erro de rede ao validar o documento.";
      setDocErro(erro);
      return { ok: false, erro };
    } finally {
      setVerificandoDoc(false);
    }
  }



  async function buscarCep() {

    setCepErro("");

    if (!cepValidoParaBusca(form.cep)) {

      setCepErro("Informe um CEP válido (8 dígitos).");

      return;

    }

    setBuscandoCep(true);

    const result = await buscarEnderecoPorCep(form.cep);

    setBuscandoCep(false);

    if (!result.ok) {

      setCepErro(result.erro);

      return;

    }

    const { endereco } = result;

    setForm((f) => ({

      ...f,

      cep: endereco.cep,

      logradouro: endereco.logradouro || f.logradouro,

      bairro: endereco.bairro || f.bairro,

      cidade: endereco.cidade || f.cidade,

      estado: endereco.estado || f.estado,

    }));

  }



  function onCepBlur() {

    const digits = normalizarCep(form.cep);

    if (digits.length === 8) void buscarCep();

  }



  async function salvar() {

    setErro("");

    if (docErro) {
      setErro(docErro);
      return;
    }

    if (!docOk) {
      const v = await verificarDocumento();
      if (!v.ok) {
        setErro(v.erro);
        return;
      }
    }

    if (form.area_atuacao === AREA_ATUACAO_OUTRO_VALUE) {

      const texto = form.area_atuacao_outro.trim();

      if (!texto || texto.length < 2) {

        setErro("Especifique a área de atuação (mín. 2 caracteres).");

        return;

      }

    }

    setLoading(true);

    try {

      const res = await fetch("/api/crm/pessoas", {

        method: "POST",

        headers: { "Content-Type": "application/json", ...internalApiHeaders() },

        body: JSON.stringify({

          tipo_pessoa: tipo,

          nome: form.nome,

          documento: form.documento,

          email: form.email,

          telefone: form.telefone,

          empresa: tipo === "PJ" ? form.empresa : null,

          area_atuacao: form.area_atuacao || null,

          area_atuacao_outro:

            form.area_atuacao === AREA_ATUACAO_OUTRO_VALUE

              ? form.area_atuacao_outro.trim() || null

              : null,

          cep: form.cep || null,

          logradouro: form.logradouro || null,

          bairro: form.bairro || null,

          cidade: form.cidade,

          estado: form.estado,

          origem: "crm_manual",

        }),

      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        erro?: string;
        detail?: string;
        data?: { id?: string };
      };
      if (!res.ok) {
        const base = data.error || data.erro || "Não foi possível salvar o cadastro.";
        const detail = data.detail?.trim();
        const msg =
          process.env.NODE_ENV === "development" && detail
            ? `${base} — ${detail}`
            : base;
        setErro(msg);
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

    <div

      role="dialog"

      aria-modal="true"

      aria-labelledby="pessoa-form-title"

      style={{

        position: "fixed",

        inset: 0,

        zIndex: 200,

        display: "flex",

        alignItems: "center",

        justifyContent: "center",

        padding: 16,

        background: "rgba(1, 4, 9, 0.72)",

      }}

      onClick={onClose}

    >

      <div

        onClick={(e) => e.stopPropagation()}

        style={{

          width: "100%",

          maxWidth: 520,

          maxHeight: "90vh",

          overflowY: "auto",

          background: "#0d1117",

          border: "1px solid #30363d",

          borderRadius: 14,

          padding: "20px 22px",

          boxShadow: "0 16px 48px rgba(0,0,0,0.45)",

        }}

      >

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>

          <div>

            <h2 id="pessoa-form-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e6edf3" }}>

              Novo cliente

            </h2>

            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#8b949e" }}>

              Cadastro em hub_pessoas — PF ou PJ na mesma lista.

            </p>

          </div>

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

              lineHeight: 1,

              padding: 4,

            }}

          >

            ×

          </button>

        </div>



        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>

          {(["PF", "PJ"] as const).map((t) => {

            const active = tipo === t;

            return (

              <button

                key={t}

                type="button"

                onClick={() => {

                  setTipo(t);

                  setForm((f) => ({ ...f, documento: "" }));

                  setErro("");

                  setDocErro("");

                  setDocOk(false);

                }}

                style={{

                  flex: 1,

                  padding: "10px 12px",

                  borderRadius: 10,

                  border: active ? "1px solid #c9a24a66" : "1px solid #30363d",

                  background: active ? "#c9a24a18" : "#161b22",

                  color: active ? "#c9a24a" : "#8b949e",

                  fontWeight: 700,

                  fontSize: 13,

                  cursor: "pointer",

                }}

              >

                {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}

              </button>

            );

          })}

        </div>



        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div>

            <label style={LABEL}>{tipo === "PJ" ? "Razão social *" : "Nome completo *"}</label>

            <input

              value={form.nome}

              onChange={(e) => campo("nome", e.target.value)}

              placeholder={tipo === "PJ" ? "Obra10 Materiais Ltda" : "Maria da Silva"}

              style={INPUT}

              autoFocus

            />

          </div>



          {tipo === "PJ" && (

            <div>

              <label style={LABEL}>Nome fantasia</label>

              <input

                value={form.empresa}

                onChange={(e) => campo("empresa", e.target.value)}

                placeholder="Obra10+"

                style={INPUT}

              />

            </div>

          )}



          <div>

            <label style={LABEL}>{tipo === "PF" ? "CPF *" : "CNPJ *"}</label>

            <input

              value={form.documento}

              onChange={(e) => onDocumentoChange(e.target.value)}

              onBlur={() => void verificarDocumento()}

              placeholder={tipo === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}

              style={{
                ...INPUT,
                borderColor: docErro ? "#ef444466" : docOk ? "#22c55e66" : "#30363d",
              }}

              inputMode="numeric"

              maxLength={tipo === "PF" ? 14 : 18}

              disabled={verificandoDoc || loading}

            />

            {verificandoDoc && (
              <p style={{ color: "#8b949e", fontSize: 11, margin: "6px 0 0" }}>
                Validando {tipo === "PF" ? "CPF" : "CNPJ"}…
              </p>
            )}

            {docErro && !verificandoDoc && (
              <p style={{ color: "#ef4444", fontSize: 11, margin: "6px 0 0" }}>{docErro}</p>
            )}

            {docOk && !docErro && !verificandoDoc && (
              <p style={{ color: "#22c55e", fontSize: 11, margin: "6px 0 0" }}>
                {tipo === "PF" ? "CPF" : "CNPJ"} válido e disponível para cadastro.
              </p>
            )}

          </div>



          <div>

            <label style={LABEL}>Área de atuação</label>

            <select

              value={form.area_atuacao}

              onChange={(e) => campo("area_atuacao", e.target.value)}

              style={{ ...INPUT, cursor: "pointer" }}

            >

              <option value="">Selecione (opcional)</option>

              {AREA_ATUACAO_SELECT_OPTIONS.map((opt) => (

                <option key={opt.value} value={opt.value}>

                  {opt.label}

                </option>

              ))}

            </select>

          </div>



          {form.area_atuacao === AREA_ATUACAO_OUTRO_VALUE && (

            <div>

              <label style={LABEL}>Especifique a área de atuação *</label>

              <input

                value={form.area_atuacao_outro}

                onChange={(e) => campo("area_atuacao_outro", e.target.value)}

                placeholder="Ex.: Logística, educação, agronegócio..."

                style={INPUT}

                maxLength={80}

              />

            </div>

          )}



          <div>

            <label style={LABEL}>Telefone *</label>

            <input

              value={form.telefone}

              onChange={(e) => campo("telefone", e.target.value)}

              placeholder="(11) 99999-9999"

              style={INPUT}

              inputMode="tel"

            />

          </div>



          <div>

            <label style={LABEL}>E-mail</label>

            <input

              type="email"

              value={form.email}

              onChange={(e) => campo("email", e.target.value)}

              placeholder="contato@exemplo.com"

              style={INPUT}

            />

          </div>



          <div style={SECTION}>

            <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#c9a24a", textTransform: "uppercase", letterSpacing: "0.06em" }}>

              Localização

            </p>



            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>

              <div style={{ flex: 1 }}>

                <label style={LABEL}>CEP</label>

                <input

                  value={form.cep}

                  onChange={(e) => campo("cep", formatarCepMascara(e.target.value))}

                  onBlur={onCepBlur}

                  placeholder="00000-000"

                  style={INPUT}

                  inputMode="numeric"

                  maxLength={9}

                />

              </div>

              <button

                type="button"

                onClick={() => void buscarCep()}

                disabled={buscandoCep || loading}

                style={{

                  padding: "12px 14px",

                  borderRadius: 10,

                  border: "1px solid #c9a24a44",

                  background: "#c9a24a14",

                  color: "#c9a24a",

                  fontSize: 12,

                  fontWeight: 700,

                  cursor: buscandoCep || loading ? "not-allowed" : "pointer",

                  whiteSpace: "nowrap",

                }}

              >

                {buscandoCep ? "Buscando..." : "Buscar CEP"}

              </button>

            </div>

            {cepErro && <p style={{ color: "#ef4444", fontSize: 11, margin: "6px 0 0" }}>{cepErro}</p>}



            <div style={{ marginTop: 12 }}>

              <label style={LABEL}>Logradouro</label>

              <input

                value={form.logradouro}

                onChange={(e) => campo("logradouro", e.target.value)}

                placeholder="Rua, avenida..."

                style={INPUT}

              />

            </div>



            <div style={{ marginTop: 12 }}>

              <label style={LABEL}>Bairro</label>

              <input

                value={form.bairro}

                onChange={(e) => campo("bairro", e.target.value)}

                placeholder="Bairro"

                style={INPUT}

              />

            </div>



            <div style={{ display: "grid", gridTemplateColumns: "1fr 72px", gap: 10, marginTop: 12 }}>

              <div>

                <label style={LABEL}>Cidade</label>

                <input

                  value={form.cidade}

                  onChange={(e) => campo("cidade", e.target.value)}

                  placeholder="São Paulo"

                  style={INPUT}

                />

              </div>

              <div>

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



          {erro && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{erro}</p>}



          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>

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

              onClick={salvar}

              disabled={loading}

              style={{

                flex: 1,

                padding: "12px",

                borderRadius: 10,

                border: "none",

                background: loading ? "#30363d" : "#003b26",

                color: loading ? "#8b949e" : "#c9a24a",

                fontSize: 13,

                fontWeight: 800,

                cursor: loading ? "not-allowed" : "pointer",

              }}

            >

              {loading ? "Salvando..." : "Salvar cliente"}

            </button>

          </div>

        </div>

      </div>

    </div>

  );

}


