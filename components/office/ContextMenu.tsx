"use client";
import type { ReactNode } from "react";

type Visao = "geral" | "atendimento" | "trafego" | "conteudo" | "sites" | "agentes" | "governanca" | "relatorios";

interface NavItem {
  id: Visao;
  label: string;
  icon: string;
  badge?: number;
  badgeColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "geral", label: "Geral", icon: "⚡" },
  { id: "atendimento", label: "Atendimento", icon: "💬", badge: 18, badgeColor: "#22c55e" },
  { id: "trafego", label: "Tráfego", icon: "📡", badge: 2, badgeColor: "#ef4444" },
  { id: "conteudo", label: "Conteúdo", icon: "✍️", badge: 5, badgeColor: "#f59e0b" },
  { id: "sites", label: "Sites", icon: "🌐" },
  { id: "agentes", label: "Agentes", icon: "🤖", badge: 18, badgeColor: "#60a5fa" },
  { id: "governanca", label: "Governança", icon: "⚖️", badge: 3, badgeColor: "#ef4444" },
  { id: "relatorios", label: "Relatórios", icon: "📊" },
];

const CONTEXT_CONTENT: Record<Visao, ReactNode> = {
  geral: (
    <div className="space-y-3">
      <div className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Visão Geral</div>
      <div className="space-y-1.5">
        {["Funil de Leads", "Pipeline CRM", "ROI Campanhas", "Equipe Online"].map(item => (
          <button key={item} className="w-full text-left text-gray-300 text-xs px-2 py-1.5 rounded hover:bg-gray-800 transition-colors">{item}</button>
        ))}
      </div>
    </div>
  ),
  atendimento: (
    <div className="space-y-3">
      <div className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Atendimento</div>
      <div className="space-y-1.5">
        {["Fila WhatsApp", "Conversas Ativas", "SLA Monitor", "Scripts IA", "Ariane"].map(item => (
          <button key={item} className="w-full text-left text-gray-300 text-xs px-2 py-1.5 rounded hover:bg-gray-800 transition-colors">{item}</button>
        ))}
      </div>
    </div>
  ),
  trafego: (
    <div className="space-y-3">
      <div className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Tráfego Pago</div>
      <div className="space-y-1.5">
        {["Meta Ads", "Google Ads", "CPL Monitor", "Criativos", "Budget"].map(item => (
          <button key={item} className="w-full text-left text-gray-300 text-xs px-2 py-1.5 rounded hover:bg-gray-800 transition-colors">{item}</button>
        ))}
      </div>
    </div>
  ),
  conteudo: (
    <div className="space-y-3">
      <div className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Conteúdo</div>
      <div className="space-y-1.5">
        {["Fila de Produção", "Aguardando Aprovação", "Publicados Hoje", "Templates", "Calendário"].map(item => (
          <button key={item} className="w-full text-left text-gray-300 text-xs px-2 py-1.5 rounded hover:bg-gray-800 transition-colors">{item}</button>
        ))}
      </div>
    </div>
  ),
  sites: (
    <div className="space-y-3">
      <div className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Sites & Dev</div>
      <div className="space-y-1.5">
        {["Status Sites", "Deploys", "Bugs Abertos", "Landing Pages", "Analytics"].map(item => (
          <button key={item} className="w-full text-left text-gray-300 text-xs px-2 py-1.5 rounded hover:bg-gray-800 transition-colors">{item}</button>
        ))}
      </div>
    </div>
  ),
  agentes: (
    <div className="space-y-3">
      <div className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Agentes IA</div>
      <div className="space-y-1.5">
        {["Todos os Agentes", "IAs Ativas", "Humanos", "Configurar", "Logs"].map(item => (
          <button key={item} className="w-full text-left text-gray-300 text-xs px-2 py-1.5 rounded hover:bg-gray-800 transition-colors">{item}</button>
        ))}
      </div>
    </div>
  ),
  governanca: (
    <div className="space-y-3">
      <div className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Governança</div>
      <div className="space-y-1.5">
        {["Aprovações Pendentes", "Logs de Decisão", "Custos IA", "Compliance", "Auditoria"].map(item => (
          <button key={item} className="w-full text-left text-gray-300 text-xs px-2 py-1.5 rounded hover:bg-gray-800 transition-colors">{item}</button>
        ))}
      </div>
    </div>
  ),
  relatorios: (
    <div className="space-y-3">
      <div className="text-gray-400 text-[11px] font-semibold uppercase tracking-wider">Relatórios</div>
      <div className="space-y-1.5">
        {["Resumo Diário", "Relatório Semanal", "Metas do Mês", "Exportar CSV", "Dashboard"].map(item => (
          <button key={item} className="w-full text-left text-gray-300 text-xs px-2 py-1.5 rounded hover:bg-gray-800 transition-colors">{item}</button>
        ))}
      </div>
    </div>
  ),
};

interface ContextMenuProps {
  visao: Visao;
  onVisaoChange: (v: Visao) => void;
}

export function ContextMenu({ visao, onVisaoChange }: ContextMenuProps) {
  return (
    <div className="flex flex-col h-full bg-gray-950 border-r border-gray-800">
      {/* Nav icons */}
      <nav className="flex flex-col gap-0.5 p-2 border-b border-gray-800">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onVisaoChange(item.id)}
            className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group ${
              visao === item.id
                ? "bg-orange-500/15 text-orange-400"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            <span className="text-sm flex-shrink-0">{item.icon}</span>
            <span className="text-xs font-medium truncate">{item.label}</span>
            {item.badge !== undefined && (
              <span
                className="absolute right-2 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                style={{ background: `${item.badgeColor}25`, color: item.badgeColor, border: `1px solid ${item.badgeColor}40` }}
              >
                {item.badge > 9 ? "9+" : item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Context content */}
      <div className="flex-1 overflow-y-auto p-3">
        {CONTEXT_CONTENT[visao]}
      </div>
    </div>
  );
}
