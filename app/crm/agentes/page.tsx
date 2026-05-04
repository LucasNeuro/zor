"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const NIVEIS = [
  { n: 1, label: "N1 — CEO",         cor: "bg-red-800 text-white" },
  { n: 2, label: "N2 — Diretor",      cor: "bg-orange-800 text-white" },
  { n: 3, label: "N3 — Gerente",      cor: "bg-yellow-800 text-white" },
  { n: 4, label: "N4 — Executor",     cor: "bg-blue-800 text-white" },
  { n: 5, label: "N5 — Especialista", cor: "bg-gray-700 text-white" },
];

type Agente = Record<string, unknown>;
type Aba = "identidade" | "config" | "kpis" | "autonomia";

export default function AgentesPage() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [selecionado, setSelecionado] = useState<Agente | null>(null);
  const [aba, setAba] = useState<Aba>("identidade");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.from("hub_agente_identidade").select("*").order("nivel").then(({ data }) => {
      if (data) setAgentes(data);
      setCarregando(false);
    });
  }, []);

  const nivelInfo = (n: number) => NIVEIS.find(nl => nl.n === n) || NIVEIS[3];

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-white font-bold text-lg">Gestão de Agentes</h1>
          <p className="text-gray-500 text-xs">{agentes.length} agentes configurados</p>
        </div>
        <button className="bg-orange-600 hover:bg-orange-500 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors">+ Novo Agente</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Lista */}
        <div className="w-72 flex-shrink-0 border-r border-gray-800 overflow-y-auto">
          {carregando ? <div className="p-4 text-center text-gray-500 text-xs">Carregando...</div>
          : agentes.map(ag => {
            const nivel = nivelInfo(ag.nivel as number);
            return (
              <button key={ag.agente_slug as string} onClick={() => { setSelecionado(ag); setAba("identidade"); }}
                className={`w-full p-4 border-b border-gray-800 text-left hover:bg-gray-800 transition-colors ${selecionado?.agente_slug === ag.agente_slug ? "bg-gray-800 border-l-2 border-l-orange-500" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-bold text-sm">{ag.nome as string}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${nivel.cor}`}>N{ag.nivel as number}</span>
                </div>
                <p className="text-gray-500 text-xs">{ag.cargo as string}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${ag.ativo ? "bg-green-400" : "bg-gray-600"}`} />
                  <span className="text-gray-600 text-xs">{ag.modelo_padrao as string}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detalhe */}
        <div className="flex-1 overflow-y-auto">
          {!selecionado ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center"><div className="text-4xl mb-3">🤖</div>
                <p className="text-gray-500">Selecione um agente</p></div>
            </div>
          ) : (
            <div className="p-6 max-w-3xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-white font-bold text-xl">{selecionado.nome as string}</h2>
                  <p className="text-gray-400 text-sm">{selecionado.cargo as string} — {selecionado.area as string}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${selecionado.ativo ? "bg-green-400" : "bg-gray-600"}`} />
                  <span className="text-gray-400 text-xs">{selecionado.ativo ? "Ativo" : "Inativo"}</span>
                </div>
              </div>

              <div className="flex border-b border-gray-800 mb-6">
                {(["identidade","config","kpis","autonomia"] as Aba[]).map(a => (
                  <button key={a} onClick={() => setAba(a)}
                    className={`px-4 py-2 text-xs font-medium transition-colors capitalize ${aba === a ? "text-orange-400 border-b-2 border-orange-400" : "text-gray-500 hover:text-gray-300"}`}>
                    {a === "identidade" ? "Identidade" : a === "config" ? "Configuração" : a === "kpis" ? "KPIs" : "Autonomia"}
                  </button>
                ))}
              </div>

              {aba === "identidade" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Nome", value: selecionado.nome as string },
                      { label: "Nível", value: `N${selecionado.nivel} — ${nivelInfo(selecionado.nivel as number).label}` },
                      { label: "Modelo", value: selecionado.modelo_padrao as string },
                      { label: "Área", value: selecionado.area as string },
                    ].map(i => (
                      <div key={i.label} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                        <p className="text-gray-500 text-xs font-bold uppercase mb-1">{i.label}</p>
                        <p className="text-white font-bold">{i.value}</p>
                      </div>
                    ))}
                  </div>
                  {selecionado.descricao != null && (
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                      <p className="text-gray-500 text-xs font-bold uppercase mb-2">Descrição</p>
                      <p className="text-gray-300 text-sm">{String(selecionado.descricao)}</p>
                    </div>
                  )}
                  <div className="bg-yellow-950 rounded-lg p-4 border border-yellow-800">
                    <p className="text-yellow-400 text-xs font-bold">⚠️ Alterações em agentes geram card de aprovação — nenhuma mudança é aplicada sem sua confirmação.</p>
                  </div>
                </div>
              )}

              {aba === "config" && (
                <div className="space-y-4">
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <p className="text-gray-500 text-xs font-bold uppercase mb-3">System Prompt Base</p>
                    <div className="bg-gray-800 rounded p-3 text-gray-300 text-xs font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {selecionado.system_prompt_base as string || "Não configurado"}
                    </div>
                  </div>
                </div>
              )}

              {aba === "kpis" && (
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-center">
                  <p className="text-gray-500 text-sm mb-2">Veja as metas deste agente em:</p>
                  <a href="/crm/kpis" className="text-orange-400 text-sm font-bold hover:underline">Painel de KPIs →</a>
                </div>
              )}

              {aba === "autonomia" && (
                <div className="space-y-4">
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <p className="text-gray-500 text-xs font-bold uppercase mb-2">Limite Financeiro Autônomo</p>
                    <p className="text-white font-bold text-xl">R$ 0</p>
                    <p className="text-gray-500 text-xs mt-1">Acima deste valor escala para humano</p>
                  </div>
                  <div className="bg-red-950 rounded-lg p-4 border border-red-800">
                    <p className="text-red-400 text-xs font-bold mb-2">🔒 Nunca autônomo:</p>
                    <ul className="space-y-1">
                      {["Enviar proposta","Pausar campanha","Publicar conteúdo","Assinar contrato","Dar desconto"].map(a => (
                        <li key={a} className="text-red-300 text-xs">• {a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
