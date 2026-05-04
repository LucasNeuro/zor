"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Aprovacao {
  id: string;
  tipo: string;
  agente_slug: string;
  descricao: string;
  motivo: string;
  impacto: string;
  confianca_ia?: number;
  valor_envolvido?: number;
  status: string;
  criado_em: string;
}

const TIPO_ICON: Record<string, string> = {
  proposta: "📋", campanha: "📊", conteudo: "✏️", site: "🌐",
  ajuste_agente: "🤖", trafego: "📈", contrato: "📜", financeiro: "💰", atendimento_critico: "🚨",
};
const TIPO_COR: Record<string, string> = {
  proposta: "border-blue-800 bg-blue-950", campanha: "border-orange-800 bg-orange-950",
  conteudo: "border-yellow-800 bg-yellow-950", site: "border-cyan-800 bg-cyan-950",
  ajuste_agente: "border-purple-800 bg-purple-950", trafego: "border-red-800 bg-red-950",
  contrato: "border-green-800 bg-green-950", financeiro: "border-emerald-800 bg-emerald-950",
  atendimento_critico: "border-red-700 bg-red-950",
};

export default function AprovacoesPage() {
  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);

  useEffect(() => {
    carregar();
    const sub = supabase.channel("aprovacoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function carregar() {
    const { data } = await supabase.from("hub_aprovacoes").select("*").eq("status", "pendente").order("criado_em", { ascending: false });
    if (data) setAprovacoes(data as Aprovacao[]);
    setCarregando(false);
  }

  async function aprovar(id: string) {
    setProcessando(id);
    await supabase.from("hub_aprovacoes").update({ status: "aprovado", aprovado_em: new Date().toISOString() }).eq("id", id);
    await carregar();
    setProcessando(null);
  }

  async function rejeitar(id: string) {
    setProcessando(id);
    await supabase.from("hub_aprovacoes").update({ status: "rejeitado", rejeitado_em: new Date().toISOString() }).eq("id", id);
    await carregar();
    setProcessando(null);
  }

  const tipos = ["todos", ...new Set(aprovacoes.map(a => a.tipo))];
  const filtradas = filtro === "todos" ? aprovacoes : aprovacoes.filter(a => a.tipo === filtro);

  const rel = (d: string) => {
    const m = (Date.now() - new Date(d).getTime()) / 60000;
    return m < 1 ? "agora" : m < 60 ? `${Math.round(m)}min` : `${Math.round(m / 60)}h`;
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-white font-bold text-lg">Central de Aprovações</h1>
          <p className="text-gray-500 text-xs">{aprovacoes.length} pendentes — tudo que precisa da sua decisão</p>
        </div>
        {aprovacoes.length > 0 && (
          <div className="flex items-center gap-2 bg-red-900 rounded-full px-3 py-1">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-red-300 text-xs font-bold">{aprovacoes.length} aguardando</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 px-6 py-3 border-b border-gray-800 overflow-x-auto">
        {tipos.map(t => (
          <button key={t} onClick={() => setFiltro(t)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${filtro === t ? "bg-orange-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
            {t === "todos" ? `Todos (${aprovacoes.length})` : `${TIPO_ICON[t] || "•"} ${t}`}
          </button>
        ))}
      </div>

      <div className="flex-1 p-6">
        {carregando ? (
          <div className="text-center text-gray-500 mt-12">Carregando aprovações...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-center mt-12">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-gray-400 font-bold">Nenhuma aprovação pendente</p>
            <p className="text-gray-600 text-sm mt-1">O sistema está operando normalmente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtradas.map(ap => (
              <div key={ap.id} className={`rounded-xl border p-4 ${TIPO_COR[ap.tipo] || "border-gray-700 bg-gray-900"}`}>
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-xl">{TIPO_ICON[ap.tipo] || "📌"}</span>
                  <div>
                    <p className="text-white font-bold text-sm leading-tight">{ap.descricao}</p>
                    <p className="text-gray-400 text-xs">{ap.agente_slug} · {rel(ap.criado_em)}</p>
                  </div>
                </div>
                <div className="mb-2">
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-1">O que observou:</p>
                  <p className="text-gray-300 text-xs">{ap.motivo}</p>
                </div>
                {ap.impacto && (
                  <div className="mb-2">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-1">Impacto:</p>
                    <p className="text-yellow-400 text-xs font-bold">{ap.impacto}</p>
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  {ap.valor_envolvido && ap.valor_envolvido > 0
                    ? <span className="text-green-400 text-xs font-bold">R$ {ap.valor_envolvido.toLocaleString("pt-BR")}</span>
                    : <span />}
                  {ap.confianca_ia && (
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${ap.confianca_ia}%` }} />
                      </div>
                      <span className="text-blue-400 text-xs">IA {ap.confianca_ia}%</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => aprovar(ap.id)} disabled={processando === ap.id}
                    className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs py-2 rounded-lg font-bold transition-colors">
                    {processando === ap.id ? "..." : "✅ Aprovar"}
                  </button>
                  <button onClick={() => rejeitar(ap.id)} disabled={processando === ap.id}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-xs py-2 rounded-lg transition-colors">
                    ❌ Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
