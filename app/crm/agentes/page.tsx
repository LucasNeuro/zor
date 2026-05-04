"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TIPO_FUNCOES = {
  atendimento: [
    { funcao: "SDR",             cargo: "Sales Development Representative",   area: "Atendimento" },
    { funcao: "Qualificador",    cargo: "Agente Qualificador de Leads",        area: "Atendimento" },
    { funcao: "Atendente",       cargo: "Agente de Atendimento",               area: "Atendimento" },
    { funcao: "Customer Success",cargo: "Especialista em Sucesso do Cliente",  area: "Atendimento" },
    { funcao: "Recepcionista",   cargo: "Recepcionista Virtual",               area: "Atendimento" },
  ],
  trafego: [
    { funcao: "Gestor de Tráfego", cargo: "Gestor de Tráfego Pago",                   area: "Performance" },
    { funcao: "Analista de Mídia", cargo: "Analista de Mídia Paga",                   area: "Performance" },
    { funcao: "Otimizador",        cargo: "Especialista em Otimização de Campanhas",  area: "Performance" },
  ],
  conteudo: [
    { funcao: "Copywriter",    cargo: "Redator e Copywriter",         area: "Conteúdo" },
    { funcao: "Social Media",  cargo: "Gestor de Redes Sociais",      area: "Conteúdo" },
    { funcao: "Designer",      cargo: "Designer Criativo",            area: "Design"   },
    { funcao: "Motion",        cargo: "Motion Designer",              area: "Design"   },
    { funcao: "Editor Vídeo",  cargo: "Editor de Vídeo e Conteúdo",  area: "Conteúdo" },
  ],
  sites: [
    { funcao: "Desenvolvedor Web", cargo: "Desenvolvedor Web Full Stack",   area: "Tecnologia" },
    { funcao: "SEO",               cargo: "Especialista em SEO",            area: "Marketing"  },
    { funcao: "Landing Page",      cargo: "Especialista em Landing Pages",  area: "Marketing"  },
  ],
  gestao: [
    { funcao: "Gerente",     cargo: "Gerente de Operações",    area: "Gestão" },
    { funcao: "Diretor",     cargo: "Diretor de Departamento", area: "Gestão" },
    { funcao: "Coordenador", cargo: "Coordenador de Equipe",   area: "Gestão" },
    { funcao: "Supervisor",  cargo: "Supervisor de Equipe",    area: "Gestão" },
  ],
  especialista: [
    { funcao: "Analista",       cargo: "Analista Especializado",    area: "Operações"  },
    { funcao: "Consultor",      cargo: "Consultor Técnico",         area: "Operações"  },
    { funcao: "Suporte Técnico",cargo: "Especialista em Suporte",   area: "Tecnologia" },
  ],
} as const;

type Tipo = keyof typeof TIPO_FUNCOES;

const NIVEIS = [
  { n: 1, label: "N1 — CEO"         },
  { n: 2, label: "N2 — Diretor"     },
  { n: 3, label: "N3 — Gerente"     },
  { n: 4, label: "N4 — Executor"    },
  { n: 5, label: "N5 — Especialista"},
];

const NIVEIS_COR: Record<number, string> = {
  1: "bg-red-900 text-red-300",
  2: "bg-orange-900 text-orange-300",
  3: "bg-yellow-900 text-yellow-300",
  4: "bg-blue-900 text-blue-300",
  5: "bg-gray-800 text-gray-300",
};

const MODELOS = [
  {
    id: "claude-haiku-4-5-20251001",
    label: "Haiku",
    desc: "Rápido e econômico — ideal para atendimento em volume",
    custo: "$0.25/M tokens",
    cor: "text-emerald-400",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Sonnet",
    desc: "Balanceado — recomendado para maioria dos casos",
    custo: "$3/M tokens",
    cor: "text-blue-400",
  },
  {
    id: "claude-opus-4-7",
    label: "Opus",
    desc: "Máxima capacidade — análises complexas e alto valor",
    custo: "$15/M tokens",
    cor: "text-purple-400",
  },
];

const HUMORES  = ["Focado", "Empático", "Analítico", "Criativo", "Urgente"];
const TONS     = ["Formal", "Profissional", "Descontraído", "Técnico", "Empático"];
const DIAS_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const ESCALAS = [
  { value: "humano_sempre",     label: "Sempre" },
  { value: "humano_lead_20k",   label: "Lead > R$20k" },
  { value: "humano_lead_50k",   label: "Lead > R$50k" },
  { value: "humano_lead_100k",  label: "Lead > R$100k" },
  { value: "ia_autonomo",       label: "Nunca (IA autônoma)" },
];
const CANAIS = [
  { id: "whatsapp",  label: "WhatsApp",  icon: "📱" },
  { id: "instagram", label: "Instagram", icon: "📷" },
  { id: "email",     label: "E-mail",    icon: "📧" },
  { id: "site",      label: "Site",      icon: "🌐" },
];

type Agente = Record<string, unknown>;

export default function AgentesPage() {
  /* ─── Block 1 state ─── */
  const [tipo, setTipo]           = useState<Tipo>("atendimento");
  const [funcaoIdx, setFuncaoIdx] = useState(0);
  const [nivel, setNivel]         = useState(4);
  const [modelo, setModelo]       = useState("claude-haiku-4-5-20251001");
  const [humor, setHumor]         = useState("Focado");
  const [tom, setTom]             = useState("Profissional");
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim]       = useState("18:00");
  const [dias, setDias] = useState([false, true, true, true, true, true, false]);

  /* ─── Block 2 state ─── */
  const [conhecimento, setConhecimento] = useState("");
  const [dicasAberta, setDicasAberta]   = useState(false);

  /* ─── Block 3 state ─── */
  const [regras, setRegras] = useState({
    preco: false, prazo: false, proposta: false, reuniao: true,
  });
  const [escala, setEscala]   = useState("humano_lead_20k");
  const [canais, setCanais]   = useState({ whatsapp: true, instagram: false, email: false, site: false });

  /* ─── List state ─── */
  const [agentes, setAgentes]     = useState<Agente[]>([]);
  const [salvando, setSalvando]   = useState(false);
  const [savedMsg, setSavedMsg]   = useState("");

  useEffect(() => { carregarAgentes(); }, []);

  async function carregarAgentes() {
    const { data } = await supabase.from("hub_agente_identidade").select("*").order("nivel");
    if (data) setAgentes(data);
  }

  /* ─── Derived ─── */
  const funcaoAtual = TIPO_FUNCOES[tipo][funcaoIdx] ?? TIPO_FUNCOES[tipo][0];
  const modeloAtual = MODELOS.find(m => m.id === modelo) ?? MODELOS[0];

  function gerarSlug(nome: string) {
    return nome.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
      + "_" + Date.now().toString(36);
  }

  function montarPrompt() {
    const diasStr = DIAS_LABELS.filter((_, i) => dias[i]).join(", ") || "nenhum dia";
    const regrasList = [
      regras.preco    ? "✓ Pode falar sobre preços e valores"     : "✗ Não fala sobre preços sem aprovação",
      regras.prazo    ? "✓ Pode prometer prazos de entrega"       : "✗ Não promete prazos sem aprovação",
      regras.proposta ? "✓ Pode enviar propostas comerciais"      : "✗ Não envia propostas sem aprovação",
      regras.reuniao  ? "✓ Pode agendar reuniões no calendário"   : "✗ Não agenda reuniões",
    ];
    const escalaLabel = ESCALAS.find(e => e.value === escala)?.label ?? escala;
    const canaisStr = CANAIS.filter(c => canais[c.id as keyof typeof canais]).map(c => c.label).join(", ") || "nenhum";

    return [
      `Você é ${funcaoAtual.funcao}, ${funcaoAtual.cargo} da empresa.`,
      `Área: ${funcaoAtual.area} | Nível: N${nivel}`,
      `Personalidade: ${humor} | Tom de voz: ${tom}`,
      `Horário: ${diasStr}, das ${horarioInicio} às ${horarioFim}`,
      "",
      conhecimento
        ? `CONHECIMENTO BASE:\n${conhecimento}`
        : "[Preencha o bloco 2 com o conhecimento deste agente]",
      "",
      "REGRAS DE OPERAÇÃO:",
      ...regrasList,
      "",
      `Escalada para humano: ${escalaLabel}`,
      `Canais habilitados: ${canaisStr}`,
    ].join("\n");
  }

  async function salvar() {
    setSalvando(true);
    const slug = gerarSlug(funcaoAtual.funcao);
    const systemPrompt = montarPrompt();
    const podeArr: string[] = [];
    const naoPodeArr: string[] = [];
    if (regras.preco)    podeArr.push("falar_preco");    else naoPodeArr.push("falar_preco");
    if (regras.prazo)    podeArr.push("prometer_prazo");  else naoPodeArr.push("prometer_prazo");
    if (regras.proposta) podeArr.push("enviar_proposta"); else naoPodeArr.push("enviar_proposta");
    if (regras.reuniao)  podeArr.push("agendar_reuniao"); else naoPodeArr.push("agendar_reuniao");

    const { error } = await supabase.from("hub_agente_identidade").insert({
      agente_slug: slug,
      nome: funcaoAtual.funcao,
      cargo: funcaoAtual.cargo,
      area: funcaoAtual.area,
      nivel,
      personalidade: humor,
      tom_voz: tom,
      estilo_comunicacao: `${humor}, ${tom}`,
      pode_fazer: podeArr,
      nao_pode_fazer: naoPodeArr,
      modelo_padrao: modelo,
      modelo_critico: "claude-sonnet-4-6",
      modelo_alto_valor: "claude-opus-4-7",
      system_prompt_base: systemPrompt,
      ativo: true,
      descricao: `${funcaoAtual.cargo} — ${funcaoAtual.area}. Tom ${tom.toLowerCase()}, estilo ${humor.toLowerCase()}.`,
    });

    if (!error) {
      const diasSemana = dias.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
      await supabase.from("hub_agente_configuracao").insert({
        agente_slug: slug,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
        dias_semana: diasSemana,
        fuso_horario: "America/Sao_Paulo",
        escalar_para: escala,
        motivos_escalada: CANAIS.filter(c => canais[c.id as keyof typeof canais]).map(c => c.id),
        configuracoes: { canais, regras },
        ativo: true,
      });
      setSavedMsg(`✅ ${funcaoAtual.funcao} criado com sucesso!`);
      setTimeout(() => setSavedMsg(""), 4000);
      await carregarAgentes();
    } else {
      setSavedMsg(`❌ Erro: ${error.message}`);
      setTimeout(() => setSavedMsg(""), 5000);
    }
    setSalvando(false);
  }

  async function toggleAtivo(slug: string, ativo: boolean) {
    await supabase.from("hub_agente_identidade").update({ ativo: !ativo }).eq("agente_slug", slug);
    setAgentes(prev => prev.map(a => a.agente_slug === slug ? { ...a, ativo: !ativo } : a));
  }

  const toggleDia = (i: number) => setDias(prev => { const n = [...prev]; n[i] = !n[i]; return n; });
  const toggleRegra = (k: keyof typeof regras) => setRegras(r => ({ ...r, [k]: !r[k] }));
  const toggleCanal = (k: keyof typeof canais) => setCanais(c => ({ ...c, [k]: !c[k] }));

  const promptPreview = montarPrompt();

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-white font-bold text-lg">Criar Agente de IA</h1>
          <p className="text-gray-500 text-xs">{agentes.length} agentes configurados · configure em 3 blocos</p>
        </div>
        <button onClick={salvar} disabled={salvando}
          className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg font-bold transition-colors">
          {salvando ? "Salvando..." : "✓ Criar Agente"}
        </button>
      </div>

      {savedMsg && (
        <div className={`px-6 py-2 border-b text-sm font-bold ${savedMsg.startsWith("✅") ? "bg-green-950 border-green-800 text-green-400" : "bg-red-950 border-red-800 text-red-400"}`}>
          {savedMsg}
        </div>
      )}

      {/* MAIN */}
      <div className="flex-1 p-6">
        <div className="flex gap-6 max-w-7xl mx-auto">

          {/* ── LEFT: 3 BLOCKS ── */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* ═══ BLOCO 1 — IDENTIDADE ═══ */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
                <div className="w-7 h-7 rounded-full bg-orange-600 flex items-center justify-center text-white font-black text-xs flex-shrink-0">1</div>
                <div>
                  <p className="text-white font-bold text-sm">Identidade</p>
                  <p className="text-gray-500 text-xs">Tipo, função, nível, modelo e personalidade</p>
                </div>
              </div>
              <div className="p-5 space-y-5">

                {/* Tipo + Função */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-xs font-bold uppercase tracking-wide block mb-2">Tipo de Agente</label>
                    <select value={tipo} onChange={e => { setTipo(e.target.value as Tipo); setFuncaoIdx(0); }}
                      className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:border-orange-500 outline-none">
                      <option value="atendimento">Atendimento</option>
                      <option value="trafego">Tráfego</option>
                      <option value="conteudo">Conteúdo</option>
                      <option value="sites">Sites</option>
                      <option value="gestao">Gestão</option>
                      <option value="especialista">Especialista</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-bold uppercase tracking-wide block mb-2">
                      Função <span className="text-gray-600 font-normal normal-case">— auto-preenche cargo e área</span>
                    </label>
                    <select value={funcaoIdx} onChange={e => setFuncaoIdx(Number(e.target.value))}
                      className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:border-orange-500 outline-none">
                      {TIPO_FUNCOES[tipo].map((f, i) => (
                        <option key={i} value={i}>{f.funcao}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Cargo / Área auto-filled */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                    <p className="text-gray-500 text-xs font-bold uppercase mb-1">Cargo (auto)</p>
                    <p className="text-white text-sm font-medium">{funcaoAtual.cargo}</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                    <p className="text-gray-500 text-xs font-bold uppercase mb-1">Área (auto)</p>
                    <p className="text-white text-sm font-medium">{funcaoAtual.area}</p>
                  </div>
                </div>

                {/* Nível */}
                <div>
                  <label className="text-gray-400 text-xs font-bold uppercase tracking-wide block mb-2">Nível Hierárquico</label>
                  <div className="flex gap-2">
                    {NIVEIS.map(n => (
                      <button key={n.n} onClick={() => setNivel(n.n)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${nivel === n.n ? "border-orange-500 bg-orange-600 text-white" : "border-gray-700 bg-gray-800 text-gray-400 hover:text-white"}`}>
                        N{n.n}
                      </button>
                    ))}
                  </div>
                  <p className="text-gray-600 text-xs mt-1">{NIVEIS.find(n => n.n === nivel)?.label}</p>
                </div>

                {/* Modelo */}
                <div>
                  <label className="text-gray-400 text-xs font-bold uppercase tracking-wide block mb-2">Modelo de IA</label>
                  <div className="space-y-2">
                    {MODELOS.map(m => (
                      <label key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${modelo === m.id ? "border-orange-500 bg-orange-950" : "border-gray-700 bg-gray-800 hover:border-gray-600"}`}>
                        <input type="radio" name="modelo" value={m.id} checked={modelo === m.id} onChange={() => setModelo(m.id)} className="accent-orange-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-bold">{m.label}</p>
                          <p className="text-gray-500 text-xs">{m.desc}</p>
                        </div>
                        <span className={`text-xs font-bold flex-shrink-0 ${m.cor}`}>{m.custo}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Personalidade */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-xs font-bold uppercase tracking-wide block mb-2">Humor</label>
                    <select value={humor} onChange={e => setHumor(e.target.value)}
                      className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:border-orange-500 outline-none">
                      {HUMORES.map(h => <option key={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-bold uppercase tracking-wide block mb-2">Tom de Voz</label>
                    <select value={tom} onChange={e => setTom(e.target.value)}
                      className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:border-orange-500 outline-none">
                      {TONS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Horário */}
                <div>
                  <label className="text-gray-400 text-xs font-bold uppercase tracking-wide block mb-2">Horário de Atendimento</label>
                  <div className="flex items-center gap-3 mb-3">
                    <input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)}
                      className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-orange-500 outline-none" />
                    <span className="text-gray-500 text-sm">até</span>
                    <input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)}
                      className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-orange-500 outline-none" />
                  </div>
                  <div className="flex gap-1.5">
                    {DIAS_LABELS.map((d, i) => (
                      <button key={i} onClick={() => toggleDia(i)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${dias[i] ? "bg-orange-600 text-white" : "bg-gray-800 text-gray-500 hover:text-white"}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* ═══ BLOCO 2 — CONHECIMENTO ═══ */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xs flex-shrink-0">2</div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">Conhecimento</p>
                  <p className="text-gray-500 text-xs">Tudo que este agente precisa saber — escreva livremente</p>
                </div>
                <button onClick={() => setDicasAberta(!dicasAberta)}
                  className="text-gray-500 hover:text-white text-xs transition-colors flex-shrink-0">
                  {dicasAberta ? "▲ ocultar dicas" : "▼ ver dicas"}
                </button>
              </div>

              {dicasAberta && (
                <div className="mx-5 mt-4 bg-blue-950 rounded-xl border border-blue-800 p-4">
                  <p className="text-blue-400 text-xs font-bold mb-2">💡 O que incluir:</p>
                  <ul className="space-y-1.5 text-blue-300 text-xs">
                    <li>• <strong>Sobre a empresa:</strong> "Somos uma construtora especializada em reformas residenciais em SP..."</li>
                    <li>• <strong>Serviços:</strong> "Oferecemos reforma completa, banheiro, cozinha, pintura, elétrica..."</li>
                    <li>• <strong>Abordagem:</strong> "Sempre perguntar o tipo de imóvel e o prazo desejado logo no início..."</li>
                    <li>• <strong>Objeções:</strong> "Quando o lead disser que está caro, mencionar o parcelamento em até 12x..."</li>
                    <li>• <strong>Qualificação:</strong> "Perguntar: bairro, tamanho do imóvel, orçamento disponível..."</li>
                  </ul>
                </div>
              )}

              <div className="p-5">
                <textarea
                  value={conhecimento}
                  onChange={e => setConhecimento(e.target.value)}
                  placeholder="Escreva aqui tudo que este agente precisa saber: sobre a empresa, serviços, como abordar o cliente, perguntas que deve fazer, como lidar com objeções..."
                  rows={11}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl p-4 border border-gray-700 focus:border-blue-500 outline-none resize-none leading-relaxed placeholder:text-gray-600"
                />
                <div className="flex justify-between mt-2 text-xs text-gray-600">
                  <span>{conhecimento.length} caracteres</span>
                  <span>≈ {Math.ceil(conhecimento.length / 4)} tokens</span>
                </div>
              </div>
            </div>

            {/* ═══ BLOCO 3 — REGRAS ═══ */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
                <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-white font-black text-xs flex-shrink-0">3</div>
                <div>
                  <p className="text-white font-bold text-sm">Regras & Limites</p>
                  <p className="text-gray-500 text-xs">O que este agente pode e não pode fazer</p>
                </div>
              </div>
              <div className="p-5 space-y-5">

                {/* Toggles */}
                <div className="space-y-2">
                  {[
                    { key: "preco"    as const, label: "Pode falar sobre preço?",   desc: "Compartilhar valores e tabelas de preço" },
                    { key: "prazo"    as const, label: "Pode prometer prazo?",       desc: "Comprometer datas de entrega ou início" },
                    { key: "proposta" as const, label: "Pode enviar proposta?",      desc: "Gerar e enviar orçamentos formais" },
                    { key: "reuniao"  as const, label: "Pode agendar reunião?",      desc: "Marcar horários no calendário" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl border border-gray-700">
                      <div>
                        <p className="text-white text-sm font-medium">{label}</p>
                        <p className="text-gray-500 text-xs">{desc}</p>
                      </div>
                      <button onClick={() => toggleRegra(key)}
                        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-3 ${regras[key] ? "bg-green-500" : "bg-gray-600"}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${regras[key] ? "left-7" : "left-1"}`} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Escala */}
                <div>
                  <label className="text-gray-400 text-xs font-bold uppercase tracking-wide block mb-2">Escala para humano quando:</label>
                  <select value={escala} onChange={e => setEscala(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:border-orange-500 outline-none">
                    {ESCALAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>

                {/* Canais */}
                <div>
                  <label className="text-gray-400 text-xs font-bold uppercase tracking-wide block mb-2">Canais Habilitados</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CANAIS.map(c => {
                      const ativo = canais[c.id as keyof typeof canais];
                      return (
                        <button key={c.id} onClick={() => toggleCanal(c.id as keyof typeof canais)}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${ativo ? "border-green-600 bg-green-950 text-green-400" : "border-gray-700 bg-gray-800 text-gray-500 hover:text-white"}`}>
                          <span>{c.icon}</span>
                          <span>{c.label}</span>
                          {ativo && <span className="ml-auto text-green-500 text-xs">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* ── RIGHT: PREVIEW PANEL (sticky) ── */}
          <div className="w-80 flex-shrink-0">
            <div className="sticky top-6">
              <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                  <p className="text-white font-bold text-sm">Preview — System Prompt</p>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                </div>
                <div className="p-4 space-y-3">

                  {/* Agent card */}
                  <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-white font-bold text-sm leading-tight">{funcaoAtual.funcao}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${NIVEIS_COR[nivel]}`}>N{nivel}</span>
                    </div>
                    <p className="text-gray-500 text-xs">{funcaoAtual.cargo}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs font-bold ${modeloAtual.cor}`}>{modeloAtual.label}</span>
                      <span className="text-gray-600 text-xs">·</span>
                      <span className="text-gray-500 text-xs">{funcaoAtual.area}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{humor}</span>
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{tom}</span>
                    </div>
                  </div>

                  {/* System prompt */}
                  <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 max-h-80 overflow-y-auto">
                    <p className="font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{promptPreview}</p>
                  </div>

                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{promptPreview.length} chars</span>
                    <span>≈ {Math.ceil(promptPreview.length / 4)} tokens</span>
                  </div>

                  <button onClick={salvar} disabled={salvando}
                    className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-xl font-bold transition-colors">
                    {salvando ? "Salvando..." : "✓ Criar Agente"}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ═══ AGENTS LIST ═══ */}
        <div className="max-w-7xl mx-auto mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-base">Agentes Configurados</h2>
            <span className="text-gray-500 text-xs">{agentes.length} agentes</span>
          </div>
          {agentes.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm">
              Nenhum agente configurado — crie o primeiro acima
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {agentes.map(ag => (
                <div key={ag.agente_slug as string} className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{ag.nome as string}</p>
                      <p className="text-gray-500 text-xs truncate">{ag.cargo as string}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${NIVEIS_COR[ag.nivel as number] ?? "bg-gray-800 text-gray-400"}`}>
                        N{ag.nivel as number}
                      </span>
                      <button onClick={() => toggleAtivo(ag.agente_slug as string, ag.ativo as boolean)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${ag.ativo ? "bg-green-500" : "bg-gray-600"}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${ag.ativo ? "left-5" : "left-0.5"}`} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ag.ativo ? "bg-green-400" : "bg-gray-600"}`} />
                    <span className="text-gray-600 text-xs truncate flex-1">{ag.modelo_padrao as string}</span>
                    <span className="text-gray-700 text-xs flex-shrink-0">{ag.area as string}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
