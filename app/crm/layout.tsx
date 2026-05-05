"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/crm",              label: "Dashboard",   icon: "📊" },
  { href: "/crm/leads",        label: "Leads",       icon: "👥" },
  { href: "/crm/atendimento",  label: "Atendimento", icon: "💬" },
  { href: "/crm/aprovacoes",   label: "Aprovações",  icon: "✅" },
  { href: "/crm/agentes",      label: "Agentes",     icon: "🤖", extra: { href: "/crm/agentes/novo", label: "Novo Agente", icon: "+" } },
  { href: "/crm/kpis",         label: "KPIs",        icon: "📈" },
  { href: "/crm/parceiros",    label: "Parceiros",   icon: "🤝" },
  { href: "/crm/relatorios",   label: "Relatórios",  icon: "📋" },
  { href: "/crm/configuracoes",label: "Config",      icon: "⚙️" },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--obra-dark, #0d1117)" }}>
      {/* SIDEBAR */}
      <div className="w-16 flex-shrink-0 flex flex-col items-center py-4 gap-1" style={{ background: "var(--obra-dark-2, #161b22)", borderRight: "1px solid var(--obra-borda, #30363d)" }}>
        <Link href="/office"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs mb-4 transition-colors"
          style={{ background: "var(--obra-verde, #003b26)" }}
          title="Escritório Virtual">
          🏢
        </Link>
        {NAV.map(item => {
          const active = item.href === "/crm" ? pathname === "/crm" : pathname.startsWith(item.href);
          return (
            <div key={item.href} className="relative group">
              <Link href={item.href} title={item.label}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors"
                style={{
                  background: active ? "var(--obra-dark-3, #21262d)" : "transparent",
                  color: active ? "var(--obra-dourado, #c9a24a)" : "var(--obra-texto-2, #8b949e)",
                }}>
                {item.icon}
              </Link>
              {"extra" in item && item.extra && (
                <Link href={item.extra.href} title={item.extra.label}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "var(--obra-dourado, #c9a24a)", color: "var(--obra-verde, #003b26)" }}>
                  {item.extra.icon}
                </Link>
              )}
            </div>
          );
        })}
      </div>
      {/* CONTEÚDO */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
