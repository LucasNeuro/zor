"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { MERCADOS_PREFIXO_OPTIONS } from "@/lib/crm/negocio-cadastro";
import {
  linkParceiroReutilizavel,
  PARCEIRO_LINK_TOKEN_REDE,
} from "@/lib/crm/parceiro-link-publico";

type Etapa = "verificando" | "formulario" | "enviado" | "expirado" | "erro";
type TipoPessoa = "PF" | "PJ";
type PerfilParceiro =
  | "corretor_imobiliario"
  | "arquiteto_projetista"
  | "fornecedor_produtos"
  | "prestador_servicos"
  | "parceiro_indicacao";

const PERFIS: { id: PerfilParceiro; label: string; mercadoSugerido: string }[] = [
  { id: "corretor_imobiliario", label: "Corretor de imóveis", mercadoSugerido: "IMB" },
  { id: "arquiteto_projetista", label: "Arquiteto / projetista", mercadoSugerido: "ARQ" },
  { id: "fornecedor_produtos", label: "Fornecedor de produtos", mercadoSugerido: "FOR" },
  { id: "prestador_servicos", label: "Prestador de serviços", mercadoSugerido: "SRV" },
  { id: "parceiro_indicacao", label: "Parceiro / indicador", mercadoSugerido: "IMB" },
];

export default function CadastroParceiro() {
  const params = useParams();
  const token = params.token as string;

  const [etapa, setEtapa] = useState<Etapa>("verificando");
  const [linkData, setLinkData] = useState<Record<string, unknown>>({});
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");

  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("PF");
  const [perfil, setPerfil] = useState<PerfilParceiro>("corretor_imobiliario");
  const [codigoGerado, setCodigoGerado] = useState("");
  const [form, setForm] = useState({
    nome: "",
    razao_social: "",
    email: "",
    telefone: "",
    cpf: "",
    cnpj: "",
    mercado: "FOR",
    cidade: "",
    estado: "",
  });

  useEffect(() => {
    async function verificarToken() {
      const { data, error } = await supabase
        .from("hub_links_cadastro")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (token === PARCEIRO_LINK_TOKEN_REDE) {
        setLinkData({ id: "rede", metadata: { reutilizavel: true, tipo_link: "rede_publica" } });
        setEtapa("formulario");
        return;
      }

      if (error || !data) {
        setEtapa("erro");
        return;
      }

      const meta = (data.metadata as Record<string, unknown>) || {};
      const reutilizavel = linkParceiroReutilizavel(meta);

      if (!reutilizavel && data.usado_em) {
        setEtapa("expirado");
        return;
      }
      if (!reutilizavel && new Date(data.expira_em as string) < new Date()) {
        setEtapa("expirado");
        return;
      }

      setLinkData(data);
      setForm((f) => ({
        ...f,
        nome: (meta.nome as string) || "",
        email: (meta.email as string) || "",
      }));
      setEtapa("formulario");
    }
    verificarToken();
  }, [token]);

  function campo(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function labelPerfil(): string {
    return PERFIS.find((p) => p.id === perfil)?.label ?? "Parceiro";
  }

  function labelMercado(): string {
    return MERCADOS_PREFIXO_OPTIONS.find((m) => m.value === form.mercado)?.label ?? form.mercado;
  }

  async function enviar() {
    const nomeExibir = tipoPessoa === "PJ" ? form.razao_social.trim() : form.nome.trim();
    if (!nomeExibir || !form.telefone.trim()) {
      setErroForm(
        tipoPessoa === "PJ"
          ? "Preencha razão social e telefone."
          : "Preencha nome completo e telefone."
      );
      return;
    }
    setSalvando(true);
    setErroForm("");

    const especialidade = `${labelPerfil()} · ${labelMercado()}`;

    const res = await fetch("/api/parceiro/cadastro-publico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_pessoa: tipoPessoa,
        perfil,
        nome: tipoPessoa === "PF" ? form.nome.trim() : undefined,
        razao_social: tipoPessoa === "PJ" ? form.razao_social.trim() : undefined,
        nome_contato: tipoPessoa === "PJ" ? form.nome.trim() || undefined : undefined,
        telefone: form.telefone,
        email: form.email,
        cpf: form.cpf,
        cnpj: form.cnpj,
        mercado: form.mercado,
        cidade: form.cidade,
        estado: form.estado,
        especialidade,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      erro?: string;
      codigo?: string;
    };

    if (!res.ok) {
      setErroForm(data.erro || "Erro ao salvar. Tente novamente.");
      setSalvando(false);
      return;
    }

    setCodigoGerado(data.codigo || "");
    setEtapa("enviado");
    setSalvando(false);
  }

  if (etapa === "verificando") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0d1117",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#8b949e", fontSize: 14 }}>Verificando link...</p>
      </div>
    );
  }

  if (etapa === "expirado") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0d1117",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
        <h1 style={{ color: "#e6edf3", fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
          Link expirado
        </h1>
        <p style={{ color: "#8b949e", fontSize: 14 }}>
          Este link já foi usado ou expirou. Solicite um novo link ao responsável.
        </p>
      </div>
    );
  }

  if (etapa === "erro") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0d1117",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
        <h1 style={{ color: "#e6edf3", fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
          Link inválido
        </h1>
        <p style={{ color: "#8b949e", fontSize: 14 }}>
          Este link não existe. Verifique com quem enviou o convite.
        </p>
      </div>
    );
  }

  if (etapa === "enviado") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0d1117",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "#003b26",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            marginBottom: 20,
          }}
        >
          ✓
        </div>
        <h1 style={{ color: "#e6edf3", fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>
          Cadastro enviado!
        </h1>
        <p style={{ color: "#8b949e", fontSize: 14, maxWidth: 320, lineHeight: 1.6 }}>
          Seu cadastro foi recebido. Guarde o seu código na rede:
        </p>
        {codigoGerado ? (
          <div
            style={{
              marginTop: 16,
              padding: "14px 20px",
              borderRadius: 12,
              background: "#161b22",
              border: "1px solid #c9a24a40",
            }}
          >
            <p style={{ margin: 0, fontSize: 11, color: "#8b949e" }}>Seu código</p>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 22,
                fontWeight: 800,
                color: "#c9a24a",
                fontFamily: "monospace",
                letterSpacing: 1,
              }}
            >
              {codigoGerado}
            </p>
          </div>
        ) : null}
        <p style={{ color: "#6e7781", fontSize: 12, maxWidth: 320, marginTop: 16, lineHeight: 1.5 }}>
          A equipe OBRA10+ analisa e entra em contato em breve.
        </p>
      </div>
    );
  }

  const INPUT = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #30363d",
    background: "#161b22",
    color: "#e6edf3",
    fontSize: 14,
    boxSizing: "border-box" as const,
  };

  const btnTipo = (t: TipoPessoa) => ({
    flex: 1,
    padding: "12px",
    borderRadius: 10,
    border: `2px solid ${tipoPessoa === t ? "#c9a24a" : "#30363d"}`,
    background: tipoPessoa === t ? "rgba(201,162,74,0.12)" : "#161b22",
    color: "#e6edf3",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  });

  return (
    <div
      style={{
        background: "#0d1117",
        minHeight: "100vh",
        padding: "1.5rem",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <p
          style={{
            color: "#c9a24a",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: "0.06em",
            margin: "0 0 8px",
          }}
        >
          OBRA10+
        </p>
        <h1 style={{ color: "#e6edf3", fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>
          Cadastro de Parceiro
        </h1>
        <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>
          Indique como vai actuar na rede.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label
            style={{
              color: "#8b949e",
              fontSize: 12,
              fontWeight: 600,
              display: "block",
              marginBottom: 8,
            }}
          >
            Você é *
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setTipoPessoa("PF")} style={btnTipo("PF")}>
              Pessoa física
            </button>
            <button type="button" onClick={() => setTipoPessoa("PJ")} style={btnTipo("PJ")}>
              Pessoa jurídica
            </button>
          </div>
        </div>

        <div>
          <label
            style={{
              color: "#8b949e",
              fontSize: 12,
              fontWeight: 600,
              display: "block",
              marginBottom: 6,
            }}
          >
            Como vai participar? *
          </label>
          <select
            value={perfil}
            onChange={(e) => {
              const v = e.target.value as PerfilParceiro;
              const p = PERFIS.find((x) => x.id === v);
              setPerfil(v);
              if (p) campo("mercado", p.mercadoSugerido);
            }}
            style={INPUT}
          >
            {PERFIS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              color: "#8b949e",
              fontSize: 12,
              fontWeight: 600,
              display: "block",
              marginBottom: 6,
            }}
          >
            Mercado principal *
          </label>
          <select value={form.mercado} onChange={(e) => campo("mercado", e.target.value)} style={INPUT}>
            {MERCADOS_PREFIXO_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label} ({m.value})
              </option>
            ))}
          </select>
        </div>

        {tipoPessoa === "PJ" ? (
          <>
            <div>
              <label
                style={{
                  color: "#8b949e",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Razão social *
              </label>
              <input
                value={form.razao_social}
                onChange={(e) => campo("razao_social", e.target.value)}
                placeholder="Empresa Ltda"
                style={INPUT}
              />
            </div>
            <div>
              <label
                style={{
                  color: "#8b949e",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                CNPJ (opcional)
              </label>
              <input
                value={form.cnpj}
                onChange={(e) => campo("cnpj", e.target.value)}
                placeholder="00.000.000/0000-00"
                style={INPUT}
              />
            </div>
            <div>
              <label
                style={{
                  color: "#8b949e",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Nome do contato
              </label>
              <input
                value={form.nome}
                onChange={(e) => campo("nome", e.target.value)}
                placeholder="Responsável pelo cadastro"
                style={INPUT}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label
                style={{
                  color: "#8b949e",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Nome completo *
              </label>
              <input
                value={form.nome}
                onChange={(e) => campo("nome", e.target.value)}
                placeholder="Seu nome"
                style={INPUT}
              />
            </div>
            <div>
              <label
                style={{
                  color: "#8b949e",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                CPF
              </label>
              <input
                value={form.cpf}
                onChange={(e) => campo("cpf", e.target.value)}
                placeholder="000.000.000-00"
                style={INPUT}
              />
            </div>
          </>
        )}

        <div>
          <label
            style={{
              color: "#8b949e",
              fontSize: 12,
              fontWeight: 600,
              display: "block",
              marginBottom: 6,
            }}
          >
            Telefone / WhatsApp *
          </label>
          <input
            value={form.telefone}
            onChange={(e) => campo("telefone", e.target.value)}
            placeholder="(11) 99999-9999"
            type="tel"
            style={INPUT}
          />
        </div>
        <div>
          <label
            style={{
              color: "#8b949e",
              fontSize: 12,
              fontWeight: 600,
              display: "block",
              marginBottom: 6,
            }}
          >
            E-mail
          </label>
          <input
            value={form.email}
            onChange={(e) => campo("email", e.target.value)}
            placeholder="email@exemplo.com"
            type="email"
            style={INPUT}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label
              style={{
                color: "#8b949e",
                fontSize: 12,
                fontWeight: 600,
                display: "block",
                marginBottom: 6,
              }}
            >
              Cidade
            </label>
            <input
              value={form.cidade}
              onChange={(e) => campo("cidade", e.target.value)}
              placeholder="São Paulo"
              style={INPUT}
            />
          </div>
          <div>
            <label
              style={{
                color: "#8b949e",
                fontSize: 12,
                fontWeight: 600,
                display: "block",
                marginBottom: 6,
              }}
            >
              Estado
            </label>
            <select value={form.estado} onChange={(e) => campo("estado", e.target.value)} style={INPUT}>
              <option value="">UF</option>
              {[
                "AC",
                "AL",
                "AP",
                "AM",
                "BA",
                "CE",
                "DF",
                "ES",
                "GO",
                "MA",
                "MT",
                "MS",
                "MG",
                "PA",
                "PB",
                "PR",
                "PE",
                "PI",
                "RJ",
                "RN",
                "RS",
                "RO",
                "RR",
                "SC",
                "SP",
                "SE",
                "TO",
              ].map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
        </div>

        {erroForm && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{erroForm}</p>}

        <button
          type="button"
          onClick={() => void enviar()}
          disabled={salvando}
          style={{
            padding: "14px",
            borderRadius: 12,
            border: "none",
            cursor: salvando ? "not-allowed" : "pointer",
            background: salvando ? "#30363d" : "#c9a24a",
            color: salvando ? "#8b949e" : "#0d1117",
            fontWeight: 800,
            fontSize: 15,
            marginTop: 4,
          }}
        >
          {salvando ? "Enviando..." : "Enviar cadastro"}
        </button>

        <p style={{ color: "#484f58", fontSize: 11, textAlign: "center", lineHeight: 1.5 }}>
          Após envio, o cadastro fica pendente até homologação pela equipa OBRA10+.
        </p>
      </div>
    </div>
  );
}
