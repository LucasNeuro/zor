"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Profissional {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  especialidade: string;
  mercado: string | null;
  cidade: string | null;
  estado: string | null;
  status: string;
  comissao_pct: number;
  total_encaminhamentos: number;
  total_fechamentos: number;
  criado_em: string;
}

const STATUS_COR: Record<string, string> = {
  pendente: "#c9a24a",
  ativo: "#34d399",
  inativo: "#8b949e",
  rejeitado: "#ef4444",
};

export default function ParceirosPage() {
  const router = useRouter();
  const [parceiros, setParceiros] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [atualizando, setAtualizando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("hub_profissionais")
      .select("*")
      .order("criado_em", { ascending: false });
    setParceiros(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function atualizarStatus(id: string, status: string) {
    setAtualizando(id);
    await supabase.from("hub_profissionais").update({
      status,
      aprovado_em: status === "ativo" ? new Date().toISOString() : null,
      aprovado_por: "gestor",
      atualizado_em: new Date().toISOString(),
    }).eq("id", id);
    await carregar();
    setAtualizando(null);
  }

  const filtrados = filtroStatus === "todos"
    ? parceiros
    : parceiros.filter(p => p.status === filtroStatus);

  const contagens = {
    todos: parceiros.length,
    pendente: parceiros.filter(p => p.status === "pendente").length,
    ativo: parceiros.filter(p => p.status === "ativo").length,
    inativo: parceiros.filter(p => p.status === "inativo").length,
  };

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "#e6edf3", fontSize: 22, fontWeight: 800, margin: 0 }}>Parceiros</h1>
          <p style={{ color: "#8b949e", fontSize: 13, margin: "4px 0 0" }}>Rede de profissionais e colaboradores</p>
        </div>
        <button onClick={() => router.push("/crm/parceiros/novo")}
          style={{
            padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "#c9a24a", color: "#0d1117", fontWeight: 800, fontSize: 13,
          }}>
          + Convidar
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
        {(["todos", "pendente", "ativo", "inativo"] as const).map(s => (
          <button key={s} onClick={() => setFiltroStatus(s)}
            style={{
              padding: "6px 14px", borderRadius: 20, border: "1px solid",
              fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              background: filtroStatus === s ? "#c9a24a20" : "transparent",
              borderColor: filtroStatus === s ? "#c9a24a" : "#30363d",
              color: filtroStatus === s ? "#c9a24a" : "#8b949e",
            }}>
            {s === "todos" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
            {" "}({contagens[s as keyof typeof contagens] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "#8b949e", padding: 40 }}>Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <p style={{ color: "#8b949e", marginBottom: 12 }}>Nenhum parceiro encontrado.</p>
          <button onClick={() => router.push("/crm/parceiros/novo")}
            style={{ padding: "10px 20px", borderRadius: 10, background: "#c9a24a20", border: "1px solid #c9a24a40", color: "#c9a24a", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
            Convidar primeiro parceiro
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtrados.map(p => (
            <div key={p.id}
              style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <p style={{ color: "#e6edf3", fontWeight: 700, fontSize: 15, margin: 0 }}>{p.nome}</p>
                  <p style={{ color: "#8b949e", fontSize: 12, margin: "2px 0 0" }}>
                    {p.especialidade}{p.cidade ? ` · ${p.cidade}/${p.estado}` : ""}
                  </p>
                </div>
                <span style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: `${STATUS_COR[p.status] || "#8b949e"}20`,
                  color: STATUS_COR[p.status] || "#8b949e",
                  border: `1px solid ${STATUS_COR[p.status] || "#8b949e"}40`,
                }}>
                  {p.status}
                </span>
              </div>

              <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
                <div>
                  <p style={{ color: "#a78bfa", fontSize: 18, fontWeight: 800, margin: 0 }}>{p.total_encaminhamentos}</p>
                  <p style={{ color: "#484f58", fontSize: 10, margin: 0 }}>encaminhados</p>
                </div>
                <div>
                  <p style={{ color: "#34d399", fontSize: 18, fontWeight: 800, margin: 0 }}>{p.total_fechamentos}</p>
                  <p style={{ color: "#484f58", fontSize: 10, margin: 0 }}>fechamentos</p>
                </div>
                <div>
                  <p style={{ color: "#c9a24a", fontSize: 18, fontWeight: 800, margin: 0 }}>{p.comissao_pct}%</p>
                  <p style={{ color: "#484f58", fontSize: 10, margin: 0 }}>comissão</p>
                </div>
              </div>

              {p.email && <p style={{ color: "#8b949e", fontSize: 11, margin: "0 0 2px" }}>{p.email}</p>}
              {p.telefone && <p style={{ color: "#8b949e", fontSize: 11, margin: 0 }}>{p.telefone}</p>}

              {p.status === "pendente" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => atualizarStatus(p.id, "ativo")} disabled={atualizando === p.id}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer", background: "#34d39920", color: "#34d399", fontWeight: 700, fontSize: 13, opacity: atualizando === p.id ? 0.5 : 1 }}>
                    Aprovar
                  </button>
                  <button onClick={() => atualizarStatus(p.id, "rejeitado")} disabled={atualizando === p.id}
                    style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", cursor: "pointer", background: "#ef444420", color: "#ef4444", fontWeight: 700, fontSize: 13, opacity: atualizando === p.id ? 0.5 : 1 }}>
                    Rejeitar
                  </button>
                </div>
              )}
              {p.status === "ativo" && (
                <button onClick={() => atualizarStatus(p.id, "inativo")}
                  style={{ marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 10, border: "1px solid #30363d", cursor: "pointer", background: "transparent", color: "#8b949e", fontSize: 12 }}>
                  Desativar
                </button>
              )}
              {p.status === "inativo" && (
                <button onClick={() => atualizarStatus(p.id, "ativo")}
                  style={{ marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 10, border: "1px solid #34d39940", cursor: "pointer", background: "#34d39910", color: "#34d399", fontSize: 12 }}>
                  Reativar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
