"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MERCADO_EMOJI: Record<string, string> = {
  imobiliario: "🏠", arquitetura: "🏛", reforma: "🔨",
  fornecedor: "🤝", produto: "📦", geral: "📌",
};

const MERCADO_COR: Record<string, string> = {
  imobiliario: "#8b5cf6", arquitetura: "#f59e0b", reforma: "#f97316",
  fornecedor: "#22c55e", produto: "#06b6d4", geral: "#6b7280",
};

interface Mensagem {
  id: string;
  lead_id: string;
  conteudo: string;
  direcao: string;
  status: string;
  criado_em: string;
  metadata?: { pushName?: string; mercado?: string; telefone?: string };
  lead?: { nome: string; estagio: string; atualizado_em: string };
}

function tempoRelativo(data: string): string {
  const diff = (Date.now() - new Date(data).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.round(diff / 60)}min`;
  return `${Math.round(diff / 3600)}h`;
}

export default function LiveMessageFeed() {
  const router = useRouter();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [aberto, setAberto] = useState(true);
  const [novaMsg, setNovaMsg] = useState(false);

  useEffect(() => {
    carregarMensagens();

    const sub = supabase
      .channel("live-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hub_fila_mensagens" }, (payload) => {
        const nova = payload.new as Mensagem;
        setMensagens(prev => [nova, ...prev].slice(0, 10));
        setNovaMsg(true);
        setTimeout(() => setNovaMsg(false), 3000);
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  async function carregarMensagens() {
    const { data } = await supabase
      .from("hub_fila_mensagens")
      .select("*, lead:hub_leads_crm(nome, estagio, atualizado_em)")
      .eq("direcao", "entrada")
      .order("criado_em", { ascending: false })
      .limit(8);
    if (data) setMensagens(data as Mensagem[]);
  }

  async function assumir(leadId: string) {
    await supabase
      .from("hub_leads_crm")
      .update({ humano_responsavel: "wendel", atualizado_em: new Date().toISOString() })
      .eq("id", leadId);
    router.push(`/crm/atendimento?lead=${leadId}`);
  }

  const criticos = mensagens.filter(m => {
    const mins = (Date.now() - new Date(m.criado_em).getTime()) / 1000 / 60;
    return mins > 15 && m.status === "pendente";
  });

  return (
    <div className={`fixed bottom-4 left-4 z-50 transition-all duration-300 ${aberto ? "w-80" : "w-auto"}`}>
      {/* BOTÃO TOGGLE */}
      <button
        onClick={() => setAberto(p => !p)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold transition-all shadow-lg ${
          criticos.length > 0 ? "bg-red-600 text-white animate-pulse"
          : novaMsg ? "bg-orange-600 text-white"
          : "bg-gray-900 text-gray-300 border border-gray-700"
        }`}
      >
        <div className={`w-2 h-2 rounded-full ${criticos.length > 0 ? "bg-white" : "bg-green-400"} animate-pulse`} />
        {aberto ? "✕ Fechar" : `💬 Ao Vivo${mensagens.length > 0 ? ` (${mensagens.length})` : ""}`}
        {criticos.length > 0 && (
          <span className="bg-white text-red-600 rounded-full w-4 h-4 flex items-center justify-center text-xs font-black">
            {criticos.length}
          </span>
        )}
      </button>

      {/* FEED */}
      {aberto && (
        <div className="mt-2 bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
          {/* HEADER */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-white text-xs font-bold">Mensagens ao vivo</span>
            </div>
            <div className="flex gap-2">
              {criticos.length > 0 && (
                <span className="bg-red-800 text-red-300 text-xs px-2 py-0.5 rounded-full">
                  {criticos.length} crítico{criticos.length > 1 ? "s" : ""}
                </span>
              )}
              <button onClick={() => router.push("/crm/atendimento")} className="text-orange-400 text-xs hover:text-orange-300 transition-colors">
                Ver tudo →
              </button>
            </div>
          </div>

          {/* LISTA */}
          <div className="max-h-72 overflow-y-auto">
            {mensagens.length === 0 ? (
              <div className="p-4 text-center text-gray-600 text-xs">Aguardando mensagens...</div>
            ) : mensagens.map(msg => {
              const mercado = msg.metadata?.mercado || "geral";
              const leadData = msg.lead as { nome?: string } | undefined;
              const nome = msg.metadata?.pushName || leadData?.nome || "Lead";
              const mins = (Date.now() - new Date(msg.criado_em).getTime()) / 1000 / 60;
              const critico = mins > 15 && msg.status === "pendente";
              const emoji = MERCADO_EMOJI[mercado] || "📌";
              const cor = MERCADO_COR[mercado] || "#6b7280";

              return (
                <div key={msg.id} className={`p-3 border-b border-gray-800 ${critico ? "bg-red-950" : "hover:bg-gray-900"} transition-colors`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{emoji}</span>
                      <span className="text-white text-xs font-bold truncate max-w-[120px]">{nome}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: cor + "22", color: cor, fontSize: "10px" }}>
                        {mercado}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {critico && <span className="text-red-400 text-xs font-bold">⚠️</span>}
                      <span className="text-gray-600 text-xs">{tempoRelativo(msg.criado_em)}</span>
                    </div>
                  </div>
                  <p className={`text-xs mb-2 truncate ${critico ? "text-red-300" : "text-gray-400"}`}>{msg.conteudo}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${critico ? "text-red-400 font-bold" : "text-gray-600"}`}>
                      {critico ? `⏰ ${Math.round(mins)}min sem resposta` : msg.status}
                    </span>
                    <button
                      onClick={() => assumir(msg.lead_id)}
                      className={`text-xs px-2 py-1 rounded-lg font-bold transition-colors ${critico ? "bg-red-600 hover:bg-red-500 text-white" : "bg-[#c9a24a] hover:bg-[#e0b86a] text-white"}`}
                    >
                      {critico ? "Assumir agora" : "Assumir →"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* FOOTER */}
          <div className="px-3 py-2 bg-gray-900 border-t border-gray-800 flex gap-2">
            <button onClick={() => router.push("/crm/leads")} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-1.5 rounded-lg transition-colors">
              Pipeline
            </button>
            <button onClick={() => router.push("/crm/atendimento")} className="flex-1 bg-[#c9a24a] hover:bg-[#e0b86a] text-white text-xs py-1.5 rounded-lg font-bold transition-colors">
              Atendimento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
