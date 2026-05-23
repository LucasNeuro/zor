"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { labelAreaAtuacao } from "@/lib/crm/areas-atuacao";
import {
  formatarCnpjMascara,
  formatarCpfMascara,
} from "@/lib/crm/documento-brasil";
import { formatarCepMascara } from "@/lib/crm/viacep";

type PessoaDetalhe = {
  id: string;
  codigo: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  documento: string | null;
  tipo: string;
  tipo_pessoa: string | null;
  empresa: string | null;
  origem: string | null;
  area_atuacao: string | null;
  cep: string | null;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

function formatData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function formatDocumento(p: PessoaDetalhe): string {
  if (!p.documento) return "—";
  if (p.tipo_pessoa === "PJ") return formatarCnpjMascara(p.documento);
  if (p.tipo_pessoa === "PF") return formatarCpfMascara(p.documento);
  const d = p.documento.replace(/\D/g, "");
  if (d.length === 14) return formatarCnpjMascara(d);
  if (d.length === 11) return formatarCpfMascara(d);
  return p.documento;
}

function labelTipoPessoa(tipo: string | null): string {
  if (tipo === "PF") return "Pessoa Física";
  if (tipo === "PJ") return "Pessoa Jurídica";
  return tipo || "—";
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          color: "#8b949e",
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 14, color: "#e6edf3", lineHeight: 1.4 }}>
        {value}
      </p>
    </div>
  );
}

export default function PessoaDetalhePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [pessoa, setPessoa] = useState<PessoaDetalhe | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro("");
    setCarregando(true);
    try {
      const res = await fetch(`/api/crm/pessoas/${encodeURIComponent(id)}`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: PessoaDetalhe;
        error?: string;
      };
      if (!res.ok) {
        setErro(json.error || "Não foi possível carregar o cadastro.");
        setPessoa(null);
        return;
      }
      setPessoa(json.data ?? null);
    } catch {
      setErro("Erro de rede ao carregar.");
      setPessoa(null);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvarEdicao() {
    if (!pessoa) return;
    setSalvando(true);
    const res = await fetch(`/api/crm/pessoas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({
        nome: pessoa.nome,
        telefone: pessoa.telefone,
        email: pessoa.email,
        cidade: pessoa.cidade,
        estado: pessoa.estado,
      }),
    });
    setSalvando(false);
    if (res.ok) {
      setEditando(false);
      void carregar();
    }
  }

  if (carregando) {
    return (
      <div
        style={{
          minHeight: "100%",
          background: "#0d1117",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando...</p>
      </div>
    );
  }

  if (!pessoa) {
    return (
      <div style={{ minHeight: "100%", background: "#0d1117", padding: 24 }}>
        <button
          type="button"
          onClick={() => router.push("/crm/pessoas")}
          style={{
            background: "none",
            border: "none",
            color: "#8b949e",
            cursor: "pointer",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          ← Voltar para pessoas
        </button>
        <p style={{ color: "#ef4444", fontSize: 13 }}>{erro || "Cadastro não encontrado."}</p>
      </div>
    );
  }

  const docLabel = pessoa.tipo_pessoa === "PJ" ? "CNPJ" : pessoa.tipo_pessoa === "PF" ? "CPF" : "Documento";
  const endereco = [
    pessoa.logradouro,
    pessoa.bairro,
    pessoa.cidade && pessoa.estado
      ? `${pessoa.cidade}/${pessoa.estado}`
      : pessoa.cidade || pessoa.estado,
  ]
    .filter(Boolean)
    .join(" · ");

  const tipoCor =
    pessoa.tipo_pessoa === "PF" ? "#3b82f6" : pessoa.tipo_pessoa === "PJ" ? "#10b981" : "#8b949e";

  return (
    <div style={{ minHeight: "100%", background: "#0d1117" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#161b22",
          borderBottom: "1px solid #30363d",
          padding: "14px 20px",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/crm/pessoas")}
          style={{
            background: "none",
            border: "none",
            color: "#8b949e",
            cursor: "pointer",
            fontSize: 13,
            marginBottom: 10,
            padding: 0,
          }}
        >
          ← Pessoas
        </button>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            {editando ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  value={pessoa.nome}
                  onChange={(e) => setPessoa((p) => (p ? { ...p, nome: e.target.value } : p))}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }}
                />
                <input
                  value={pessoa.telefone ?? ""}
                  onChange={(e) => setPessoa((p) => (p ? { ...p, telefone: e.target.value } : p))}
                  placeholder="Telefone"
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }}
                />
                <input
                  value={pessoa.email ?? ""}
                  onChange={(e) => setPessoa((p) => (p ? { ...p, email: e.target.value } : p))}
                  placeholder="E-mail"
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }}
                />
                <button type="button" disabled={salvando} onClick={() => void salvarEdicao()} style={{ padding: "8px 12px", borderRadius: 8, background: "#c9a24a", color: "#003b26", border: "none", fontWeight: 700, cursor: "pointer" }}>
                  {salvando ? "Salvando…" : "Guardar"}
                </button>
              </div>
            ) : (
              <>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#e6edf3" }}>
                  {pessoa.nome}
                </h1>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8b949e" }}>
                  {pessoa.codigo || "—"}
                  {pessoa.telefone ? ` · ${pessoa.telefone}` : ""}
                </p>
              </>
            )}
          </div>
          {!editando && (
            <button type="button" onClick={() => setEditando(true)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #30363d", background: "#21262d", color: "#c9a24a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Editar
            </button>
          )}
          {pessoa.tipo_pessoa && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 20,
                background: `${tipoCor}22`,
                color: tipoCor,
                border: `1px solid ${tipoCor}55`,
              }}
            >
              {pessoa.tipo_pessoa}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          padding: "20px 24px 32px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 20,
          maxWidth: 960,
        }}
      >
        <Campo label="Tipo" value={labelTipoPessoa(pessoa.tipo_pessoa)} />
        <Campo label={docLabel} value={formatDocumento(pessoa)} />
        <Campo label="E-mail" value={pessoa.email || "—"} />
        <Campo label="Telefone" value={pessoa.telefone || "—"} />
        {pessoa.tipo_pessoa === "PJ" && (
          <Campo label="Empresa (razão social)" value={pessoa.empresa || "—"} />
        )}
        <Campo label="Área de atuação" value={labelAreaAtuacao(pessoa.area_atuacao || "")} />
        <Campo label="Origem" value={pessoa.origem || "—"} />
        <Campo label="Perfil" value={pessoa.tipo || "—"} />
        <Campo label="Cadastrado em" value={formatData(pessoa.criado_em)} />
        <Campo label="Atualizado em" value={formatData(pessoa.atualizado_em)} />
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 640 }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#e6edf3" }}>
          Endereço
        </h2>
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            border: "1px solid #30363d",
            background: "#161b22",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <Campo label="CEP" value={pessoa.cep ? formatarCepMascara(pessoa.cep) : "—"} />
          <Campo label="Endereço completo" value={endereco || "—"} />
        </div>
      </div>
    </div>
  );
}
