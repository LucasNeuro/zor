"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { CrmStickyTabs } from "@/components/crm/CrmStickyTabs";
import { Brain, ClipboardList, MessageSquare } from "lucide-react";

const ESTAGIOS = ["novo","qualificando","qualificado","proposta","negociando","fechamento","ganho","perdido"];
const ESTAGIO_COR: Record<string, string> = {
  novo: "#fbbf24", qualificando: "#60a5fa", qualificado: "#34d399",
  proposta: "#a78bfa", negociando: "#fb923c", fechamento: "#f4cf72",
  ganho: "#10b981", perdido: "#ef4444",
};

function tempoRelativo(data: string) {
  const diff = (Date.now() - new Date(data).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.round(diff / 60)}min`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return new Date(data).toLocaleDateString("pt-BR");
}

export default function LeadConversaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [lead, setLead] = useState<Record<string, unknown> | null>(null);
  const [mensagens, setMensagens] = useState<Record<string, unknown>[]>([]);
  const [atividades, setAtividades] = useState<Record<string, unknown>[]>([]);
  const [memorias, setMemorias] = useState<Record<string, unknown>[]>([]);
  const [aba, setAba] = useState<"conversa" | "atividades" | "memorias">("conversa");
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [assumido, setAssumido] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    const [l, m, a, mem] = await Promise.all([
      supabase.from("hub_leads_crm").select("*").eq("id", id).single(),
      supabase.from("hub_fila_mensagens").select("*").eq("lead_id", id).order("criado_em", { ascending: true }),
      supabase.from("hub_atividades").select("*").eq("lead_id", id).order("criado_em", { ascending: false }).limit(20),
      supabase.from("hub_memorias_lead").select("*").eq("lead_id", id).order("confianca", { ascending: false }),
    ]);
    if (l.data) setLead(l.data);
    if (m.data) setMensagens(m.data);
    if (a.data) setAtividades(a.data);
    if (mem.data) setMemorias(mem.data);
  }, [id]);

  useEffect(() => {
    carregar();
    const sub = supabase
      .channel(`lead-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hub_fila_mensagens", filter: `lead_id=eq.${id}` }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [id, carregar]);

  async function assumirAtendimento() {
    await supabase.from("hub_leads_crm").update({ humano_responsavel: "wendel" }).eq("id", id);
    await supabase.from("hub_atividades").insert({
      lead_id: id, tipo: "ia_acao", descricao: "Atendimento assumido por Wendel", feito_por: "wendel", feito_por_tipo: "humano",
    });
    setAssumido(true);
  }

  async function moverEstagio(estagio: string) {
    await supabase.from("hub_leads_crm").update({ estagio, atualizado_em: new Date().toISOString() }).eq("id", id);
    await supabase.from("hub_atividades").insert({
      lead_id: id, tipo: "status_change", descricao: `Estágio movido para: ${estagio}`, feito_por: "wendel", feito_por_tipo: "humano",
    });
    carregar();
  }

  async function enviarResposta() {
    if (!resposta.trim()) return;
    setEnviando(true);
    await supabase.from("hub_fila_mensagens").insert({
      lead_id: id, agente_id: "wendel", canal: "whatsapp", direcao: "saida",
      conteudo: resposta, status: "enviado",
      metadata: { feito_por: "humano", feito_por_nome: "Wendel" },
    });
    await supabase.from("hub_atividades").insert({
      lead_id: id, tipo: "mensagem", descricao: `Mensagem enviada: ${resposta.slice(0, 80)}`,
      feito_por: "wendel", feito_por_tipo: "humano",
    });
    setResposta("");
    setEnviando(false);
    carregar();
  }

  if (!lead) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">Carregando...</div>
  );

  const estagio = lead.estagio as string;
  const corEstagio = ESTAGIO_COR[estagio] || "#888";

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-white text-sm">←</button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold">{lead.nome as string}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: corEstagio + "22", color: corEstagio }}>
                {estagio}
              </span>
            </div>
            <p className="text-gray-500 text-xs">
              {lead.telefone as string} · {lead.origem as string}
              {(lead.valor_estimado as number) > 0 && ` · R$ ${((lead.valor_estimado as number) / 1000).toFixed(0)}k`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!assumido ? (
            <button onClick={assumirAtendimento}
              className="bg-[#c9a24a] hover:bg-[#e0b86a] text-white text-xs px-3 py-1.5 rounded-lg font-bold transition-colors">
              Assumir atendimento
            </button>
          ) : (
            <span className="bg-green-900 text-green-400 text-xs px-3 py-1.5 rounded-lg font-bold">✓ Você está atendendo</span>
          )}
        </div>
      </div>

      {/* MOVER ESTÁGIO */}
      <div className="flex gap-1 px-4 py-2 bg-gray-900 border-b border-gray-800 overflow-x-auto flex-shrink-0">
        {ESTAGIOS.map(e => (
          <button key={e} onClick={() => moverEstagio(e)}
            className={`text-xs px-2 py-1 rounded-full whitespace-nowrap transition-all ${estagio === e ? "font-bold" : "bg-gray-800 text-gray-500 hover:text-white"}`}
            style={estagio === e ? { backgroundColor: corEstagio + "33", color: corEstagio, border: `1px solid ${corEstagio}` } : {}}>
            {e}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ÁREA PRINCIPAL */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ABAS */}
          <CrmStickyTabs
            activeId={aba}
            onChange={(id) => setAba(id as typeof aba)}
            tabs={[
              { id: "conversa", label: `Conversa (${mensagens.length})`, icon: MessageSquare },
              { id: "atividades", label: `Atividades (${atividades.length})`, icon: ClipboardList },
              { id: "memorias", label: `Memórias IA (${memorias.length})`, icon: Brain },
            ]}
            style={{
              background: "rgba(17, 24, 39, 0.94)",
              borderBottom: "1px solid rgb(55, 65, 81)",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
            }}
          />

          {/* CONVERSA */}
          {aba === "conversa" && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {mensagens.length === 0 ? (
                  <div className="text-center text-gray-600 text-xs mt-8">Nenhuma mensagem ainda</div>
                ) : mensagens.map(msg => {
                  const entrada = (msg.direcao as string) === "entrada";
                  const meta = (msg.metadata as Record<string, unknown>) || {};
                  return (
                    <div key={msg.id as string} className={`flex ${entrada ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-xs flex flex-col gap-1 ${entrada ? "items-start" : "items-end"}`}>
                        {entrada && <span className="text-gray-600 text-xs ml-1">{(meta.pushName as string) || lead.nome as string}</span>}
                        <div className={`px-3 py-2 rounded-2xl text-sm ${entrada ? "bg-gray-800 text-gray-200 rounded-bl-sm" : "bg-[#003b26] text-white rounded-br-sm"}`}>
                          <p>{msg.conteudo as string}</p>
                        </div>
                        <span className="text-gray-600 text-xs">{tempoRelativo(msg.criado_em as string)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CAMPO DE RESPOSTA */}
              <div className="flex-shrink-0 p-3 bg-gray-900 border-t border-gray-800">
                {!assumido && <p className="text-yellow-600 text-xs mb-2 text-center">Assuma o atendimento para responder</p>}
                <div className="flex gap-2">
                  <textarea
                    value={resposta} onChange={e => setResposta(e.target.value)} disabled={!assumido}
                    placeholder={assumido ? "Digite sua resposta..." : "Assuma o atendimento para responder"}
                    rows={2}
                    className="flex-1 bg-gray-800 disabled:opacity-50 text-white text-sm rounded-xl px-3 py-2 outline-none resize-none border border-gray-700 focus:border-[#c9a24a] placeholder-gray-600"
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarResposta(); } }}
                  />
                  <button onClick={enviarResposta} disabled={!assumido || !resposta.trim() || enviando}
                    className="bg-[#c9a24a] hover:bg-[#e0b86a] disabled:opacity-50 text-white px-4 rounded-xl font-bold text-sm transition-colors">
                    {enviando ? "..." : "→"}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ATIVIDADES */}
          {aba === "atividades" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {atividades.map(at => (
                <div key={at.id as string} className="flex gap-3 pb-3 border-b border-gray-800">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm flex-shrink-0">
                    {(at.feito_por_tipo as string) === "ia" ? "🤖" : "👤"}
                  </div>
                  <div>
                    <p className="text-gray-300 text-xs">{at.descricao as string}</p>
                    <p className="text-gray-600 text-xs mt-1">{at.feito_por as string} · {tempoRelativo(at.criado_em as string)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MEMÓRIAS */}
          {aba === "memorias" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <p className="text-gray-500 text-xs mb-3">O que a IA aprendeu sobre este lead:</p>
              {memorias.map(mem => (
                <div key={mem.id as string} className="bg-gray-900 rounded-lg p-3 border border-gray-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#c9a24a] text-xs font-bold">{(mem.chave || mem.tipo) as string}</span>
                    <span className="text-gray-600 text-xs">confiança: {(((mem.confianca || mem.relevancia) as number) * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-gray-300 text-sm">{(mem.valor || mem.conteudo) as string}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PAINEL LATERAL */}
        <div className="w-56 flex-shrink-0 border-l border-gray-800 overflow-y-auto p-3 space-y-3">
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">Dados</p>
            <div className="space-y-1.5">
              {[
                { label: "Score",       value: `${lead.score || 0}/100` },
                { label: "Origem",      value: lead.origem as string },
                { label: "Agente",      value: (lead.agente_responsavel as string) || "—" },
                { label: "Responsável", value: (lead.humano_responsavel as string) || "IA" },
                { label: "Valor",       value: (lead.valor_estimado as number) > 0 ? `R$ ${((lead.valor_estimado as number) / 1000).toFixed(0)}k` : "—" },
              ].map(f => (
                <div key={f.label} className="bg-gray-900 rounded-lg p-2">
                  <p className="text-gray-600 text-xs">{f.label}</p>
                  <p className="text-white text-xs font-bold">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wide mb-2">Ações</p>
            <div className="space-y-1.5">
              {[
                { label: "✓ Marcar ganho",   acao: () => moverEstagio("ganho") },
                { label: "✗ Marcar perdido", acao: () => moverEstagio("perdido") },
                { label: "← Voltar",          acao: () => router.back() },
              ].map(a => (
                <button key={a.label} onClick={a.acao}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-white text-xs py-2 px-3 rounded-lg text-left transition-colors">
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
