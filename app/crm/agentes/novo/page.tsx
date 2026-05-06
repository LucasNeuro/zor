"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  fetchCargosCatalogo, fetchPerfisPersonalidade, fetchMercados,
  type CargoCatalogo, type PerfilPersonalidade, type MercadoCatalogo,
} from "@/lib/supabase/catalogos";

// ─── Constants ────────────────────────────────────────────────────────────────

const HUMORES_ORD = ["Analítico", "Criativo", "Pragmático", "Empático", "Competitivo"];
const PERS_ORD    = ["Formal", "Casual", "Assertivo", "Entusiasta", "Estratégico"];

const NIVEL_COR: Record<number, string> = {
  1: "#b3261e", 2: "#f97316", 3: "#eab308", 4: "#3b82f6", 5: "#6b7280",
};
const NIVEL_LABEL: Record<number, string> = {
  1: "N1 — CEO", 2: "N2 — Diretor", 3: "N3 — Gerente", 4: "N4 — Executor", 5: "N5 — Especialista",
};
const MODELO_LABEL: Record<string, string> = {
  "claude-opus-4-7":           "Opus 4.7",
  "claude-sonnet-4-6":         "Sonnet 4.6",
  "claude-haiku-4-5-20251001": "Haiku 4.5",
};
const MODELO_COR: Record<string, string> = {
  "claude-opus-4-7":           "#a78bfa",
  "claude-sonnet-4-6":         "#3b82f6",
  "claude-haiku-4-5-20251001": "#6b7280",
};
const MODELOS_ORD = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"];

const SECOES_CONHECIMENTO = [
  { id: "empresa",     label: "🏢 Sobre o negócio",      placeholder: "Quem somos, diferenciais, valores e proposta de valor..." },
  { id: "servicos",    label: "🛠 Serviços e produtos",   placeholder: "Detalhes de cada serviço, faixas de preço, prazos médios..." },
  { id: "atendimento", label: "💬 Como atender",          placeholder: "Fluxo, perguntas a fazer, como conduzir o lead, tom de voz..." },
  { id: "proibicoes",  label: "🚫 O que nunca fazer",     placeholder: "O que nunca prometer, quando sempre escalar para humano..." },
  { id: "objeccoes",   label: "🛡 Como lidar com objeções",placeholder: "Objeções comuns e como responder. Ex: 'tá caro'..." },
  { id: "exemplos",    label: "✅ Exemplos reais",         placeholder: "Exemplos de boas respostas, cases de sucesso..." },
];

const ESCALA_OPCOES = [
  { value: "sempre",           label: "Sempre — nunca resolve sozinho" },
  { value: "lead_acima_50k",   label: "Lead acima de R$50k" },
  { value: "lead_acima_100k",  label: "Lead acima de R$100k" },
  { value: "lead_acima_200k",  label: "Lead acima de R$200k" },
  { value: "reclamacao",       label: "Qualquer reclamação" },
  { value: "nunca",            label: "Nunca — resolve tudo sozinho" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gerarSlug(nome: string) {
  return nome.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function gerarPreview(
  cargo: CargoCatalogo | null,
  perfil: PerfilPersonalidade | null,
  nome: string,
  mercados: string[],
  podeFazer: string[],
  conhecimentos: { secao: string; conteudo: string }[],
) {
  if (!cargo) return "Selecione um cargo para ver o preview...";
  const secoes: string[] = [];
  const nomeFinal = nome || `Agente ${cargo.titulo}`;

  if (cargo.prompt_template) {
    secoes.push(cargo.prompt_template.replace("{nome}", nomeFinal).replace("{cargo}", cargo.titulo).replace("{area}", cargo.area));
  } else {
    secoes.push(`═══ IDENTIDADE ═══\nVocê é ${nomeFinal}, ${cargo.titulo} da área de ${cargo.area}.`);
  }

  if (perfil) {
    secoes.push(`═══ COMPORTAMENTO ═══\n${perfil.prompt_fragmento}`);
  }

  if (mercados.length > 0) {
    secoes.push(`═══ MERCADOS ═══\nAtende: ${mercados.join(", ")}`);
  }

  const conhecFilled = conhecimentos.filter(c => c.conteudo.trim());
  for (const c of conhecFilled) {
    const s = SECOES_CONHECIMENTO.find(s => s.id === c.secao);
    secoes.push(`═══ ${(s?.label || c.secao).replace(/^[^\s]+\s/, "").toUpperCase()} ═══\n${c.conteudo}`);
  }

  if (podeFazer.length > 0) {
    secoes.push(`═══ PODE FAZER ═══\n${podeFazer.map(r => `• ${r}`).join("\n")}`);
  }

  if (cargo.nao_pode_fazer_padrao?.length > 0) {
    secoes.push(`═══ NÃO PODE FAZER ═══\n${cargo.nao_pode_fazer_padrao.map(r => `• ${r}`).join("\n")}`);
  }

  secoes.push(`═══ REGRAS UNIVERSAIS ═══
• Máximo 3 linhas por mensagem no WhatsApp
• Responda primeiro a pergunta do cliente
• Nunca mencione que é IA a menos que perguntado
• Nunca encerre sem indicar o próximo passo`);

  return secoes.join("\n\n");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CardCargo({ cargo, ativo, onClick }: { cargo: CargoCatalogo; ativo: boolean; onClick: () => void }) {
  const cor = NIVEL_COR[cargo.nivel] || "#6b7280";
  return (
    <button onClick={onClick} className="w-full text-left p-3 rounded-xl border-2 transition-all"
      style={{
        borderColor: ativo ? cor : "#e0ddd6",
        background: ativo ? "#003b26" : "white",
        color: ativo ? "white" : "#1a1a1a",
      }}>
      <div className="flex items-start gap-2">
        <span className="text-xs px-1.5 py-0.5 rounded font-black flex-shrink-0 mt-0.5"
          style={{ background: cor, color: "white" }}>
          N{cargo.nivel}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm leading-tight">{cargo.titulo}</p>
          <p className="text-xs mt-0.5" style={{ color: ativo ? "#c9a24a" : "#888" }}>{cargo.area} · {MODELO_LABEL[cargo.modelo_padrao] || cargo.modelo_padrao}</p>
          {cargo.descricao && <p className="text-xs mt-1 leading-relaxed opacity-75">{cargo.descricao}</p>}
        </div>
      </div>
    </button>
  );
}

function Toggle5x5({ perfis, humorSel, persSel, onSelect }: {
  perfis: PerfilPersonalidade[];
  humorSel: string; persSel: string;
  onSelect: (humor: string, pers: string) => void;
}) {
  const perfilSelecionado = perfis.find(p => p.humor === humorSel && p.personalidade === persSel);
  return (
    <div>
      {/* Grid 5×5 */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="w-20 text-left text-[#888] font-bold pb-1 pr-2">Humor ↓ / Pers. →</th>
              {PERS_ORD.map(p => (
                <th key={p} className="text-center pb-1 px-1 font-bold" style={{ color: "#003b26", minWidth: 80 }}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HUMORES_ORD.map(humor => (
              <tr key={humor}>
                <td className="pr-2 py-1 font-bold" style={{ color: "#003b26", whiteSpace: "nowrap" }}>{humor}</td>
                {PERS_ORD.map(pers => {
                  const ativo = humorSel === humor && persSel === pers;
                  return (
                    <td key={pers} className="py-1 px-1 text-center">
                      <button onClick={() => onSelect(humor, pers)}
                        className="w-full py-1.5 rounded-lg border-2 text-xs font-bold transition-all"
                        style={{
                          borderColor: ativo ? "#c9a24a" : "#e0ddd6",
                          background: ativo ? "#003b26" : "white",
                          color: ativo ? "#c9a24a" : "#888",
                        }}>
                        {ativo ? "✓" : "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Perfil selecionado */}
      {perfilSelecionado && (
        <div className="mt-4 p-4 rounded-xl border-2 border-[#003b26] bg-[#003b26]">
          <p className="text-[#c9a24a] text-xs font-black uppercase mb-2">{perfilSelecionado.humor} + {perfilSelecionado.personalidade}</p>
          <p className="text-white text-sm font-medium mb-1">{perfilSelecionado.tom_comunicacao}</p>
          <p className="text-[#c9a24a80] text-xs">{perfilSelecionado.estilo_trabalho}</p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NovoAgentePage() {
  const router = useRouter();

  // Catálogos
  const [cargos, setCargos] = useState<CargoCatalogo[]>([]);
  const [perfis, setPerfis] = useState<PerfilPersonalidade[]>([]);
  const [mercadosCat, setMercadosCat] = useState<MercadoCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Formulário
  const [passo, setPasso] = useState(1);
  const [cargo, setCargo] = useState<CargoCatalogo | null>(null);
  const [nome, setNome] = useState("");
  const [humorSel, setHumorSel] = useState("Empático");
  const [persSel, setPersSel] = useState("Casual");
  const [mercadosSel, setMercadosSel] = useState<string[]>([]);
  const [podeFazer, setPodeFazer] = useState<string[]>([]);
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("22:00");
  const [escalaQuando, setEscalaQuando] = useState("lead_acima_50k");
  const [conhecimentos, setConhecimentos] = useState<{ secao: string; conteudo: string }[]>([]);
  const [secaoAtiva, setSecaoAtiva] = useState("empresa");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [tipoSel, setTipoSel] = useState("");

  const totalPassos = 5;

  useEffect(() => {
    Promise.all([fetchCargosCatalogo(), fetchPerfisPersonalidade(), fetchMercados()])
      .then(([c, p, m]) => { setCargos(c); setPerfis(p); setMercadosCat(m); })
      .finally(() => setCarregando(false));
  }, []);

  const perfil = perfis.find(p => p.humor === humorSel && p.personalidade === persSel) ?? null;

  const selecionarCargo = useCallback((c: CargoCatalogo) => {
    setCargo(c);
    setPodeFazer(c.pode_fazer_padrao || []);
    if ((c.limite_autonomia_brl || 0) >= 100000) setEscalaQuando("lead_acima_100k");
    else if ((c.limite_autonomia_brl || 0) >= 50000) setEscalaQuando("lead_acima_50k");
    else setEscalaQuando("sempre");
  }, []);

  function toggleMercado(sigla: string) {
    setMercadosSel(prev => prev.includes(sigla) ? prev.filter(m => m !== sigla) : [...prev, sigla]);
  }

  function togglePodeFazer(item: string) {
    setPodeFazer(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  }

  function getConhecimento(secao: string) {
    return conhecimentos.find(c => c.secao === secao)?.conteudo || "";
  }

  function setConhecimento(secao: string, conteudo: string) {
    setConhecimentos(prev => {
      const existe = prev.find(c => c.secao === secao);
      if (existe) return prev.map(c => c.secao === secao ? { ...c, conteudo } : c);
      return [...prev, { secao, conteudo }];
    });
  }

  async function salvar() {
    if (!cargo) { setErro("Selecione um cargo"); return; }
    if (!nome.trim()) { setErro("Informe o nome do agente"); return; }
    setSalvando(true);
    setErro("");

    const payload = {
      agente_slug: gerarSlug(nome),
      nome: nome.trim(),
      cargo: cargo.titulo,
      cargo_slug: cargo.slug,
      area: cargo.area,
      nivel: cargo.nivel,
      modelo_padrao: cargo.modelo_padrao,
      humor: HUMORES_ORD.indexOf(humorSel) + 1,
      personalidade_id: PERS_ORD.indexOf(persSel) + 1,
      perfil_id: perfil?.id,
      prefixo_mercado: mercadosSel.join(","),
      supervisor_slug: cargo.supervisor_slug,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      dias_semana: [0, 1, 2, 3, 4, 5, 6],
      system_prompt_base: [
        cargo.prompt_template?.replace("{nome}", nome.trim()).replace("{cargo}", cargo.titulo) || `Você é ${nome.trim()}, ${cargo.titulo} da área de ${cargo.area}.`,
        perfil?.prompt_fragmento || "",
      ].filter(Boolean).join("\n\n"),
      pode_fazer: podeFazer,
      nao_pode_fazer: cargo.nao_pode_fazer_padrao || [],
      sempre_dizer: [],
      nunca_dizer: [],
      conhecimentos: conhecimentos.filter(c => c.conteudo.trim()),
      limite_autonomia_brl: cargo.limite_autonomia_brl,
    };

    const res = await fetch("/api/agentes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.NEXT_PUBLIC_INTERNAL_API_KEY || "",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push("/crm/agentes");
    } else {
      const data = await res.json() as { erro?: string };
      setErro(data.erro || "Erro ao criar agente");
      setSalvando(false);
    }
  }

  const previewPrompt = gerarPreview(cargo, perfil, nome, mercadosSel, podeFazer, conhecimentos);
  const tokensEstimados = Math.ceil(previewPrompt.length / 4);
  const progresso = (passo / totalPassos) * 100;

  // Cargos filtrados por tipo/área
  const ATENDIMENTO_SLUGS = ["atendente", "sdr"];
  const areas = Array.from(new Set(cargos.map(c => c.area))).sort();
  const cargosFiltrados = tipoSel === "Atendimento"
    ? cargos.filter(c => ATENDIMENTO_SLUGS.includes(c.slug))
    : tipoSel
    ? cargos.filter(c => c.area === tipoSel)
    : cargos;
  const niveisList = [1, 2, 3, 4, 5].filter(n => cargosFiltrados.some(c => c.nivel === n));

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f7f4ec" }}>
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#003b26] border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-[#003b26] text-sm">Carregando catálogos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#f7f4ec" }}>

      {/* HEADER */}
      <div className="sticky top-0 z-10 px-6 py-3 flex items-center justify-between" style={{ background: "#003b26" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-[#c9a24a] hover:text-white text-sm transition-colors">← Voltar</button>
          <div>
            <h1 className="text-white font-black text-base">Criar Novo Agente</h1>
            <p className="text-[#c9a24a] text-xs">Passo {passo} de {totalPassos}</p>
          </div>
        </div>
        {cargo && nome && (
          <div className="text-right">
            <p className="text-white text-sm font-black">{nome}</p>
            <p className="text-[#c9a24a] text-xs">{cargo.titulo} · N{cargo.nivel}</p>
          </div>
        )}
      </div>

      {/* BARRA PROGRESSO */}
      <div className="h-1 bg-[#e0ddd6]">
        <div className="h-full bg-[#c9a24a] transition-all duration-500" style={{ width: `${progresso}%` }} />
      </div>

      <div className="flex max-w-6xl mx-auto gap-6 p-6">

        {/* FORMULÁRIO */}
        <div className="flex-1 space-y-6">

          {/* ── PASSO 1 — CARGO ── */}
          {passo === 1 && (
            <div>
              <h2 className="text-[#003b26] font-black text-xl mb-1">Qual é o cargo deste agente?</h2>
              <p className="text-[#888] text-sm mb-5">O cargo determina automaticamente o nível, modelo de IA, supervisor e permissões padrão.</p>

              {/* Filtro por tipo/área */}
              <div className="flex flex-wrap gap-2 mb-5">
                <button onClick={() => setTipoSel("")}
                  className="text-xs px-3 py-1.5 rounded-full border-2 font-bold transition-all"
                  style={{ borderColor: tipoSel === "" ? "#003b26" : "#e0ddd6", background: tipoSel === "" ? "#003b26" : "white", color: tipoSel === "" ? "#c9a24a" : "#888" }}>
                  Todos
                </button>
                {areas.map(area => (
                  <button key={area} onClick={() => setTipoSel(area)}
                    className="text-xs px-3 py-1.5 rounded-full border-2 font-bold transition-all"
                    style={{ borderColor: tipoSel === area ? "#003b26" : "#e0ddd6", background: tipoSel === area ? "#003b26" : "white", color: tipoSel === area ? "#c9a24a" : "#888" }}>
                    {area}
                  </button>
                ))}
              </div>

              {niveisList.map(nivel => (
                <div key={nivel} className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-black px-2 py-0.5 rounded text-white"
                      style={{ background: NIVEL_COR[nivel] }}>
                      {NIVEL_LABEL[nivel]}
                    </span>
                    <div className="flex-1 h-px bg-[#e0ddd6]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cargosFiltrados.filter(c => c.nivel === nivel).map(c => (
                      <CardCargo key={c.slug} cargo={c} ativo={cargo?.slug === c.slug} onClick={() => selecionarCargo(c)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── PASSO 2 — IDENTIDADE ── */}
          {passo === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[#003b26] font-black text-xl mb-1">Identidade do agente</h2>
                <p className="text-[#888] text-sm mb-4">Apenas o nome é livre. O resto vem do cargo e da personalidade selecionada.</p>
              </div>

              {/* Cargo selecionado (read-only) */}
              {cargo && (
                <div className="p-4 rounded-xl border-2 border-[#003b26] bg-[#003b26]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded font-black text-white" style={{ background: NIVEL_COR[cargo.nivel] }}>N{cargo.nivel}</span>
                    <p className="text-white font-black">{cargo.titulo}</p>
                    <button onClick={() => { setCargo(null); setPasso(1); }} className="ml-auto text-[#c9a24a80] hover:text-[#c9a24a] text-xs">Trocar →</button>
                  </div>
                  <p className="text-[#c9a24a] text-xs">{cargo.area} · {MODELO_LABEL[cargo.modelo_padrao]} · Supervisor: {cargo.supervisor_slug || "—"}</p>
                  {cargo.limite_autonomia_brl > 0 && (
                    <p className="text-[#c9a24a80] text-xs mt-1">Autonomia: até R${cargo.limite_autonomia_brl.toLocaleString("pt-BR")}</p>
                  )}
                </div>
              )}

              {/* Nível hierárquico (visual-only, determinado pelo cargo) */}
              {cargo && (
                <div>
                  <label className="text-[#003b26] text-xs font-black block mb-2">Nível hierárquico</label>
                  <div className="flex gap-2 mb-1.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <div key={n} className="flex-1 text-center py-2 rounded-lg border-2 text-xs font-black"
                        style={{
                          borderColor: cargo.nivel === n ? NIVEL_COR[n] : "#e0ddd6",
                          background: cargo.nivel === n ? NIVEL_COR[n] + "20" : "white",
                          color: cargo.nivel === n ? NIVEL_COR[n] : "#aaa",
                          opacity: cargo.nivel === n ? 1 : 0.3,
                          cursor: "default",
                        }}>
                        N{n}
                      </div>
                    ))}
                  </div>
                  <p className="text-[#003b26] text-xs font-bold">{NIVEL_LABEL[cargo.nivel]}</p>
                </div>
              )}

              {/* Modelo de IA (visual-only, determinado pelo cargo) */}
              {cargo && (
                <div>
                  <label className="text-[#003b26] text-xs font-black block mb-2">Modelo de IA</label>
                  <div className="flex gap-2 mb-1.5">
                    {MODELOS_ORD.map(modeloId => {
                      const ativo = cargo.modelo_padrao === modeloId;
                      const cor = MODELO_COR[modeloId];
                      return (
                        <div key={modeloId} className="flex-1 text-center py-2 rounded-lg border-2 text-xs font-black"
                          style={{
                            borderColor: ativo ? cor : "#e0ddd6",
                            background: ativo ? cor + "20" : "white",
                            color: ativo ? cor : "#aaa",
                            opacity: ativo ? 1 : 0.3,
                            cursor: "default",
                          }}>
                          {MODELO_LABEL[modeloId]}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[#003b26] text-xs font-bold">Determinado automaticamente pelo cargo</p>
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="text-[#003b26] text-xs font-black block mb-1.5">Nome do agente <span className="text-[#b3261e]">*</span> <span className="text-[#888] font-normal">(único campo livre)</span></label>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Mari, SDR Apex, Analista..."
                  className="w-full bg-white border-2 border-[#e0ddd6] rounded-xl px-4 py-3 text-base font-bold outline-none focus:border-[#003b26] text-[#1a1a1a] placeholder:text-[#ccc]" />
                {nome && <p className="text-[#888] text-xs mt-1">Slug: {gerarSlug(nome)}</p>}
              </div>

              {/* Mercados */}
              <div>
                <label className="text-[#003b26] text-xs font-black block mb-2">Mercados que atende</label>
                <div className="flex flex-wrap gap-2">
                  {mercadosCat.map(m => (
                    <button key={m.sigla} onClick={() => toggleMercado(m.sigla)}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border-2 font-bold transition-all"
                      style={{
                        borderColor: mercadosSel.includes(m.sigla) ? m.cor : "#e0ddd6",
                        background: mercadosSel.includes(m.sigla) ? m.cor + "20" : "white",
                        color: mercadosSel.includes(m.sigla) ? m.cor : "#888",
                      }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.cor }} />
                      {m.sigla} — {m.nome}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personalidade 5×5 */}
              <div>
                <label className="text-[#003b26] text-xs font-black block mb-2">Personalidade (5×5)</label>
                <p className="text-[#888] text-xs mb-3">Humor + Personalidade geram automaticamente tom, estilo e comportamento.</p>
                <Toggle5x5 perfis={perfis} humorSel={humorSel} persSel={persSel}
                  onSelect={(h, p) => { setHumorSel(h); setPersSel(p); }} />
              </div>

              {/* Horário */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#003b26] text-xs font-black block mb-1">Horário de início</label>
                  <input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)}
                    className="w-full bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-[#003b26] text-xs font-black block mb-1">Horário de fim</label>
                  <input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)}
                    className="w-full bg-white border border-[#e0ddd6] rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
              </div>
            </div>
          )}

          {/* ── PASSO 3 — CONHECIMENTO ── */}
          {passo === 3 && (
            <div className="space-y-4">
              <h2 className="text-[#003b26] font-black text-xl mb-1">O que este agente sabe?</h2>
              <p className="text-[#888] text-sm mb-4">Este é o cérebro do agente. A IA só usa o que você escrever aqui.</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {SECOES_CONHECIMENTO.map(s => {
                  const temConteudo = !!getConhecimento(s.id).trim();
                  return (
                    <button key={s.id} onClick={() => setSecaoAtiva(s.id)}
                      className="text-xs px-3 py-1.5 rounded-full border-2 flex items-center gap-1.5 transition-all"
                      style={{
                        borderColor: secaoAtiva === s.id ? "#003b26" : "#e0ddd6",
                        background: secaoAtiva === s.id ? "#003b26" : "white",
                        color: secaoAtiva === s.id ? "white" : "#555",
                      }}>
                      {s.label}
                      {temConteudo && <span className="w-1.5 h-1.5 rounded-full bg-[#c9a24a]" />}
                    </button>
                  );
                })}
              </div>

              {SECOES_CONHECIMENTO.filter(s => s.id === secaoAtiva).map(secao => {
                const conteudo = getConhecimento(secao.id);
                return (
                  <div key={secao.id} className="bg-white rounded-xl border border-[#e0ddd6] p-4">
                    <label className="text-[#003b26] text-xs font-black block mb-2">{secao.label}</label>
                    <textarea value={conteudo} onChange={e => setConhecimento(secao.id, e.target.value)}
                      placeholder={secao.placeholder} rows={8}
                      className="w-full bg-[#f7f4ec] rounded-lg p-3 text-sm outline-none resize-none border border-[#e0ddd6] focus:border-[#003b26] placeholder:text-[#ccc]" />
                    <div className="flex justify-between mt-2">
                      <p className="text-[#ccc] text-xs">~{Math.ceil(conteudo.length / 4)} tokens</p>
                      <p className="text-[#ccc] text-xs">{conteudo.length} caracteres</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── PASSO 4 — REGRAS ── */}
          {passo === 4 && (
            <div className="space-y-5">
              <h2 className="text-[#003b26] font-black text-xl mb-1">Regras de comportamento</h2>
              <p className="text-[#888] text-sm mb-4">Configuradas a partir do cargo. Você pode ajustar o que este agente pode fazer.</p>

              {/* Pode fazer — do cargo, toggleáveis */}
              {(cargo?.pode_fazer_padrao || []).length > 0 && (
                <div>
                  <label className="text-[#003b26] text-xs font-black block mb-2">O que pode fazer (do cargo)</label>
                  <div className="space-y-2">
                    {(cargo?.pode_fazer_padrao || []).map(item => (
                      <button key={item} onClick={() => togglePodeFazer(item)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 text-left transition-all"
                        style={{
                          borderColor: podeFazer.includes(item) ? "#003b26" : "#e0ddd6",
                          background: podeFazer.includes(item) ? "#f0f9f0" : "white",
                        }}>
                        <div className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                          style={{ borderColor: podeFazer.includes(item) ? "#003b26" : "#ccc", background: podeFazer.includes(item) ? "#003b26" : "white" }}>
                          {podeFazer.includes(item) && <span className="text-white text-xs font-black">✓</span>}
                        </div>
                        <span className="text-sm" style={{ color: podeFazer.includes(item) ? "#003b26" : "#888" }}>{item}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Não pode fazer — do cargo, fixo */}
              {(cargo?.nao_pode_fazer_padrao || []).length > 0 && (
                <div>
                  <label className="text-[#b3261e] text-xs font-black block mb-2">Nunca pode fazer (fixo do cargo)</label>
                  <div className="flex flex-wrap gap-2">
                    {(cargo?.nao_pode_fazer_padrao || []).map(item => (
                      <span key={item} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: "#b3261e15", color: "#b3261e", border: "1px solid #b3261e30" }}>
                        🔒 {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Escala quando */}
              <div>
                <label className="text-[#003b26] text-xs font-black block mb-1.5">Escala para humano quando:</label>
                <div className="space-y-1.5">
                  {ESCALA_OPCOES.map(op => (
                    <button key={op.value} onClick={() => setEscalaQuando(op.value)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 text-left transition-all"
                      style={{
                        borderColor: escalaQuando === op.value ? "#c9a24a" : "#e0ddd6",
                        background: escalaQuando === op.value ? "#003b26" : "white",
                        color: escalaQuando === op.value ? "#c9a24a" : "#555",
                      }}>
                      <div className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                        style={{ borderColor: escalaQuando === op.value ? "#c9a24a" : "#ccc", background: escalaQuando === op.value ? "#c9a24a" : "white" }} />
                      <span className="text-sm font-medium">{op.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PASSO 5 — REVISÃO ── */}
          {passo === 5 && (
            <div className="space-y-4">
              <h2 className="text-[#003b26] font-black text-xl mb-1">Revisar e ativar</h2>
              <p className="text-[#888] text-sm mb-4">Confira tudo antes de criar o agente.</p>

              <div className="bg-white rounded-xl border border-[#e0ddd6] divide-y divide-[#f0ede6]">
                {[
                  { label: "Nome", value: nome || "—" },
                  { label: "Cargo", value: cargo ? `${cargo.titulo} (N${cargo.nivel})` : "—" },
                  { label: "Área", value: cargo?.area || "—" },
                  { label: "Modelo IA", value: cargo ? MODELO_LABEL[cargo.modelo_padrao] : "—" },
                  { label: "Supervisor", value: cargo?.supervisor_slug || "—" },
                  { label: "Personalidade", value: perfil ? `${perfil.humor} + ${perfil.personalidade}` : "—" },
                  { label: "Tom", value: perfil?.tom_comunicacao || "—" },
                  { label: "Mercados", value: mercadosSel.join(", ") || "—" },
                  { label: "Horário", value: `${horarioInicio} às ${horarioFim}` },
                  { label: "Autonomia", value: cargo?.limite_autonomia_brl ? `R$${cargo.limite_autonomia_brl.toLocaleString("pt-BR")}` : "—" },
                  { label: "Pode fazer", value: `${podeFazer.length} ações` },
                  { label: "Conhecimento", value: `${conhecimentos.filter(c => c.conteudo.trim()).length} de ${SECOES_CONHECIMENTO.length} seções` },
                  { label: "Tokens estimados", value: `~${tokensEstimados}` },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-[#888] text-xs">{item.label}</span>
                    <span className="text-[#1a1a1a] text-xs font-bold">{item.value}</span>
                  </div>
                ))}
              </div>

              {erro && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{erro}</div>}

              <button onClick={salvar} disabled={salvando || !cargo || !nome.trim()}
                className="w-full font-black py-4 rounded-xl text-base transition-colors disabled:opacity-50"
                style={{ background: "#003b26", color: "#c9a24a" }}>
                {salvando ? "Criando agente..." : "✓ Criar e Ativar Agente"}
              </button>
            </div>
          )}

          {/* NAVEGAÇÃO */}
          <div className="flex gap-3 pt-2">
            {passo > 1 && (
              <button onClick={() => setPasso(p => p - 1)}
                className="flex-1 py-3 rounded-xl font-black border-2 border-[#003b26] text-[#003b26] transition-all hover:bg-[#003b26] hover:text-white">
                ← Anterior
              </button>
            )}
            {passo < totalPassos && (
              <button onClick={() => setPasso(p => p + 1)}
                disabled={passo === 1 && !cargo}
                className="flex-1 py-3 rounded-xl font-black text-white transition-colors disabled:opacity-40"
                style={{ background: "#003b26" }}>
                Próximo →
              </button>
            )}
          </div>
        </div>

        {/* PREVIEW DO PROMPT */}
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-20 rounded-xl overflow-hidden" style={{ background: "#003b26" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <p className="text-[#c9a24a] text-xs font-black uppercase tracking-wide">Preview do System Prompt</p>
              <p className="text-white text-xs opacity-50 mt-0.5">Gerado automaticamente do cargo + personalidade</p>
              <p className="text-[#c9a24a] text-xs mt-1">~{tokensEstimados} tokens</p>
            </div>
            <div className="p-4 max-h-[65vh] overflow-y-auto">
              <pre className="text-green-300 text-xs font-mono whitespace-pre-wrap leading-relaxed">{previewPrompt}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
