"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface Msg {
  id: string;
  lead_id: string;
  conteudo: string;
  criado_em: string;
  status: string;
  metadata?: Record<string, unknown>;
  lead?: { nome: string; estagio: string };
}

export default function LiveMessageFeed() {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [aberto, setAberto] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("hub_fila_mensagens")
      .select("*, lead:hub_leads_crm(nome, estagio)")
      .eq("direcao", "entrada")
      .order("criado_em", { ascending: false })
      .limit(10);
    if (data) {
      setMsgs(data as Msg[]);
      setNaoLidas(data.filter((m: Msg) => m.status === "pendente").length);
    }
  }, []);

  useEffect(() => {
    carregar();
    const sub = supabase.channel("feed-msgs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hub_fila_mensagens" }, () => {
        carregar();
        if (!aberto) setNaoLidas(n => n + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [carregar, aberto]);

  function tempo(d: string) {
    const m = (Date.now() - new Date(d).getTime()) / 60000;
    if (m < 1) return "agora";
    if (m < 60) return `${Math.round(m)}min`;
    return `${Math.round(m / 60)}h`;
  }

  function corUrgencia(d: string) {
    const m = (Date.now() - new Date(d).getTime()) / 60000;
    if (m > 15) return "#b3261e";
    if (m > 5) return "#c9a24a";
    return "#003b26";
  }

  return (
    <div className="absolute bottom-4 left-4 z-30">
      <button
        onClick={() => { setAberto(p => !p); if (!aberto) setNaoLidas(0); }}
        className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold shadow-lg transition-all"
        style={{
          background: naoLidas > 0 ? "#c9a24a" : "#161b22",
          color: naoLidas > 0 ? "#003b26" : "#e6edf3",
          border: "1px solid #30363d",
        }}>
        <div className={`w-2 h-2 rounded-full ${naoLidas > 0 ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
        {aberto ? "Fechar" : `💬 Mensagens${naoLidas > 0 ? ` (${naoLidas})` : ""}`}
      </button>

      {aberto && (
        <div className="mt-2 rounded-xl overflow-hidden shadow-2xl" style={{ width: "300px", background: "#161b22", border: "1px solid #30363d" }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid #30363d", background: "#0d1117" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-white text-xs font-bold">Mensagens ao vivo</p>
            </div>
            <button onClick={() => router.push("/crm/atendimento")} className="text-xs" style={{ color: "#c9a24a", background: "none", border: "none", cursor: "pointer" }}>
              Ver tudo →
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {msgs.length === 0 ? (
              <p className="text-center text-xs py-6" style={{ color: "#484f58" }}>Aguardando mensagens...</p>
            ) : msgs.map(msg => {
              const cor = corUrgencia(msg.criado_em);
              const lead = msg.lead as { nome?: string } | undefined;
              return (
                <div key={msg.id} className="p-3" style={{ borderBottom: "1px solid #30363d" }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-white text-xs font-bold truncate flex-1">
                      {lead?.nome || "Lead"}
                    </p>
                    <span className="text-xs ml-2" style={{ color: cor }}>{tempo(msg.criado_em)}</span>
                  </div>
                  <p className="text-xs mb-2 truncate" style={{ color: "#8b949e" }}>{msg.conteudo}</p>
                  <button
                    onClick={() => { router.push(`/crm/leads/${msg.lead_id}`); setAberto(false); }}
                    className="w-full py-1.5 rounded-lg text-xs font-bold text-white"
                    style={{ background: cor, border: "none", cursor: "pointer" }}>
                    Atender →
                  </button>
                </div>
              );
            })}
          </div>

          <div className="p-2 flex gap-2" style={{ borderTop: "1px solid #30363d", background: "#0d1117" }}>
            <button onClick={() => router.push("/crm/leads")} className="flex-1 py-1.5 rounded-lg text-xs" style={{ background: "#21262d", color: "#8b949e", border: "none", cursor: "pointer" }}>Pipeline</button>
            <button onClick={() => router.push("/crm/atendimento")} className="flex-1 py-1.5 rounded-lg text-xs font-bold" style={{ background: "#003b26", color: "#c9a24a", border: "none", cursor: "pointer" }}>Atendimento</button>
          </div>
        </div>
      )}
    </div>
  );
}
