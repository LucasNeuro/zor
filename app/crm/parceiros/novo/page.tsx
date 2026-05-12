"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function NovoParceiro() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [comissao, setComissao] = useState("5");
  const [linkGerado, setLinkGerado] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function gerarLink() {
    if (!especialidade.trim()) { setErro("Especialidade é obrigatória."); return; }
    setErro("");
    setLoading(true);

    const token = Array.from(crypto.getRandomValues(new Uint8Array(18)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: errLink } = await supabase.from("hub_links_cadastro").insert({
      token,
      tipo: "parceiro",
      criado_por: "gestor",
      expira_em: expira,
      metadata: { nome, email, especialidade, comissao_pct: parseFloat(comissao) || 5 },
    });

    if (errLink) { setErro("Erro ao gerar link. Tente novamente."); setLoading(false); return; }

    const base = typeof window !== "undefined" ? window.location.origin : "";
    setLinkGerado(`${base}/parceiro/cadastro/${token}`);
    setLoading(false);
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(linkGerado);
  }

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", padding: "1.5rem" }}>
      <button onClick={() => router.back()}
        style={{ background: "none", border: "none", color: "#8b949e", fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0 }}>
        ← Voltar
      </button>

      {!linkGerado ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Nome (opcional)</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="João da Silva"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #30363d", background: "#161b22", color: "#e6edf3", fontSize: 14, boxSizing: "border-box" }} />
          </div>

          <div>
            <label style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>E-mail (opcional)</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@exemplo.com"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #30363d", background: "#161b22", color: "#e6edf3", fontSize: 14, boxSizing: "border-box" }} />
          </div>

          <div>
            <label style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Especialidade *</label>
            <select value={especialidade} onChange={e => setEspecialidade(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #30363d", background: "#161b22", color: "#e6edf3", fontSize: 14, boxSizing: "border-box" }}>
              <option value="">Selecione...</option>
              <option value="Imobiliário">Imobiliário</option>
              <option value="Arquitetura">Arquitetura</option>
              <option value="Engenharia Civil">Engenharia Civil</option>
              <option value="Construção">Construção</option>
              <option value="Advocacia">Advocacia</option>
              <option value="Medicina">Medicina</option>
              <option value="Consultoria">Consultoria</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div>
            <label style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>Comissão (%)</label>
            <input value={comissao} onChange={e => setComissao(e.target.value)} type="number" min="0" max="50" step="0.5"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #30363d", background: "#161b22", color: "#e6edf3", fontSize: 14, boxSizing: "border-box" }} />
          </div>

          {erro && <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>{erro}</p>}

          <div style={{ background: "#161b22", border: "1px solid #30363d40", borderRadius: 12, padding: 14 }}>
            <p style={{ color: "#8b949e", fontSize: 11, margin: 0, lineHeight: 1.6 }}>
              O link gerado expira em <strong style={{ color: "#c9a24a" }}>7 dias</strong>. O parceiro preenche o próprio cadastro e fica com status <strong style={{ color: "#c9a24a" }}>pendente</strong> até você aprovar.
            </p>
          </div>

          <button onClick={gerarLink} disabled={loading}
            style={{
              padding: "14px", borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "#30363d" : "#c9a24a", color: loading ? "#8b949e" : "#0d1117",
              fontWeight: 800, fontSize: 15, transition: "background 150ms",
            }}>
            {loading ? "Gerando..." : "Gerar Link de Convite"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#003b2620", border: "1px solid #34d39940", borderRadius: 14, padding: 20, textAlign: "center" }}>
            <p style={{ color: "#34d399", fontWeight: 700, fontSize: 15, margin: "0 0 8px" }}>Link gerado com sucesso!</p>
            <p style={{ color: "#8b949e", fontSize: 11, margin: 0 }}>Válido por 7 dias</p>
          </div>

          <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 14 }}>
            <p style={{ color: "#8b949e", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Link de cadastro</p>
            <p style={{ color: "#e6edf3", fontSize: 12, wordBreak: "break-all", margin: 0, fontFamily: "monospace" }}>{linkGerado}</p>
          </div>

          <button onClick={copiarLink}
            style={{ padding: "14px", borderRadius: 12, border: "1px solid #c9a24a40", cursor: "pointer", background: "#c9a24a20", color: "#c9a24a", fontWeight: 700, fontSize: 14 }}>
            Copiar Link
          </button>

          <button onClick={() => { setLinkGerado(""); setNome(""); setEmail(""); setEspecialidade(""); }}
            style={{ padding: "12px", borderRadius: 12, border: "1px solid #30363d", cursor: "pointer", background: "transparent", color: "#8b949e", fontSize: 13 }}>
            Gerar outro link
          </button>

          <button onClick={() => router.push("/crm/parceiros")}
            style={{ padding: "12px", borderRadius: 12, border: "none", cursor: "pointer", background: "#161b22", color: "#e6edf3", fontSize: 13 }}>
            Ver todos os parceiros →
          </button>
        </div>
      )}
    </div>
  );
}
