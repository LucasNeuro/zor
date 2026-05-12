"use client";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";

interface Lead {
  id: string;
  nome: string;
  valor_estimado?: number;
  estagio: string;
  origem: string;
  criado_em: string;
}

interface Mensagem {
  id: string;
  conteudo: string;
  direcao: "entrada" | "saida";
  criado_em: string;
  agente_id?: string;
}

const STATUS_COR: Record<string, string> = {
  novo: "bg-yellow-500", qualificando: "bg-cyan-500", qualificado: "bg-green-500",
  atendimento: "bg-blue-500", negociando: "bg-purple-500", fechamento: "bg-orange-500",
  ganho: "bg-emerald-500", perdido: "bg-red-500",
};
const STATUS_LABEL: Record<string, string> = {
  novo: "Novo", qualificando: "Qualificando", qualificado: "Qualificado",
  atendimento: "Em Atendimento", negociando: "Negociando",
  fechamento: "Fechamento", ganho: "Ganho", perdido: "Perdido",
};

export default function AtendimentoPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSel, setLeadSel] = useState<Lead | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    carregarLeads();
    const t = setInterval(carregarLeads, 30000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  useEffect(() => { if (leadSel) carregarMensagens(leadSel.id); }, [leadSel]);

  async function carregarLeads() {
    const qs = filtro !== "todos" ? `?estagio=${filtro}` : "";
    const res = await fetch(`/api/crm/atendimento${qs}`, { headers: internalApiHeaders() });
    const json = await res.json();
    setLeads((json.leads ?? []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      nome: (d.nome as string) || "Lead",
      estagio: (d.estagio as string) || "novo",
      origem: (d.origem as string) || "whatsapp",
      valor_estimado: d.valor_estimado as number,
      criado_em: d.criado_em as string,
    })));
    setCarregando(false);
  }

  async function carregarMensagens(leadId: string) {
    const { data } = await supabase.from("hub_fila_mensagens").select("*").eq("lead_id", leadId).order("criado_em", { ascending: true }).limit(50);
    if (data) {
      setMensagens(data.map((m: Record<string, unknown>) => ({
        id: m.id as string, conteudo: m.conteudo as string,
        direcao: m.direcao as "entrada" | "saida", criado_em: m.criado_em as string, agente_id: m.agente_id as string,
      })));
    }
  }

  const filtrados = leads.filter(l =>
    (!busca || l.nome.toLowerCase().includes(busca.toLowerCase()))
  );

  const rel = (d: string) => {
    const m = (Date.now() - new Date(d).getTime()) / 60000;
    return m < 1 ? "agora" : m < 60 ? `${Math.round(m)}min` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
  };

  useEffect(() => {
    setSlot({
      path: pathname,
      subtitle: `${leads.length} conversas ativas`,
      actions: (
        <div className="flex items-center gap-2 rounded-full bg-gray-800 px-3 py-1.5">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          <span className="text-xs font-bold text-green-400">Ariane online</span>
        </div>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, leads.length]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950">
      <div className="flex flex-1 overflow-hidden">
        {/* Lista */}
        <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-800">
          <div className="p-3 border-b border-gray-800 space-y-2">
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar lead..."
              className="w-full bg-gray-800 text-white text-xs rounded-lg px-3 py-2 outline-none border border-gray-700 focus:border-orange-500" />
            <div className="flex gap-1 flex-wrap">
              {["todos","novo","qualificando","qualificado","atendimento","negociando"].map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`text-xs px-2 py-1 rounded-full transition-colors ${filtro === f ? "bg-orange-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
                  {f === "todos" ? "Todos" : STATUS_LABEL[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {carregando ? <div className="p-4 text-center text-gray-500 text-xs">Carregando...</div>
            : filtrados.length === 0 ? <div className="p-4 text-center text-gray-500 text-xs">Nenhum lead</div>
            : filtrados.map(lead => (
              <button key={lead.id} onClick={() => setLeadSel(lead)}
                className={`w-full p-3 border-b border-gray-800 text-left hover:bg-gray-800 transition-colors ${leadSel?.id === lead.id ? "bg-gray-800 border-l-2 border-l-orange-500" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${STATUS_COR[lead.estagio] || "bg-gray-500"}`} />
                    <span className="text-white text-xs font-bold truncate max-w-[140px]">{lead.nome}</span>
                  </div>
                  <span className="text-gray-500 text-xs">{rel(lead.criado_em)}</span>
                </div>
                <span className="text-gray-500 text-xs">{lead.origem}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!leadSel ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center"><div className="text-4xl mb-3">💬</div>
                <p className="text-gray-500 text-sm">Selecione um lead</p></div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                <div>
                  <div className="text-white font-bold text-sm">{leadSel.nome}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COR[leadSel.estagio]}`} />
                    <span className="text-gray-400 text-xs">{STATUS_LABEL[leadSel.estagio]}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold transition-colors">Assumir</button>
                  <button className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">Ver no CRM</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {mensagens.length === 0
                  ? <div className="text-center text-gray-600 text-xs mt-8">Nenhuma mensagem</div>
                  : mensagens.map(msg => (
                    <div key={msg.id} className={`flex ${msg.direcao === "saida" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-xs px-3 py-2 rounded-2xl text-xs ${msg.direcao === "saida" ? "bg-orange-700 text-white rounded-br-sm" : "bg-gray-800 text-gray-200 rounded-bl-sm"}`}>
                        <p>{msg.conteudo}</p>
                        <p className={`text-xs mt-1 ${msg.direcao === "saida" ? "text-orange-300" : "text-gray-500"}`}>{rel(msg.criado_em)}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
              <div className="p-3 bg-gray-900 border-t border-gray-800 flex-shrink-0">
                <div className="flex gap-2">
                  <button className="flex-1 bg-orange-600 hover:bg-orange-500 text-white text-xs py-2 rounded-lg font-bold transition-colors">Assumir atendimento</button>
                  <button className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-2 rounded-lg transition-colors">Agendar</button>
                  <button className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-2 rounded-lg transition-colors">Encerrar</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Painel direito */}
        {leadSel && (
          <div className="w-64 flex-shrink-0 border-l border-gray-800 overflow-y-auto p-3 space-y-3">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">Informações</p>
            <div className="space-y-2">
              {[
                { label: "Status", value: STATUS_LABEL[leadSel.estagio] },
                { label: "Origem", value: leadSel.origem },
                { label: "Criado em", value: new Date(leadSel.criado_em).toLocaleDateString("pt-BR") },
              ].map(i => (
                <div key={i.label} className="bg-gray-800 rounded-lg p-2">
                  <p className="text-gray-500 text-xs">{i.label}</p>
                  <p className="text-white text-xs font-bold capitalize">{i.value}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wide">Ações rápidas</p>
            <div className="space-y-1.5">
              {["📋 Abrir no CRM", "📅 Agendar reunião", "👤 Atribuir agente", "📝 Adicionar nota"].map(a => (
                <button key={a} className="w-full bg-gray-800 hover:bg-gray-700 text-white text-xs py-2 rounded-lg text-left px-3 transition-colors">{a}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
