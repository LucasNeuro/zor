"use client";

import { type Metricas } from "@/hooks/useMetricas";

interface MenuItem {
  label: string;
  key?: string;
  href?: string;
  badge?: number;
  badgeColor?: string;
}

interface Section {
  title: string;
  items: MenuItem[];
}

interface ContextMenuProps {
  metricas: Metricas;
  onNavegar?: (href: string) => void;
  onItemClick?: (key: string) => void;
}

export function ContextMenu({ metricas, onNavegar, onItemClick }: ContextMenuProps) {
  const sections: Section[] = [
    {
      title: "Visão Geral",
      items: [
        { label: "Dashboard", href: "/crm" },
        { label: "Analytics", href: "/crm/analytics" },
        { label: "Leads", href: "/crm/leads" },
        { label: "Equipe", key: "ias_ativas" },
      ],
    },
    {
      title: "Atendimento",
      items: [
        {
          label: "Aguardando resposta",
          key: "fila_whatsapp",
          badge: metricas.leadsAguardando || undefined,
          badgeColor: "#c9a24a",
        },
        {
          label: "Inbox",
          href: "/crm/atendimento",
          badge: metricas.mensagensFilaPendentes || undefined,
          badgeColor: "#22c55e",
        },
        { label: "SLA crítico", key: "sla_monitor" },
      ],
    },
    {
      title: "Decisões",
      items: [
        {
          label: "Aprovações",
          href: "/crm/aprovacoes",
          badge: metricas.aprovacoesPendentes || undefined,
          badgeColor: "#ef4444",
        },
        { label: "Histórico", key: "logs_decisao" },
      ],
    },
    {
      title: "Conta",
      items: [
        { label: "Conta", href: "/crm/configuracoes" },
      ],
    },
  ];

  function handleClick(item: MenuItem) {
    if (item.href && onNavegar) onNavegar(item.href);
    else if (item.key && onItemClick) onItemClick(item.key);
  }

  return (
    <div
      className="flex flex-col h-full border-r overflow-y-auto"
      style={{ background: "var(--obra-dark, #0d1117)", borderColor: "var(--obra-borda, #30363d)" }}
    >
      {/* Logo */}
      <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--obra-borda, #30363d)" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#3f9848", letterSpacing: "0.04em" }}>waje</div>
        <div style={{ fontSize: 9, color: "var(--obra-texto-3, #484f58)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Escritório Virtual</div>
      </div>

      {/* Sections */}
      <div style={{ padding: "8px 6px", flex: 1 }}>
        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 9, fontWeight: 700,
              color: "var(--obra-texto-3, #484f58)",
              textTransform: "uppercase", letterSpacing: "0.1em",
              padding: "0 6px", marginBottom: 4,
            }}>
              {section.title}
            </div>
            {section.items.map(item => (
              <button
                key={item.label}
                onClick={() => handleClick(item)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "7px 8px", borderRadius: 8,
                  background: "transparent", border: "none", cursor: "pointer",
                  textAlign: "left", marginBottom: 1, transition: "background 120ms",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ fontSize: 12, color: "var(--obra-texto-2, #8b949e)" }}>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
                    borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${item.badgeColor || "#c9a24a"}25`,
                    color: item.badgeColor || "#c9a24a",
                    border: `1px solid ${item.badgeColor || "#c9a24a"}40`,
                  }}>
                    {(item.badge || 0) > 9 ? "9+" : item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
