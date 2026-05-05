"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { fetchCargosCatalogo, fetchPerfisPersonalidade, fetchMercados } from "@/lib/supabase/catalogos";
import type { CargoCatalogo, PerfilPersonalidade, MercadoCatalogo } from "@/lib/supabase/catalogos";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const HUMORES_ORD    = ["Analítico","Criativo","Pragmático","Empático","Competitivo"];
const PERS_ORD       = ["Formal","Casual","Assertivo","Entusiasta","Estratégico"];
const MODELOS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku — Rápido e econômico" },
  { id: "claude-sonnet-4-6", label: "Sonnet — Equilibrado" },
  { id: "claude-opus-4-7", label: "Opus — Mais poderoso" },
];
const NIVEL_COR: Record<number, string> = {
  1: "#b3261e", 2: "#f97316", 3: "#eab308", 4: "#3b82f6", 5: "#6b7280",
};

interface CargoItem { cargo: string; area: string; mercados?: string[]; ativo: boolean; }
type Aba = "basico" | "cargos" | "personalidade" | "conhecimento" | "regras";

export default function EditarAgentePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [agente, setAgente] = useState<Record<string, unknown> | null>(null);
  const [conhecimentos, setConhecimentos] = useState<Record<string, unknown>[]>([]);
  const [personalidade, setPersonalidade] = useState<Record<string, unknown> | null>(null);
  const [aba, setAba] = useState<Aba>("basico");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => { if (slug) carregar(); }, [slug]);

  async function carregar() {
    const [a, c, p] = await Promise.all([
      supabase.from("hub_agente_identidade").select("*").eq("agente_slug", slug).single(),
      supabase.from("hub_agente_conhecimento").select("*").eq("agente_slug", slug).order("ordem"),
      supabase.from("hub_personalidade").select("*").eq("agente_slug", slug).maybeSingle(),
    ]);
    if (a.data) setAgente(a.data);
    if (c.data) setConhecimentos(c.data);
    if (p.data) setPersonalidade(p.data);
  }

  async function salvar() {
    if (!agente) return;
    setSalvando(true);
    await supabase.from("hub_agente_identidade").update({
      nome: agente.nome,
      cargo: agente.cargo,
      area: agente.area,
      bio: agente.bio,
      cargos: agente.cargos,
      modelo_padrao: agente.modelo_padrao,
      pode_fazer: agente.pode_fazer,
      nao_pode_fazer: agente.nao_pode_fazer,
      prefixo_mercado: agente.prefixo_mercado,
      ativo: agente.ativo,
    }).eq("agente_slug", slug);

    if (personalidade) {
      await supabase.from("hub_personalidade").upsert({
        agente_slug: slug,
        humor: personalidade.humor,
        personalidade: personalidade.personalidade,
        humor_label: HUMORES[((personalidade.humor as number) || 1) - 1],
        personalidade_label: PERSONALIDADES[((personalidade.personalidade as number) || 1) - 1],
        descricao_comportamento: personalidade.descricao_comportamento,
        tom_comunicacao: personalidade.tom_comunicacao,
      });
    }
    setMensagem("✓ Salvo");
    setTimeout(() => setMensagem(""), 3000);
    setSalvando(false);
  }

  function update(campo: string, valor: unknown) {
    if (!agente) return;
    setAgente({ ...agente, [campo]: valor });
  }

  function adicionarCargo() {
    const cargos = (agente?.cargos as CargoItem[]) || [];
    update("cargos", [...cargos, { cargo: "Novo cargo", area: "Atendimento", ativo: true }]);
  }

  function removerCargo(i: number) {
    const cargos = ((agente?.cargos as CargoItem[]) || []).filter((_, idx) => idx !== i);
    update("cargos", cargos);
  }

  function updateCargo(i: number, campo: string, valor: unknown) {
    const cargos = ((agente?.cargos as CargoItem[]) || []).map((c, idx) =>
      idx === i ? { ...c, [campo]: valor } : c
    );
    update("cargos", cargos);
  }

  function adicionarConhecimento(secao: string) {
    setConhecimentos(prev => [...prev, { agente_slug: slug, secao, titulo: "Novo item", conteudo: "", ordem: prev.length, ativo: true }]);
  }

  async function salvarConhecimento(item: Record<string, unknown>, idx: number) {
    if (item.id) {
      await supabase.from("hub_agente_conhecimento").update({ titulo: item.titulo, conteudo: item.conteudo, ativo: item.ativo }).eq("id", item.id);
    } else {
      const { data } = await supabase.from("hub_agente_conhecimento").insert({
        agente_slug: slug, secao: item.secao, titulo: item.titulo, conteudo: item.conteudo, ordem: idx, ativo: true,
      }).select().single();
      if (data) {
        const novos = [...conhecimentos];
        novos[idx] = data;
        setConhecimentos(novos);
      }
    }
    setMensagem("✓ Salvo");
    setTimeout(() => setMensagem(""), 2000);
  }

  async function deletarConhecimento(item: Record<string, unknown>, idx: number) {
    if (item.id) await supabase.from("hub_agente_conhecimento").delete().eq("id", item.id);
    setConhecimentos(conhecimentos.filter((_, i) => i !== idx));
  }

  if (!agente) {
    return (
      <div style={{ background: "#0d1117", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#8b949e", fontSize: 14 }}>Carregando agente...</div>
      </div>
    );
  }

  const cargos = (agente.cargos as CargoItem[]) || [];
  const SECOES = [
    { id: "empresa", label: "🏢 Sobre o negócio" },
    { id: "servicos", label: "🛠 Serviços" },
    { id: "atendimento", label: "💬 Como atender" },
    { id: "proibicoes", label: "🚫 O que nunca fazer" },
    { id: "objeccoes", label: "🛡 Objeções comuns" },
    { id: "exemplos", label: "✅ Exemplos reais" },
  ];

  const inputStyle = { background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3", borderRadius: 8, padding: "8px 12px", width: "100%", fontSize: 13, outline: "none" } as const;
  const labelStyle = { fontSize: 11, fontWeight: 700, color: "#c9a24a", display: "block", marginBottom: 4 } as const;

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh" }}>
      {/* HEADER */}
      <div style={{ padding: "12px 20px", background: "#161b22", borderBottom: "1px solid #30363d", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ color: "#8b949e", background: "none", border: "none", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>←</button>
          <div>
            <h1 style={{ color: "#e6edf3", fontWeight: 700, fontSize: 16, margin: 0, lineHeight: 1 }}>{agente.nome as string}</h1>
            <p style={{ color: "#8b949e", fontSize: 11, margin: "2px 0 0" }}>{agente.cargo as string} · N{agente.nivel as number}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {mensagem && <span style={{ fontSize: 12, color: "#c9a24a" }}>{mensagem}</span>}
          <button onClick={salvar} disabled={salvando} style={{ padding: "8px 16px", borderRadius: 8, background: "#003b26", border: "none", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {salvando ? "..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", borderBottom: "1px solid #30363d", background: "#0d1117" }}>
        {([
          { id: "basico", label: "Básico" },
          { id: "cargos", label: `Cargos (${cargos.length})` },
          { id: "personalidade", label: "Personalidade" },
          { id: "conhecimento", label: `Conhecimento (${conhecimentos.length})` },
          { id: "regras", label: "Regras" },
        ] as { id: Aba; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setAba(t.id)}
            style={{
              flex: 1, padding: "12px 4px", fontSize: 12, fontWeight: 500,
              color: aba === t.id ? "#c9a24a" : "#8b949e",
              borderBottom: aba === t.id ? "2px solid #c9a24a" : "2px solid transparent",
              background: "none", border: aba === t.id ? undefined : "none",
              borderLeft: "none", borderRight: "none", borderTop: "none",
              cursor: "pointer", transition: "color 150ms",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: 24, maxWidth: 760, margin: "0 auto" }}>

        {/* ── BÁSICO ── */}
        {aba === "basico" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Nome</label>
              <input value={agente.nome as string || ""} onChange={e => update("nome", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Cargo principal</label>
                <input value={agente.cargo as string || ""} onChange={e => update("cargo", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Área</label>
                <input value={agente.area as string || ""} onChange={e => update("area", e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Bio</label>
              <textarea value={agente.bio as string || ""} onChange={e => update("bio", e.target.value)} rows={3}
                style={{ ...inputStyle, resize: "none" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Modelo de IA</label>
                <select value={agente.modelo_padrao as string || MODELOS[0].id} onChange={e => update("modelo_padrao", e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}>
                  {MODELOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Mercados (ex: IMB,ARQ)</label>
                <input value={agente.prefixo_mercado as string || ""} onChange={e => update("prefixo_mercado", e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="ativo" checked={agente.ativo as boolean || false} onChange={e => update("ativo", e.target.checked)} style={{ accentColor: "#c9a24a" }} />
              <label htmlFor="ativo" style={{ color: "#e6edf3", fontSize: 13, cursor: "pointer" }}>Agente ativo</label>
            </div>
          </div>
        )}

        {/* ── CARGOS ── */}
        {aba === "cargos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ color: "#8b949e", fontSize: 12, margin: 0 }}>Um agente pode ocupar múltiplos cargos, cada um atendendo mercados específicos.</p>
            {cargos.map((c, i) => (
              <div key={i} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: "#c9a24a", fontWeight: 700 }}>Cargo {i + 1}</span>
                  <button onClick={() => removerCargo(i)} style={{ fontSize: 11, color: "#b3261e", background: "none", border: "none", cursor: "pointer" }}>Remover</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <input value={c.cargo} onChange={e => updateCargo(i, "cargo", e.target.value)} placeholder="Cargo" style={{ ...inputStyle, padding: "6px 10px" }} />
                  <input value={c.area} onChange={e => updateCargo(i, "area", e.target.value)} placeholder="Área" style={{ ...inputStyle, padding: "6px 10px" }} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {MERCADOS.map(m => {
                    const ativo = (c.mercados || []).includes(m);
                    return (
                      <button key={m} onClick={() => {
                        const mercados = ativo ? (c.mercados || []).filter(x => x !== m) : [...(c.mercados || []), m];
                        updateCargo(i, "mercados", mercados);
                      }} style={{
                        padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                        background: ativo ? "#003b26" : "#21262d",
                        color: ativo ? "#c9a24a" : "#8b949e",
                        border: `1px solid ${ativo ? "#c9a24a40" : "#30363d"}`,
                      }}>
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button onClick={adicionarCargo} style={{
              padding: "12px 0", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: "transparent", border: "1px dashed #c9a24a", color: "#c9a24a",
            }}>
              + Adicionar cargo
            </button>
          </div>
        )}

        {/* ── PERSONALIDADE ── */}
        {aba === "personalidade" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>Humor</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {HUMORES.map((h, i) => (
                    <button key={h} onClick={() => setPersonalidade(prev => ({ ...(prev || {}), humor: i + 1 }))}
                      style={{
                        padding: "8px 12px", borderRadius: 8, textAlign: "left", fontSize: 13, cursor: "pointer",
                        background: personalidade?.humor === i + 1 ? "#003b26" : "#161b22",
                        color: personalidade?.humor === i + 1 ? "#c9a24a" : "#e6edf3",
                        border: `1px solid ${personalidade?.humor === i + 1 ? "#c9a24a40" : "#30363d"}`,
                      }}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Personalidade</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {PERSONALIDADES.map((p, i) => (
                    <button key={p} onClick={() => setPersonalidade(prev => ({ ...(prev || {}), personalidade: i + 1 }))}
                      style={{
                        padding: "8px 12px", borderRadius: 8, textAlign: "left", fontSize: 13, cursor: "pointer",
                        background: personalidade?.personalidade === i + 1 ? "#003b26" : "#161b22",
                        color: personalidade?.personalidade === i + 1 ? "#c9a24a" : "#e6edf3",
                        border: `1px solid ${personalidade?.personalidade === i + 1 ? "#c9a24a40" : "#30363d"}`,
                      }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Tom de comunicação</label>
              <input value={personalidade?.tom_comunicacao as string || ""} placeholder="Ex: acolhedor, profissional e direto"
                onChange={e => setPersonalidade(prev => ({ ...(prev || {}), tom_comunicacao: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Descrição do comportamento</label>
              <textarea value={personalidade?.descricao_comportamento as string || ""}
                onChange={e => setPersonalidade(prev => ({ ...(prev || {}), descricao_comportamento: e.target.value }))}
                rows={4} style={{ ...inputStyle, resize: "none" }} />
            </div>
          </div>
        )}

        {/* ── CONHECIMENTO ── */}
        {aba === "conhecimento" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {SECOES.map(secao => {
              const itens = conhecimentos.filter(c => c.secao === secao.id);
              return (
                <div key={secao.id} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#c9a24a" }}>{secao.label}</span>
                    <button onClick={() => adicionarConhecimento(secao.id)} style={{ fontSize: 11, color: "#c9a24a", background: "none", border: "none", cursor: "pointer" }}>+ Adicionar</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {itens.length === 0 ? (
                      <p style={{ fontSize: 12, color: "#484f58", margin: 0 }}>Nenhum item ainda</p>
                    ) : itens.map(item => {
                      const realIdx = conhecimentos.indexOf(item);
                      return (
                        <div key={realIdx} style={{ background: "#0d1117", borderRadius: 8, padding: 10 }}>
                          <input value={item.titulo as string || ""} placeholder="Título"
                            onChange={e => {
                              const novos = [...conhecimentos];
                              novos[realIdx] = { ...item, titulo: e.target.value };
                              setConhecimentos(novos);
                            }} style={{ ...inputStyle, marginBottom: 6 }} />
                          <textarea value={item.conteudo as string || ""} placeholder="Conteúdo..." rows={3}
                            onChange={e => {
                              const novos = [...conhecimentos];
                              novos[realIdx] = { ...item, conteudo: e.target.value };
                              setConhecimentos(novos);
                            }} style={{ ...inputStyle, resize: "none" }} />
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <button onClick={() => salvarConhecimento(item, realIdx)}
                              style={{ flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#003b26", border: "none", color: "white", cursor: "pointer" }}>
                              Salvar
                            </button>
                            <button onClick={() => deletarConhecimento(item, realIdx)}
                              style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, background: "#21262d", border: "none", color: "#b3261e", cursor: "pointer" }}>
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── REGRAS ── */}
        {aba === "regras" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Pode fazer (uma por linha)</label>
              <textarea value={((agente.pode_fazer as string[]) || []).join("\n")}
                onChange={e => update("pode_fazer", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                rows={5} style={{ ...inputStyle, resize: "none" }} />
            </div>
            <div>
              <label style={{ ...labelStyle, color: "#b3261e" }}>NÃO pode fazer (uma por linha)</label>
              <textarea value={((agente.nao_pode_fazer as string[]) || []).join("\n")}
                onChange={e => update("nao_pode_fazer", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                rows={5} style={{ ...inputStyle, resize: "none" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
