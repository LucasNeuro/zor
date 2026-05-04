"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Constants ────────────────────────────────────────────────────────────────

const SECOES = [
  { id: "empresa",     label: "Empresa",     icon: "🏢", desc: "História, valores, missão e identidade da empresa" },
  { id: "servicos",    label: "Serviços",    icon: "📦", desc: "Detalhes de cada serviço, preços e diferenciais" },
  { id: "atendimento", label: "Atendimento", icon: "💬", desc: "Como abordar, qualificar e conduzir para o fechamento" },
  { id: "proibicoes",  label: "Proibições",  icon: "🚫", desc: "O que nunca dizer, termos proibidos, temas sensíveis" },
  { id: "exemplos",    label: "Exemplos",    icon: "✍️", desc: "Diálogos modelo, respostas ideais, cases de sucesso" },
  { id: "objeccoes",   label: "Objeções",    icon: "🛡️", desc: "Como lidar com cada objeção comum do cliente" },
] as const;

type SecaoId = typeof SECOES[number]["id"];

// ─── Types ────────────────────────────────────────────────────────────────────

type Card = {
  id: string;
  agente_slug: string;
  secao: SecaoId;
  titulo: string;
  conteudo: string;
  ordem: number;
  ativo: boolean;
};

type Agente = {
  nome: string;
  cargo: string;
  area: string;
  nivel: number;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ConhecimentoPage() {
  const { slug } = useParams<{ slug: string }>();
  const [agente, setAgente] = useState<Agente | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [secao, setSecao] = useState<SecaoId>("empresa");
  const [salvando, setSalvando] = useState<Record<string, boolean>>({});
  const [previewAberto, setPreviewAberto] = useState(true);

  useEffect(() => {
    if (!slug) return;
    async function carregar() {
      const [{ data: ag }, { data: cds }] = await Promise.all([
        sb.from("hub_agente_identidade").select("nome, cargo, area, nivel").eq("agente_slug", slug).single(),
        sb.from("hub_agente_conhecimento").select("*").eq("agente_slug", slug).order("secao").order("ordem"),
      ]);
      if (ag) setAgente(ag as Agente);
      if (cds) setCards(cds as Card[]);
    }
    carregar();
  }, [slug]);

  async function adicionarCard() {
    const ordem = cards.filter(c => c.secao === secao).length;
    const { data } = await sb.from("hub_agente_conhecimento").insert({
      agente_slug: slug,
      secao,
      titulo: "",
      conteudo: "",
      ordem,
      ativo: true,
    }).select().single();
    if (data) setCards(prev => [...prev, data as Card]);
  }

  function atualizar(id: string, field: keyof Card, value: string | boolean) {
    setCards(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  async function salvarCard(id: string) {
    setSalvando(prev => ({ ...prev, [id]: true }));
    const card = cards.find(c => c.id === id);
    if (card) {
      await sb.from("hub_agente_conhecimento").update({
        titulo: card.titulo,
        conteudo: card.conteudo,
        ativo: card.ativo,
        atualizado_em: new Date().toISOString(),
      }).eq("id", id);
    }
    setSalvando(prev => ({ ...prev, [id]: false }));
  }

  async function toggleAtivo(id: string, atual: boolean) {
    const novoValor = !atual;
    atualizar(id, "ativo", novoValor);
    await sb.from("hub_agente_conhecimento").update({ ativo: novoValor, atualizado_em: new Date().toISOString() }).eq("id", id);
  }

  async function excluirCard(id: string) {
    await sb.from("hub_agente_conhecimento").delete().eq("id", id);
    setCards(prev => prev.filter(c => c.id !== id));
  }

  function montarPreview() {
    return SECOES.map(s => {
      const sCards = cards.filter(c => c.secao === s.id && c.ativo && c.conteudo.trim());
      if (!sCards.length) return "";
      return `## ${s.label.toUpperCase()}\n\n${sCards.map(c => `### ${c.titulo || "(sem título)"}\n${c.conteudo}`).join("\n\n")}`;
    }).filter(Boolean).join("\n\n---\n\n");
  }

  const cardsSecao = cards.filter(c => c.secao === secao);
  const preview = montarPreview();
  const totalTokens = Math.ceil(preview.length / 4);

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">

      {/* ─── HEADER ─── */}
      <div className="flex items-center gap-4 px-5 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <Link href="/crm/agentes" className="text-gray-500 hover:text-white transition-colors text-lg">←</Link>
        <div className="flex-1">
          {agente ? (
            <>
              <h1 className="text-white font-black text-base">{agente.nome} — Conhecimento</h1>
              <p className="text-gray-500 text-xs">{agente.cargo} · {agente.area} · N{agente.nivel}</p>
            </>
          ) : (
            <p className="text-gray-400 text-sm">Carregando agente...</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">{preview.length} chars · ≈ {totalTokens} tokens</span>
          <button onClick={() => setPreviewAberto(!previewAberto)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-colors ${previewAberto ? "border-orange-500 text-orange-500" : "border-gray-700 text-gray-400 hover:text-white"}`}>
            {previewAberto ? "◀ Preview" : "▶ Preview"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT: SECTION TABS ─── */}
        <div className="w-44 flex-shrink-0 bg-gray-900 border-r border-gray-800 overflow-y-auto">
          {SECOES.map(s => {
            const count = cards.filter(c => c.secao === s.id && c.ativo).length;
            const total = cards.filter(c => c.secao === s.id).length;
            return (
              <button key={s.id} onClick={() => setSecao(s.id)}
                className={`w-full px-4 py-3 text-left border-b border-gray-800 transition-colors ${secao === s.id ? "bg-gray-800" : "hover:bg-gray-800/50"}`}
                style={{ borderLeft: secao === s.id ? "3px solid #F97316" : "3px solid transparent" }}>
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-sm font-bold ${secao === s.id ? "text-white" : "text-gray-400"}`}>{s.icon} {s.label}</span>
                  {total > 0 && (
                    <span className="text-xs rounded-full px-1.5" style={{ backgroundColor: count > 0 ? "#22C55E20" : "#6B728020", color: count > 0 ? "#22C55E" : "#6B7280" }}>
                      {count}/{total}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ─── CENTER: EDITOR ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
            <div>
              <p className="text-white font-bold text-sm">{SECOES.find(s => s.id === secao)?.icon} {SECOES.find(s => s.id === secao)?.label}</p>
              <p className="text-gray-500 text-xs">{SECOES.find(s => s.id === secao)?.desc}</p>
            </div>
            <button onClick={adicionarCard}
              className="bg-orange-600 hover:bg-orange-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition-colors">
              + Adicionar card
            </button>
          </div>

          {/* Cards list */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cardsSecao.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">{SECOES.find(s => s.id === secao)?.icon}</p>
                <p className="text-gray-500 text-sm font-bold">{SECOES.find(s => s.id === secao)?.label}</p>
                <p className="text-gray-600 text-xs mt-1 mb-4">{SECOES.find(s => s.id === secao)?.desc}</p>
                <button onClick={adicionarCard} className="bg-orange-600 hover:bg-orange-500 text-white text-sm px-4 py-2 rounded-lg font-bold transition-colors">
                  + Adicionar primeiro card
                </button>
              </div>
            ) : cardsSecao.map(card => (
              <div key={card.id} className={`rounded-2xl border transition-all ${card.ativo ? "border-gray-700 bg-gray-900" : "border-gray-800 bg-gray-900/40 opacity-60"}`}>
                {/* Card header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
                  <input
                    value={card.titulo}
                    onChange={e => atualizar(card.id, "titulo", e.target.value)}
                    onBlur={() => salvarCard(card.id)}
                    placeholder="Título do conhecimento..."
                    className="flex-1 bg-transparent text-white font-bold text-sm outline-none placeholder:text-gray-600"
                  />
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {salvando[card.id] && <span className="text-gray-600 text-xs">salvando...</span>}
                    <button onClick={() => toggleAtivo(card.id, card.ativo)}
                      className={`relative w-8 h-4 rounded-full transition-colors ${card.ativo ? "bg-green-500" : "bg-gray-600"}`}>
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${card.ativo ? "left-4" : "left-0.5"}`} />
                    </button>
                    <button onClick={() => excluirCard(card.id)} className="text-gray-600 hover:text-red-400 transition-colors text-sm">✕</button>
                  </div>
                </div>
                {/* Card content */}
                <textarea
                  value={card.conteudo}
                  onChange={e => atualizar(card.id, "conteudo", e.target.value)}
                  onBlur={() => salvarCard(card.id)}
                  placeholder={`Escreva o conhecimento sobre ${SECOES.find(s => s.id === secao)?.label.toLowerCase()}... Seja específico e detalhado.`}
                  rows={6}
                  className="w-full bg-transparent text-gray-300 text-sm p-4 outline-none resize-none leading-relaxed placeholder:text-gray-700"
                />
                <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800">
                  <span className="text-gray-700 text-xs">{card.conteudo.length} chars · ≈ {Math.ceil(card.conteudo.length / 4)} tokens</span>
                  <button onClick={() => salvarCard(card.id)}
                    className="text-xs text-orange-500 hover:text-orange-400 font-bold transition-colors">
                    {salvando[card.id] ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── RIGHT: PREVIEW ─── */}
        {previewAberto && (
          <div className="w-72 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0 flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-xs">System Prompt Preview</p>
                <p className="text-gray-600 text-xs">{totalTokens} tokens estimados</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {preview ? (
                <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap leading-relaxed">{preview}</pre>
              ) : (
                <p className="text-gray-700 text-xs text-center mt-8">Adicione conhecimento para ver o preview</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
