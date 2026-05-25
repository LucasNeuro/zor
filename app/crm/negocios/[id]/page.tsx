"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";

type NegocioDetalhe = {
  id: string;
  codigo: string | null;
  titulo: string;
  descricao: string | null;
  prefixo_mercado: string;
  status: string;
  etapa: string;
  valor_estimado: number | null;
  valor_fechado: number | null;
  lead_id: string | null;
  pessoa_id: string | null;
  criado_em: string | null;
};

type TimelineItem = {
  id: string;
  tipo: string;
  descricao: string;
  criado_em: string;
};

function formatCurrency(v: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function NegocioDetalhePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [negocio, setNegocio] = useState<NegocioDetalhe | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [leadNome, setLeadNome] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ titulo: "", descricao: "", valor_estimado: "" });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro("");
    setCarregando(true);
    try {
      const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json()) as {
        data?: NegocioDetalhe;
        timeline?: TimelineItem[];
        lead?: { nome: string } | null;
        error?: string;
      };
      if (!res.ok) {
        setErro(json.error || "Não foi possível carregar.");
        return;
      }
      const n = json.data ?? null;
      setNegocio(n);
      if (n) {
        setForm({
          titulo: n.titulo,
          descricao: n.descricao ?? "",
          valor_estimado: n.valor_estimado != null ? String(n.valor_estimado) : "",
        });
      }
      setTimeline(json.timeline ?? []);
      setLeadNome(json.lead?.nome ?? null);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvarEdicao() {
    setSalvando(true);
    const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({
        titulo: form.titulo.trim(),
        descricao: form.descricao || null,
        valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
      }),
    });
    setSalvando(false);
    if (res.ok) {
      setEditando(false);
      void carregar();
    }
  }

  async function arquivar() {
    if (!confirm("Arquivar este negócio (status cancelado)?")) return;
    await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ status: "cancelado" }),
    });
    void carregar();
  }

  async function mudarEtapa(novaEtapa: string) {
    const res = await fetch(`/api/crm/negocios/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ etapa: novaEtapa }),
    });
    if (res.ok) void carregar();
  }

  if (carregando) {
    return <p style={{ padding: 24, color: "#8b949e" }}>Carregando...</p>;
  }

  if (!negocio) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#ef4444" }}>{erro || "Negócio não encontrado."}</p>
        <button type="button" onClick={() => router.push("/crm/negocios")} style={{ marginTop: 12 }}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, color: "#e6edf3" }}>
      <button
        type="button"
        onClick={() => router.push("/crm/negocios")}
        style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", marginBottom: 16 }}
      >
        ← Negócios
      </button>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, flex: 1 }}>{negocio.titulo}</h1>
        <button type="button" onClick={() => setEditando((e) => !e)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #30363d", background: "#21262d", color: "#c9a24a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {editando ? "Cancelar" : "Editar"}
        </button>
        <button type="button" onClick={() => void arquivar()} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #f8514944", background: "transparent", color: "#f85149", fontSize: 12, cursor: "pointer" }}>
          Arquivar
        </button>
      </div>
      <p style={{ margin: 0, color: "#8b949e", fontFamily: "monospace" }}>{negocio.codigo}</p>

      {editando && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 12, border: "1px solid #30363d", background: "#161b22" }}>
          <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Título" style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }} />
          <textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descrição" style={{ width: "100%", marginBottom: 8, minHeight: 80, padding: 10, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }} />
          <input value={form.valor_estimado} onChange={(e) => setForm((f) => ({ ...f, valor_estimado: e.target.value }))} placeholder="Valor estimado" type="number" style={{ width: "100%", marginBottom: 8, padding: 10, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3" }} />
          <button type="button" disabled={salvando} onClick={() => void salvarEdicao()} style={{ padding: "10px 16px", borderRadius: 8, background: "#c9a24a", color: "#003b26", border: "none", fontWeight: 700, cursor: "pointer" }}>
            {salvando ? "Salvando…" : "Guardar"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 12, fontSize: 12 }}>
        <Link href={`/crm/projetos?negocio_id=${negocio.id}`} style={{ color: "#c9a24a", fontWeight: 700 }}>Projetos</Link>
        <Link href="/crm/obras" style={{ color: "#8b949e" }}>Obras</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
        <div>
          <p style={{ fontSize: 11, color: "#8b949e" }}>MERCADO</p>
          <p>{labelMercadoPrefixo(negocio.prefixo_mercado)}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: "#8b949e" }}>VALOR ESTIMADO</p>
          <p style={{ color: "#c9a24a", fontWeight: 700 }}>{formatCurrency(negocio.valor_estimado)}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: "#8b949e" }}>ETAPA</p>
          <p style={{ textTransform: "capitalize" }}>{negocio.etapa}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: "#8b949e" }}>STATUS</p>
          <p>{negocio.status}</p>
        </div>
      </div>

      {leadNome && negocio.lead_id && (
        <p style={{ marginTop: 16 }}>
          Lead:{" "}
          <Link href={`/crm/leads/${negocio.lead_id}`} style={{ color: "#60a5fa" }}>
            {leadNome}
          </Link>
        </p>
      )}

      <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["novo", "qualificando", "qualificado", "proposta", "negociando", "fechamento", "ganho", "perdido"].map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => mudarEtapa(e)}
            disabled={negocio.etapa === e}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #30363d",
              background: negocio.etapa === e ? "#003b26" : "#161b22",
              color: negocio.etapa === e ? "#c9a24a" : "#e6edf3",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {e}
          </button>
        ))}
      </div>

      <h2 style={{ marginTop: 32, fontSize: 16 }}>Timeline</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {timeline.length === 0 ? (
          <li style={{ color: "#8b949e", fontSize: 13 }}>Sem atividades.</li>
        ) : (
          timeline.map((a) => (
            <li
              key={a.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid #21262d",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#8b949e", marginRight: 8 }}>
                {new Date(a.criado_em).toLocaleString("pt-BR")}
              </span>
              {a.descricao}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
