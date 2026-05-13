"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  User,
  Building2,
  Home,
  Briefcase,
  MessageSquare,
  ClipboardCheck,
  Bot,
  LineChart,
  Handshake,
  ClipboardList,
  Zap,
  Radio,
  PenLine,
  Settings,
  Shield,
  Plus,
  X,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Obra10LogoBadge, Obra10BrandHeader } from "@/components/brand/Obra10Brand";
import { CrmSessionFooter } from "@/components/crm/CrmSessionFooter";
import { CrmHeaderProvider } from "@/components/crm/CrmHeaderContext";
import { CrmUniversalHeader } from "@/components/crm/CrmUniversalHeader";
import { CRM_HEADER_BAR_GRADIENT, CRM_SIDEBAR_GRADIENT } from "@/lib/crm-shell-theme";

import { shouldHideCrmUniversalHeader } from "@/lib/crm-universal-header-visibility";

const SIDEBAR_STORAGE_KEY = "crm-sidebar-expanded";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  extra?: { href: string; label: string };
};

/** Gavetas do menu (desktop expandido): reduz rolagem ao mostrar só um bloco por vez. Ver docs/crm-sidebar-navigation.md */
const NAV_GROUPS: { id: string; label: string; sectionIcon: LucideIcon; items: NavItem[] }[] = [
  {
    id: "inicio",
    label: "Início",
    sectionIcon: LayoutDashboard,
    items: [
      { href: "/crm", label: "Dashboard", icon: LayoutDashboard },
      { href: "/crm/kpis", label: "KPIs", icon: LineChart },
    ],
  },
  {
    id: "pipeline",
    label: "Pipeline e cadastros",
    sectionIcon: Users,
    items: [
      { href: "/crm/leads", label: "Leads", icon: Users },
      { href: "/crm/pessoas", label: "Pessoas", icon: User },
      { href: "/crm/empresas", label: "Empresas", icon: Building2 },
      { href: "/crm/imoveis", label: "Imóveis", icon: Home },
      { href: "/crm/negocios", label: "Negócios", icon: Briefcase },
    ],
  },
  {
    id: "atendimento",
    label: "Atendimento",
    sectionIcon: MessageSquare,
    items: [
      { href: "/crm/atendimento", label: "Atendimento", icon: MessageSquare },
      { href: "/crm/aprovacoes", label: "Aprovações", icon: ClipboardCheck },
    ],
  },
  {
    id: "midia",
    label: "Parceiros e mídia",
    sectionIcon: Handshake,
    items: [
      { href: "/crm/parceiros", label: "Parceiros", icon: Handshake },
      { href: "/crm/relatorios", label: "Relatórios", icon: ClipboardList },
      { href: "/crm/trafego", label: "Tráfego", icon: Radio },
      { href: "/crm/conteudo", label: "Conteúdo", icon: PenLine },
    ],
  },
  {
    id: "automacao",
    label: "Automação",
    sectionIcon: Bot,
    items: [
      {
        href: "/crm/agentes",
        label: "Agentes",
        icon: Bot,
        extra: { href: "/crm/agentes/novo", label: "Novo Agente" },
      },
      { href: "/crm/ciclos", label: "Ciclos IA", icon: Zap },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    sectionIcon: Settings,
    items: [
      { href: "/crm/configuracoes", label: "Configurações", icon: Settings },
      { href: "/crm/onboarding-tenant", label: "Onboarding tenant", icon: Shield },
    ],
  },
];

function NavIcon({ Icon, expanded }: { Icon: LucideIcon; expanded: boolean }) {
  const size = expanded ? 18 : 20;
  return <Icon size={size} strokeWidth={1.5} className="flex-shrink-0" aria-hidden />;
}

function isNavActive(pathname: string, href: string): boolean {
  return href === "/crm" ? pathname === "/crm" : pathname.startsWith(href);
}

function findGroupIdForPath(pathname: string): string {
  for (const g of NAV_GROUPS) {
    if (g.items.some(item => isNavActive(pathname, item.href))) return g.id;
  }
  return NAV_GROUPS[0]?.id ?? "inicio";
}

const SIDEBAR_GRADIENT = CRM_SIDEBAR_GRADIENT;

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(NAV_GROUPS[0].id);
  const [collapsedFlyoutId, setCollapsedFlyoutId] = useState<string | null>(null);
  const miniSidebarShellRef = useRef<HTMLDivElement>(null);
  const miniFlyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCollapsedFlyoutId(null);
  }, [pathname]);

  useEffect(() => {
    if (sidebarExpanded) setCollapsedFlyoutId(null);
  }, [sidebarExpanded]);

  useEffect(() => {
    if (collapsedFlyoutId == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCollapsedFlyoutId(null);
    }
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (miniSidebarShellRef.current?.contains(t)) return;
      setCollapsedFlyoutId(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [collapsedFlyoutId]);

  const activeGroupId = useMemo(() => findGroupIdForPath(pathname), [pathname]);

  const syncOpenDrawer = useCallback(() => {
    setOpenDrawerId(activeGroupId);
  }, [activeGroupId]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === "1") setSidebarExpanded(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    syncOpenDrawer();
  }, [syncOpenDrawer]);

  function toggleSidebar() {
    setCollapsedFlyoutId(null);
    setSidebarExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleDrawer(id: string) {
    setOpenDrawerId(prev => (prev === id ? null : id));
  }

  return (
    <CrmHeaderProvider>
      <div className="box-border flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#0d1117] md:h-screen md:p-2">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col md:flex-row md:gap-2">
          {!shouldHideCrmUniversalHeader(pathname) ? (
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 z-[8] hidden min-h-[4.25rem] border-b md:block"
              style={{
                background: CRM_HEADER_BAR_GRADIENT,
                borderBottomColor: "rgba(48, 54, 61, 0.65)",
                boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
              aria-hidden
            />
          ) : null}
          <div
            ref={miniSidebarShellRef}
            className="relative z-20 hidden md:flex md:h-[calc(100dvh-1rem)] md:max-h-[calc(100dvh-1rem)] flex-shrink-0 self-stretch"
          >
        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute right-0 top-2 z-30 flex h-7 w-7 translate-x-1/2 touch-manipulation items-center justify-center rounded-full shadow-md transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a24a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
          style={{
            background: "linear-gradient(180deg, #3fb950 0%, #238636 100%)",
            color: "#ffffff",
            border: "1.5px solid #0d1117",
            boxShadow: "0 3px 10px rgba(63,185,80,0.4)",
          }}
          title={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
          aria-expanded={sidebarExpanded}
          aria-label={sidebarExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
        >
          <ChevronRight
            size={14}
            strokeWidth={2.5}
            className={`text-white transition-transform duration-200 ${sidebarExpanded ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        <aside
          className={`flex h-full flex-col gap-1 overflow-hidden rounded-xl border py-3 transition-[width] duration-200 ease-out ${
            sidebarExpanded ? "w-72 items-stretch px-2" : "w-[4.25rem] items-center px-0"
          }`}
          style={{
            background: SIDEBAR_GRADIENT,
            borderColor: "var(--obra-borda, #30363d)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05) inset",
          }}
        >
          <div
            className={`flex min-h-0 flex-shrink-0 items-start ${sidebarExpanded ? "mb-1 w-full flex-row gap-1 pt-0.5 pl-1 pr-10 md:pr-11" : "mb-1 mt-2 flex-col items-center gap-1 px-0 pb-0.5 pr-3"}`}
          >
            {sidebarExpanded ? (
              <div className="min-w-0 flex-1 px-1 py-1">
                <Obra10BrandHeader size="sm" />
              </div>
            ) : (
              <div className="flex justify-center rounded-xl p-1" title="Obra10+">
                <Obra10LogoBadge size="md" />
              </div>
            )}
          </div>

          <nav className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-0.5">
            {sidebarExpanded ? (
              <>
                {NAV_GROUPS.map(group => {
                  const open = openDrawerId === group.id;
                  const groupHasActive = group.items.some(item => isNavActive(pathname, item.href));
                  return (
                    <div key={group.id} className="w-full flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleDrawer(group.id)}
                        className="flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-left transition-colors"
                        style={{
                          background: open || groupHasActive ? "rgba(0,0,0,0.22)" : "transparent",
                          color: "var(--obra-texto-2, #8b949e)",
                          border: "none",
                          cursor: "pointer",
                        }}
                        aria-expanded={open}
                      >
                        <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wide">
                          {group.label}
                        </span>
                        <ChevronDown
                          size={14}
                          strokeWidth={2}
                          className={`flex-shrink-0 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
                          aria-hidden
                        />
                      </button>
                      <div
                        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                      >
                        <div className="overflow-hidden">
                          <div
                            className="space-y-0.5 rounded-lg py-1 pl-1 pr-0"
                            style={{
                              background: "rgba(0,0,0,0.18)",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                            }}
                          >
                            {group.items.map(item => {
                              const active = isNavActive(pathname, item.href);
                              return (
                                <div key={item.href} className={`relative group ${sidebarExpanded ? "w-full" : ""}`}>
                                  <Link
                                    href={item.href}
                                    title={sidebarExpanded ? undefined : item.label}
                                    className={`relative flex min-h-10 items-center rounded-xl transition-colors ${
                                      sidebarExpanded
                                        ? `w-full gap-2 px-2 py-1.5 text-left text-sm${item.extra ? " pr-9" : ""}`
                                        : "mx-auto h-10 w-10 justify-center"
                                    }`}
                                    style={{
                                      background: active ? "rgba(33,38,45,0.95)" : "transparent",
                                      color: active ? "var(--obra-dourado, #c9a24a)" : "var(--obra-texto-2, #8b949e)",
                                    }}
                                  >
                                    {active && !sidebarExpanded && (
                                      <span
                                        className="pointer-events-none absolute right-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full"
                                        style={{ background: "#3fb950" }}
                                        aria-hidden
                                      />
                                    )}
                                    <NavIcon Icon={item.icon} expanded={sidebarExpanded} />
                                    {sidebarExpanded && (
                                      <span className="min-w-0 truncate font-medium">{item.label}</span>
                                    )}
                                  </Link>
                                  {item.extra && (
                                    <Link
                                      href={item.extra.href}
                                      title={item.extra.label}
                                      className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-xs font-black"
                                      style={{
                                        background: "var(--obra-dourado, #c9a24a)",
                                        color: "var(--obra-verde, #003b26)",
                                      }}
                                    >
                                      <Plus size={16} strokeWidth={2.5} aria-hidden />
                                    </Link>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                {NAV_GROUPS.map(group => {
                  const flyoutOpen = collapsedFlyoutId === group.id;
                  const groupHasActive = group.items.some(item => isNavActive(pathname, item.href));
                  const SectionIcon = group.sectionIcon;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setCollapsedFlyoutId(prev => (prev === group.id ? null : group.id))}
                      className="relative mx-auto flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors"
                      style={{
                        background: flyoutOpen || groupHasActive ? "rgba(33,38,45,0.95)" : "transparent",
                        color:
                          flyoutOpen || groupHasActive
                            ? "var(--obra-dourado, #c9a24a)"
                            : "var(--obra-texto-2, #8b949e)",
                        border: "none",
                        cursor: "pointer",
                      }}
                      title={group.label}
                      aria-expanded={flyoutOpen}
                      aria-haspopup="dialog"
                    >
                      {groupHasActive && (
                        <span
                          className="pointer-events-none absolute right-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full"
                          style={{ background: "#3fb950" }}
                          aria-hidden
                        />
                      )}
                      <SectionIcon size={20} strokeWidth={1.5} className="flex-shrink-0" aria-hidden />
                    </button>
                  );
                })}
              </>
            )}
          </nav>

          <div
            className={`relative z-30 mt-auto flex flex-shrink-0 border-t pt-2 pb-1 ${sidebarExpanded ? "w-full px-1" : "flex-col items-center"}`}
            style={{ borderColor: "rgba(48,54,61,0.65)" }}
          >
            <CrmSessionFooter expanded={sidebarExpanded} />
          </div>
        </aside>

        {collapsedFlyoutId && !sidebarExpanded
          ? (() => {
              const group = NAV_GROUPS.find(g => g.id === collapsedFlyoutId);
              if (!group) return null;
              return (
                <div
                  ref={miniFlyoutRef}
                  role="dialog"
                  aria-label={group.label}
                  className="pointer-events-auto absolute z-[60] flex max-h-[min(72vh,calc(100%-4.75rem))] w-72 flex-col overflow-hidden rounded-xl border shadow-2xl"
                  style={{
                    left: "100%",
                    top: "2.25rem",
                    marginLeft: "0.35rem",
                    background: SIDEBAR_GRADIENT,
                    borderColor: "var(--obra-borda, #30363d)",
                    boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
                  }}
                >
                  <div
                    className="flex flex-shrink-0 items-center justify-between gap-2 border-b px-3 py-2"
                    style={{ borderColor: "var(--obra-borda, #30363d)" }}
                  >
                    <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wide text-[#8b949e]">
                      {group.label}
                    </span>
                    <button
                      type="button"
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: "var(--obra-dark-3, #21262d)",
                        color: "var(--obra-texto-2, #8b949e)",
                        border: "none",
                        cursor: "pointer",
                      }}
                      aria-label="Fechar"
                      onClick={() => setCollapsedFlyoutId(null)}
                    >
                      <X size={16} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto py-2" style={{ WebkitOverflowScrolling: "touch" }}>
                    <div className="space-y-0.5 px-2">
                      {group.items.map(item => {
                        const active = isNavActive(pathname, item.href);
                        return (
                          <div key={item.href} className="relative">
                            <Link
                              href={item.href}
                              onClick={() => setCollapsedFlyoutId(null)}
                              className={`relative flex min-h-10 items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium ${item.extra ? "pr-10" : ""}`}
                              style={{
                                background: active ? "rgba(33,38,45,0.95)" : "transparent",
                                color: active ? "var(--obra-dourado, #c9a24a)" : "var(--obra-texto-2, #8b949e)",
                              }}
                            >
                              <NavIcon Icon={item.icon} expanded />
                              <span className="min-w-0 truncate">{item.label}</span>
                            </Link>
                            {item.extra && (
                              <Link
                                href={item.extra.href}
                                onClick={() => setCollapsedFlyoutId(null)}
                                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-xs font-black"
                                style={{
                                  background: "var(--obra-dourado, #c9a24a)",
                                  color: "var(--obra-verde, #003b26)",
                                }}
                                title={item.extra.label}
                              >
                                <Plus size={16} strokeWidth={2.5} aria-hidden />
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()
          : null}
      </div>

      <div className="relative z-[12] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:h-[calc(100dvh-1rem)] md:max-h-[calc(100dvh-1rem)] md:self-stretch">
        <div
          className="flex flex-shrink-0 items-center justify-between gap-2 border-b px-3 py-2 md:hidden sticky top-0 z-30 backdrop-blur-md supports-[backdrop-filter]:bg-[#161b22]/90"
          style={{
            background: "rgba(22, 27, 34, 0.96)",
            borderColor: "var(--obra-borda, #30363d)",
            paddingTop: "max(0.5rem, env(safe-area-inset-top))",
          }}
        >
          <button
            type="button"
            onClick={() =>
              typeof window !== "undefined" && window.history.length > 1 ? router.back() : router.push("/office")
            }
            className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "var(--obra-dark-3, #21262d)",
              color: "var(--obra-texto, #e6edf3)",
              border: "1px solid var(--obra-borda, #30363d)",
              cursor: "pointer",
            }}
            aria-label="Voltar"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <Obra10BrandHeader size="sm" subtitle="CRM" titleClassName="!text-[11px]" subtitleClassName="!text-[8px] !text-[#8b949e]" />
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "var(--obra-dark-3, #21262d)",
              color: "var(--obra-texto, #e6edf3)",
              border: "1px solid var(--obra-borda, #30363d)",
              cursor: "pointer",
            }}
            aria-expanded={mobileMenuOpen}
            aria-label="Abrir menu do CRM"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <CrmUniversalHeader />

        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>
      </div>
        </div>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] flex md:hidden" role="dialog" aria-modal="true" aria-label="Menu do CRM">
          <button
            type="button"
            className="absolute inset-0 m-0 cursor-default border-0 bg-black/55 p-0"
            style={{ WebkitTapHighlightColor: "transparent" }}
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className="relative flex h-full w-[min(100%,20rem)] max-w-[85vw] flex-col border-r shadow-2xl"
            style={{
              background: SIDEBAR_GRADIENT,
              borderColor: "var(--obra-borda, #30363d)",
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b px-3 py-3" style={{ borderColor: "var(--obra-borda, #30363d)" }}>
              <div className="min-w-0 flex-1">
                <Obra10BrandHeader size="sm" subtitle="CRM" subtitleClassName="!text-[#8b949e]" />
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-10 min-w-10 items-center justify-center rounded-lg"
                style={{ background: "var(--obra-dark-3, #21262d)", color: "var(--obra-texto-2, #8b949e)", border: "none", cursor: "pointer" }}
                aria-label="Fechar"
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="flex-shrink-0 space-y-2 border-b px-2 py-2" style={{ borderColor: "var(--obra-borda, #30363d)" }}>
              <CrmSessionFooter variant="drawer" onNavigate={() => setMobileMenuOpen(false)} />
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto py-2" style={{ WebkitOverflowScrolling: "touch" }}>
              {NAV_GROUPS.map(group => {
                const open = openDrawerId === group.id;
                const groupHasActive = group.items.some(item => isNavActive(pathname, item.href));
                return (
                  <div key={group.id} className="px-2 pb-2">
                    <button
                      type="button"
                      onClick={() => toggleDrawer(group.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left"
                      style={{
                        background: open || groupHasActive ? "rgba(0,0,0,0.22)" : "transparent",
                        color: "var(--obra-texto-2, #8b949e)",
                        border: "none",
                        cursor: "pointer",
                      }}
                      aria-expanded={open}
                    >
                      <span className="text-xs font-bold uppercase tracking-wide">{group.label}</span>
                      <ChevronDown
                        size={16}
                        strokeWidth={2}
                        className={`flex-shrink-0 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
                        aria-hidden
                      />
                    </button>
                    <div className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                      <div className="min-h-0">
                        <div
                          className="mt-1 space-y-0.5 rounded-lg py-3 pl-2 pr-1"
                          style={{
                            background: "rgba(0,0,0,0.18)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                          }}
                        >
                          {group.items.map(item => {
                            const active = isNavActive(pathname, item.href);
                            return (
                              <div key={item.href} className="relative px-1 py-0.5">
                                <Link
                                  href={item.href}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className={`flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${item.extra ? "pr-14" : ""}`}
                                  style={{
                                    background: active ? "rgba(33,38,45,0.95)" : "transparent",
                                    color: active ? "var(--obra-dourado, #c9a24a)" : "var(--obra-texto-2, #8b949e)",
                                  }}
                                >
                                  <NavIcon Icon={item.icon} expanded />
                                  <span className="min-w-0">{item.label}</span>
                                </Link>
                                {item.extra && (
                                  <Link
                                    href={item.extra.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-sm font-black"
                                    style={{
                                      background: "var(--obra-dourado, #c9a24a)",
                                      color: "var(--obra-verde, #003b26)",
                                    }}
                                    title={item.extra.label}
                                  >
                                    <Plus size={18} strokeWidth={2.5} aria-hidden />
                                  </Link>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
    </CrmHeaderProvider>
  );
}
