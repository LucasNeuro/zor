"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { labelEmpresaSegmento } from "@/lib/crm/empresa-cadastro";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";
import { formatarCnpjMascara } from "@/lib/crm/documento-brasil";
import { formatarCepMascara } from "@/lib/crm/viacep";
import {
  CadastroFichaTabs,
  type CadastroFichaTabId,
} from "@/components/crm/cadastro/CadastroFichaTabs";
import Link from "next/link";

type EmpresaDetalhe = {
  id: string;
  codigo: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  segmento: string | null;
  prefixo_mercado: string | null;
  cep: string | null;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean | null;
  acesso_habilitado: boolean | null;
  acesso_habilitado_em: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

function formatData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#5d7a67", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 14, color: "#0b2210", lineHeight: 1.4 }}>{value}</p>
    </div>
  );
}

export default function EmpresaDetalhePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [empresa, setEmpresa] = useState<EmpresaDetalhe | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvandoAcesso, setSalvandoAcesso] = useState(false);
  const [editando, setEditando] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [tab, setTab] = useState<CadastroFichaTabId>("resumo");
  const [vinculos, setVinculos] = useState<{
    pessoas: Array<{
      pessoa_id: string;
      codigo: string | null;
      nome: string;
      cargo: string | null;
    }>;
    negocios: Array<{ id: string; codigo: string | null; titulo: string }>;
  } | null>(null);

  const carregar = useCallback(async () => {
    setErro("");
    setCarregando(true);
    try {
      const res = await fetch(`/api/crm/empresas/${encodeURIComponent(id)}`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: EmpresaDetalhe;
        error?: string;
      };
      if (!res.ok) {
        setErro(json.error || "Não foi possível carregar a empresa.");
        setEmpresa(null);
        return;
      }
      setEmpresa(json.data ?? null);
    } catch {
      setErro("Erro de rede ao carregar.");
      setEmpresa(null);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (tab !== "vinculos" && tab !== "relacionados") return;
    void (async () => {
      const res = await fetch(`/api/crm/empresas/${encodeURIComponent(id)}/vinculos`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: typeof vinculos };
      if (res.ok && json.data) setVinculos(json.data);
    })();
  }, [id, tab]);

  async function alternarAcesso() {
    if (!empresa) return;
    setSalvandoAcesso(true);
    setErro("");
    const novo = !empresa.acesso_habilitado;
    try {
      const res = await fetch(`/api/crm/empresas/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ acesso_habilitado: novo }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: EmpresaDetalhe;
        error?: string;
      };
      if (!res.ok) {
        setErro(json.error || "Não foi possível atualizar o acesso.");
        return;
      }
      setEmpresa(json.data ?? null);
    } catch {
      setErro("Erro de rede ao atualizar acesso.");
    } finally {
      setSalvandoAcesso(false);
    }
  }

  async function salvarEdicao() {
    if (!empresa) return;
    setSalvandoEdicao(true);
    const res = await fetch(`/api/crm/empresas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({
        razao_social: empresa.razao_social,
        nome_fantasia: empresa.nome_fantasia,
        cnpj: empresa.cnpj,
        email: empresa.email,
        telefone: empresa.telefone,
        segmento: empresa.segmento,
      }),
    });
    setSalvandoEdicao(false);
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
          background: "#f8fcf6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#5d7a67", fontSize: 13 }}>Carregando...</p>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div style={{ minHeight: "100%", background: "#f8fcf6", padding: 24 }}>
        <button
          type="button"
          onClick={() => router.push("/crm/empresas")}
          style={{
            background: "none",
            border: "none",
            color: "#5d7a67",
            cursor: "pointer",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          ← Voltar para empresas
        </button>
        <p style={{ color: "#ef4444", fontSize: 13 }}>{erro || "Empresa não encontrada."}</p>
      </div>
    );
  }

  const acessoAtivo = empresa.acesso_habilitado !== false;
  const endereco = [
    empresa.logradouro,
    empresa.bairro,
    empresa.cidade && empresa.estado
      ? `${empresa.cidade}/${empresa.estado}`
      : empresa.cidade || empresa.estado,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={{ minHeight: "100%", background: "#f8fcf6" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#ffffff",
          borderBottom: "1px solid #dcebd8",
          padding: "14px 20px",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/crm/empresas")}
          style={{
            background: "none",
            border: "none",
            color: "#5d7a67",
            cursor: "pointer",
            fontSize: 13,
            marginBottom: 10,
            padding: 0,
          }}
        >
          ← Empresas
        </button>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            {editando ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={empresa.razao_social} onChange={(e) => setEmpresa((x) => (x ? { ...x, razao_social: e.target.value } : x))} placeholder="Razão social" style={{ padding: 8, borderRadius: 8, border: "1px solid #dcebd8", background: "#f8fcf6", color: "#0b2210" }} />
                <input value={empresa.nome_fantasia ?? ""} onChange={(e) => setEmpresa((x) => (x ? { ...x, nome_fantasia: e.target.value } : x))} placeholder="Nome fantasia" style={{ padding: 8, borderRadius: 8, border: "1px solid #dcebd8", background: "#f8fcf6", color: "#0b2210" }} />
                <input value={empresa.cnpj ?? ""} onChange={(e) => setEmpresa((x) => (x ? { ...x, cnpj: e.target.value } : x))} placeholder="CNPJ" style={{ padding: 8, borderRadius: 8, border: "1px solid #dcebd8", background: "#f8fcf6", color: "#0b2210" }} />
                <button type="button" disabled={salvandoEdicao} onClick={() => void salvarEdicao()} style={{ padding: "8px 12px", borderRadius: 8, background: "#c9a24a", color: "#003b26", border: "none", fontWeight: 700, cursor: "pointer" }}>{salvandoEdicao ? "Salvando…" : "Guardar"}</button>
              </div>
            ) : (
              <>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0b2210" }}>
                  {empresa.razao_social}
                </h1>
                {empresa.nome_fantasia && (
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#5d7a67" }}>{empresa.nome_fantasia}</p>
                )}
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#5d7a67" }}>
                  {empresa.codigo || "—"}
                  {empresa.cnpj ? ` · CNPJ ${formatarCnpjMascara(empresa.cnpj)}` : ""}
                </p>
              </>
            )}
          </div>
          {!editando && (
            <button type="button" onClick={() => setEditando(true)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #dcebd8", background: "#eef7eb", color: "#c9a24a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Editar
            </button>
          )}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 20,
                background: acessoAtivo ? "#22c55e22" : "#5d7a6722",
                color: acessoAtivo ? "#22c55e" : "#5d7a67",
                border: `1px solid ${acessoAtivo ? "#22c55e55" : "#5d7a6755"}`,
              }}
            >
              {acessoAtivo ? "Acesso habilitado" : "Acesso desabilitado"}
            </span>
            <button
              type="button"
              onClick={() => void alternarAcesso()}
              disabled={salvandoAcesso}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #dcebd8",
                background: acessoAtivo ? "transparent" : "#003b26",
                color: acessoAtivo ? "#5d7a67" : "#c9a24a",
                fontSize: 12,
                fontWeight: 700,
                cursor: salvandoAcesso ? "wait" : "pointer",
              }}
            >
              {salvandoAcesso
                ? "Salvando..."
                : acessoAtivo
                  ? "Desabilitar acesso"
                  : "Habilitar acesso"}
            </button>
          </div>
        </div>
        {erro && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#ef4444" }}>{erro}</p>
        )}
      </div>

      <div style={{ padding: "12px 24px 32px", maxWidth: 960 }}>
        <CadastroFichaTabs active={tab} onChange={setTab}>
          {tab === "resumo" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 20,
              }}
            >
              <Campo label="Código" value={empresa.codigo || "—"} />
              <Campo label="Mercado" value={labelMercadoPrefixo(empresa.prefixo_mercado)} />
              <Campo label="Segmento" value={labelEmpresaSegmento(empresa.segmento)} />
              <Campo label="E-mail" value={empresa.email || "—"} />
              <Campo label="Telefone" value={empresa.telefone || "—"} />
              <Campo
                label="Homologação / status"
                value={empresa.ativo === false ? "Arquivada" : "Ativa (cadastro)"}
              />
            </div>
          )}
          {tab === "dados" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 20,
                  marginBottom: 24,
                }}
              >
                <Campo label="Acesso desde" value={formatData(empresa.acesso_habilitado_em)} />
                <Campo label="Cadastrada em" value={formatData(empresa.criado_em)} />
                <Campo label="Atualizada em" value={formatData(empresa.atualizado_em)} />
              </div>
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: "1px solid #dcebd8",
                  background: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0b2210" }}>Endereço</p>
                <Campo label="CEP" value={empresa.cep ? formatarCepMascara(empresa.cep) : "—"} />
                <Campo label="Endereço completo" value={endereco || "—"} />
              </div>
            </>
          )}
          {tab === "vinculos" && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {(vinculos?.pessoas ?? []).length === 0 ? (
                <li style={{ color: "#5d7a67", fontSize: 13 }}>Nenhuma pessoa vinculada.</li>
              ) : (
                vinculos?.pessoas.map((p) => (
                  <li
                    key={p.pessoa_id}
                    style={{ padding: "12px 0", borderBottom: "1px solid #dcebd8" }}
                  >
                    <Link
                      href={`/crm/pessoas/${p.pessoa_id}`}
                      style={{ color: "#c9a24a", fontWeight: 600, textDecoration: "none" }}
                    >
                      {p.codigo ? `${p.codigo} · ` : ""}
                      {p.nome}
                    </Link>
                    {p.cargo ? (
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#5d7a67" }}>{p.cargo}</p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          )}
          {tab === "relacionados" && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {(vinculos?.negocios ?? []).length === 0 ? (
                <li style={{ color: "#5d7a67", fontSize: 13 }}>Nenhum negócio vinculado.</li>
              ) : (
                vinculos?.negocios.map((n) => (
                  <li key={n.id} style={{ padding: "8px 0", borderBottom: "1px solid #dcebd8" }}>
                    <Link
                      href={`/crm/negocios?destaque=${n.id}`}
                      style={{ color: "#c9a24a", textDecoration: "none", fontWeight: 600 }}
                    >
                      {n.codigo ? `${n.codigo} · ` : ""}
                      {n.titulo}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          )}
        </CadastroFichaTabs>
      </div>
    </div>
  );
}
