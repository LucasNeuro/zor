"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { Plus, X, ChevronDown, Menu } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import {
  CRM_NAV_GROUPS,
  filterCrmNavGroupsForRole,
  findCrmNavGroupIdForPath,
  isCrmNavPathActive,
  type CrmNavItem,
} from "@/lib/crm-nav-groups";
import { Obra10LogoBadge, Obra10BrandHeader } from "@/components/brand/Obra10Brand";
import { CrmQueryProvider } from "@/components/crm/CrmQueryProvider";
import { CrmSessionFooter } from "@/components/crm/CrmSessionFooter";
import { CrmHeaderProvider } from "@/components/crm/CrmHeaderContext";
import { CrmUniversalHeader } from "@/components/crm/CrmUniversalHeader";
import { CrmShellProvider } from "@/components/crm/CrmShellContext";
import { CrmSidebarToggleButton } from "@/components/crm/CrmSidebarToggleButton";
import { CRM_CHROME_SOLID } from "@/lib/crm-shell-theme";

import { shouldHideCrmUniversalHeader } from "@/lib/crm-universal-header-visibility";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";

const SIDEBAR_STORAGE_KEY = "crm-sidebar-expanded";

function NavIcon({ Icon, expanded }: { Icon: LucideIcon; expanded: boolean }) {
  const size = expanded ? 18 : 20;
  return <Icon size={size} strokeWidth={1.5} className="flex-shrink-0" aria-hidden />;
}

function CrmNavItemLabel({ item, expanded }: { item: CrmNavItem; expanded: boolean }) {
  if (!expanded) return null;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className="min-w-0 truncate font-medium">{item.label}</span>
      {item.navBadge ? (
        <span
          className="shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={{ background: "#c9a24a18", color: "#c9a24a", border: "1px solid #c9a24a35" }}
        >
          {item.navBadge}
        </span>
      ) : null}
    </span>
  );
}

const NESTED_GROUP_EXCLUDE_IDS = new Set(["vendas", "ia", "cadastros"]);

function splitSistemaItems(items: CrmNavItem[]) {
  const root = items.find(item => item.href === "/crm/configuracoes");
  if (!root) return null;
  const children = items.filter(item => item.href !== "/crm/configuracoes");
  return { root, children };
}

function getNestedGroupMenu(groupId: string, groupLabel: string, items: CrmNavItem[]) {
  if (groupId === "sistema") {
    const sistema = splitSistemaItems(items);
    if (!sistema) return null;
    return {
      parentLabel: "Configurações",
      parentIcon: sistema.root.icon,
      children: [{ ...sistema.root, label: "Geral" }, ...sistema.children],
    };
  }
  if (NESTED_GROUP_EXCLUDE_IDS.has(groupId) || items.length < 2) return null;
  return {
    parentLabel: groupLabel,
    parentIcon: items[0].icon,
    children: items,
  };
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const narrow = useNarrowViewport();
  const slimMobile = narrow !== false;
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(CRM_NAV_GROUPS[0].id);
  const [openNestedGroups, setOpenNestedGroups] = useState<Record<string, boolean>>({ sistema: true });
  const [collapsedFlyoutId, setCollapsedFlyoutId] = useState<string | null>(null);
  const miniSidebarShellRef = useRef<HTMLDivElement>(null);
  const miniFlyoutRef = useRef<HTMLDivElement>(null);

  const navGroups = useMemo(
    () => filterCrmNavGroupsForRole(CRM_NAV_GROUPS, userRole),
    [userRole]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRole(u: User) {
      const row = await supabase.from("users").select("role").eq("auth_id", u.id).maybeSingle();
      if (!cancelled) setUserRole(row.data?.role != null ? String(row.data.role) : "");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      if (u) void loadRole(u);
      else setUserRole("");
    });

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) void loadRole(user);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

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

  const activeGroupId = useMemo(
    () => findCrmNavGroupIdForPath(navGroups, pathname),
    [navGroups, pathname]
  );

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

  if (slimMobile) {
    return (
      <CrmQueryProvider>
        <CrmHeaderProvider>
          <CrmShellProvider value={{ sidebarExpanded: false, toggleSidebar: () => {} }}>
            <div
              className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#0d1117]"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {children}
            </div>
          </CrmShellProvider>
        </CrmHeaderProvider>
      </CrmQueryProvider>
    );
  }

  return (
    <CrmQueryProvider>
    <CrmHeaderProvider>
      <CrmShellProvider value={{ sidebarExpanded, toggleSidebar }}>
        <div className="box-border flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#0d1117] md:h-screen md:p-2">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col md:flex-row md:gap-0">
          <div
            ref={miniSidebarShellRef}
            className="relative z-20 hidden md:flex md:h-[calc(100dvh-1rem)] md:max-h-[calc(100dvh-1rem)] flex-shrink-0 self-stretch"
          >
        <aside
          className={`flex h-full flex-col overflow-hidden border-r border-[#2b3544] pt-4 pb-3 transition-[width] duration-200 ease-out md:rounded-l-xl ${
            sidebarExpanded ? "w-[260px] items-stretch px-2" : "w-14 items-center px-0"
          }`}
          style={{ background: "#0f1520" }}
        >
          {/* Brand header */}
          <div
            className={`mb-2 flex min-h-0 w-full flex-shrink-0 ${
              sidebarExpanded
                ? "border-b border-[#2b3544] px-2 pb-3 pt-0.5"
                : "flex-col items-center justify-center py-1"
            }`}
          >
            {sidebarExpanded ? (
              <Obra10BrandHeader size="sm" subtitle="CRM" />
            ) : (
              <div className="flex justify-center rounded-xl p-0.5" title="Obra10 CRM">
                <Obra10LogoBadge size="md" />
              </div>
            )}
          </div>

          <nav className="flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-1">
            {sidebarExpanded ? (
              <>
                {navGroups.map(group => {
                  const open = openDrawerId === group.id;
                  const groupHasActive = group.items.some(item => isCrmNavPathActive(pathname, item.href));
                  return (
                    <div key={group.id} className="w-full flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleDrawer(group.id)}
                        className={`flex w-full items-center justify-between gap-1 rounded-xl px-2.5 py-1.5 text-left transition-colors ${
                          open || groupHasActive ? "bg-[#1a2332]" : "hover:bg-[#1a2332]"
                        }`}
                        style={{ border: "none", cursor: "pointer" }}
                        aria-expanded={open}
                      >
                        <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[#6e7681]">
                          {group.label}
                        </span>
                        <ChevronDown
                          size={12}
                          strokeWidth={2.5}
                          className={`flex-shrink-0 text-[#6e7681] transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
                          aria-hidden
                        />
                      </button>
                      <div
                        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                      >
                        <div className="overflow-hidden">
                          <div className="space-y-0.5 rounded-xl border border-[#2b3544]/50 bg-[#0d1117]/60 px-1 py-1">
                            {getNestedGroupMenu(group.id, group.label, group.items) ? (
                              (() => {
                                const nestedMenu = getNestedGroupMenu(group.id, group.label, group.items)!;
                                const nestedItems = nestedMenu.children;
                                const nestedActive = nestedItems.some(item =>
                                  isCrmNavPathActive(pathname, item.href),
                                );
                                const nestedOpen = openNestedGroups[group.id] ?? true;
                                return (
                                  <div className="space-y-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenNestedGroups(prev => ({
                                          ...prev,
                                          [group.id]: !(prev[group.id] ?? true),
                                        }))
                                      }
                                      className={`flex min-h-[38px] w-full items-center justify-between rounded-lg border-l-2 px-3 py-2 text-sm font-semibold transition-colors ${
                                        nestedActive
                                          ? "border-[#c9a24a] bg-[#1a2332] text-[#c9a24a]"
                                          : "border-transparent text-[#8b949e] hover:bg-[#1a2332]/80 hover:text-[#e6edf3]"
                                      }`}
                                    >
                                      <span className="flex items-center gap-2.5">
                                        <NavIcon Icon={nestedMenu.parentIcon} expanded />
                                        <span>{nestedMenu.parentLabel}</span>
                                      </span>
                                      <ChevronDown
                                        size={14}
                                        strokeWidth={2.25}
                                        className={`transition-transform ${nestedOpen ? "rotate-0" : "-rotate-90"}`}
                                        aria-hidden
                                      />
                                    </button>
                                    <div
                                      className={`grid overflow-hidden pl-2 transition-[grid-template-rows] duration-200 ease-out ${
                                        nestedOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                      }`}
                                    >
                                      <div className="space-y-0.5 overflow-hidden">
                                        {nestedItems.map(item => {
                                          const active = isCrmNavPathActive(pathname, item.href);
                                          return (
                                            <div key={item.href} className="relative w-full">
                                              <Link
                                                href={item.href}
                                                className={`relative flex min-h-[36px] w-full items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                                                  active
                                                    ? "border-[#c9a24a] bg-[#1a2332] text-[#c9a24a]"
                                                    : "border-transparent text-[#8b949e] hover:bg-[#1a2332]/80 hover:text-[#e6edf3]"
                                                }`}
                                              >
                                                <NavIcon Icon={item.icon} expanded />
                                                <CrmNavItemLabel item={item} expanded />
                                              </Link>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()
                            ) : (
                              group.items.map(item => {
                                const active = isCrmNavPathActive(pathname, item.href);
                                return (
                                  <div key={item.href} className="relative w-full">
                                    <Link
                                      href={item.href}
                                      className={`relative flex min-h-[38px] w-full items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                                        active
                                          ? "border-[#c9a24a] bg-[#1a2332] text-[#c9a24a]"
                                          : `border-transparent text-[#8b949e] hover:bg-[#1a2332]/80 hover:text-[#e6edf3]${item.extra ? " pr-10" : ""}`
                                      }`}
                                    >
                                      <NavIcon Icon={item.icon} expanded />
                                      <CrmNavItemLabel item={item} expanded />
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
                                        <Plus size={14} strokeWidth={2.5} aria-hidden />
                                      </Link>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                {navGroups.map(group => {
                  const flyoutOpen = collapsedFlyoutId === group.id;
                  const groupHasActive = group.items.some(item => isCrmNavPathActive(pathname, item.href));
                  const SectionIcon = group.sectionIcon;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setCollapsedFlyoutId(prev => (prev === group.id ? null : group.id))}
                      className={`relative mx-auto flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
                        flyoutOpen || groupHasActive
                          ? "bg-[#1a2332] text-[#c9a24a]"
                          : "text-[#484f58] hover:bg-[#1a2332]/60 hover:text-[#8b949e]"
                      }`}
                      style={{ border: "none", cursor: "pointer" }}
                      title={group.label}
                      aria-expanded={flyoutOpen}
                      aria-haspopup="dialog"
                    >
                      {groupHasActive && (
                        <span
                          className="pointer-events-none absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full"
                          style={{ background: "#c9a24a" }}
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
            style={{ borderColor: "#2b3544" }}
          >
            <CrmSessionFooter expanded={sidebarExpanded} />
          </div>
        </aside>

        {collapsedFlyoutId && !sidebarExpanded
          ? (() => {
              const group = navGroups.find(g => g.id === collapsedFlyoutId);
              if (!group) return null;
              return (
                <div
                  ref={miniFlyoutRef}
                  role="dialog"
                  aria-label={group.label}
                  className="pointer-events-auto absolute z-[60] flex max-h-[min(72vh,calc(100%-4.75rem))] w-60 flex-col overflow-hidden rounded-2xl border border-[#2b3544] shadow-2xl"
                  style={{
                    left: "100%",
                    top: "3.75rem",
                    marginLeft: "0.35rem",
                    background: "#0f1520",
                    boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
                  }}
                >
                  <div
                    className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-[#2b3544] bg-[#121926] px-3 py-2.5"
                  >
                    <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[#8b949e]">
                      {group.label}
                    </span>
                    <button
                      type="button"
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl border border-[#2b3544] bg-[#1a2332] transition-colors hover:bg-[#1a2332]/80"
                      style={{ color: "#8b949e", cursor: "pointer" }}
                      aria-label="Fechar"
                      onClick={() => setCollapsedFlyoutId(null)}
                    >
                      <X size={14} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto py-2" style={{ WebkitOverflowScrolling: "touch" }}>
                    <div className="space-y-0.5 px-2">
                      {getNestedGroupMenu(group.id, group.label, group.items) ? (
                        (() => {
                          const nestedMenu = getNestedGroupMenu(group.id, group.label, group.items)!;
                          const nestedItems = nestedMenu.children;
                          const nestedActive = nestedItems.some(item =>
                            isCrmNavPathActive(pathname, item.href),
                          );
                          const nestedOpen = openNestedGroups[group.id] ?? true;
                          return (
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenNestedGroups(prev => ({
                                    ...prev,
                                    [group.id]: !(prev[group.id] ?? true),
                                  }))
                                }
                                className={`flex min-h-[38px] w-full items-center justify-between rounded-lg border-l-2 px-3 py-2 text-sm font-semibold transition-colors ${
                                  nestedActive
                                    ? "border-[#c9a24a] bg-[#1a2332] text-[#c9a24a]"
                                    : "border-transparent text-[#8b949e] hover:bg-[#1a2332]/80 hover:text-[#e6edf3]"
                                }`}
                              >
                                <span className="flex items-center gap-2.5">
                                  <NavIcon Icon={nestedMenu.parentIcon} expanded />
                                  <span>{nestedMenu.parentLabel}</span>
                                </span>
                                <ChevronDown
                                  size={14}
                                  strokeWidth={2.25}
                                  className={`transition-transform ${nestedOpen ? "rotate-0" : "-rotate-90"}`}
                                  aria-hidden
                                />
                              </button>
                              <div
                                className={`grid overflow-hidden pl-2 transition-[grid-template-rows] duration-200 ease-out ${
                                  nestedOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                }`}
                              >
                                <div className="space-y-0.5 overflow-hidden">
                                  {nestedItems.map(item => {
                                    const active = isCrmNavPathActive(pathname, item.href);
                                    return (
                                      <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setCollapsedFlyoutId(null)}
                                        className={`relative flex min-h-[36px] items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                                          active
                                            ? "border-[#c9a24a] bg-[#1a2332] text-[#c9a24a]"
                                            : "border-transparent text-[#8b949e] hover:bg-[#1a2332]/80 hover:text-[#e6edf3]"
                                        }`}
                                      >
                                        <NavIcon Icon={item.icon} expanded />
                                        <CrmNavItemLabel item={item} expanded />
                                      </Link>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        group.items.map(item => {
                          const active = isCrmNavPathActive(pathname, item.href);
                          return (
                            <div key={item.href} className="relative">
                              <Link
                                href={item.href}
                                onClick={() => setCollapsedFlyoutId(null)}
                                className={`relative flex min-h-[38px] items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                                  active
                                    ? "border-[#c9a24a] bg-[#1a2332] text-[#c9a24a]"
                                    : `border-transparent text-[#8b949e] hover:bg-[#1a2332]/80 hover:text-[#e6edf3]${item.extra ? " pr-10" : ""}`
                                }`}
                              >
                                <NavIcon Icon={item.icon} expanded />
                                <CrmNavItemLabel item={item} expanded />
                              </Link>
                              {item.extra && (
                                <Link
                                  href={item.extra.href}
                                  onClick={() => setCollapsedFlyoutId(null)}
                                  className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-xs font-black"
                                  style={{
                                    background: "var(--obra-dourado, #c9a24a)",
                                    color: "var(--obra-verde, #003b26)",
                                  }}
                                  title={item.extra.label}
                                >
                                  <Plus size={14} strokeWidth={2.5} aria-hidden />
                                </Link>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
          : null}
      </div>

      <div className="relative z-[12] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:h-[calc(100dvh-1rem)] md:max-h-[calc(100dvh-1rem)] md:self-stretch md:rounded-r-xl md:bg-[#0d1117]">
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
              typeof window !== "undefined" && window.history.length > 1 ? router.back() : router.push("/crm")
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
            className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#2b3544] bg-[#121926] text-[#e6edf3] transition-colors hover:border-[#3d4f65] hover:bg-[#1a2332]"
            style={{ cursor: "pointer" }}
            aria-expanded={mobileMenuOpen}
            aria-label="Abrir menu do CRM"
          >
            <Menu size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {shouldHideCrmUniversalHeader(pathname) ? (
          <div
            className="relative z-[12] hidden min-h-[4.25rem] flex-shrink-0 items-center border-b border-[rgba(48,54,61,0.45)] px-3 py-3.5 md:flex md:min-h-[4.5rem] md:px-2 md:py-4"
            style={{ backgroundColor: CRM_CHROME_SOLID }}
          >
            <CrmSidebarToggleButton variant="header" />
          </div>
        ) : null}

        <CrmUniversalHeader />

        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>
      </div>
        </div>
      <div
        className={`fixed inset-0 z-[100] flex md:hidden transition-opacity duration-[250ms] ease-out ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu do CRM"
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
          className="absolute inset-0 m-0 cursor-default border-0 bg-[#0d1117]/85 p-0 backdrop-blur-sm"
          style={{ WebkitTapHighlightColor: "transparent" }}
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
          className={`relative flex h-full w-[min(100%,20rem)] max-w-[85vw] flex-col border-r border-[#2b3544] transition-transform duration-[250ms] ease-out ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{
            background: "#0f1520",
            boxShadow: "4px 0 40px rgba(0,0,0,0.6), inset -1px 0 0 rgba(255,255,255,0.04)",
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-[#2b3544] bg-[#121926]/90 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <Obra10BrandHeader size="sm" subtitle="CRM" />
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-[#2b3544] bg-[#1a2332] text-[#8b949e] transition-colors hover:border-[#3d4f65] hover:text-[#e6edf3]"
              style={{ cursor: "pointer" }}
              aria-label="Fechar"
            >
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
          <div className="flex-shrink-0 border-b border-[#2b3544] px-3 py-3">
            <CrmSessionFooter variant="drawer" onNavigate={() => setMobileMenuOpen(false)} />
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto py-2" style={{ WebkitOverflowScrolling: "touch" }}>
            {navGroups.map(group => {
              const open = openDrawerId === group.id;
              const groupHasActive = group.items.some(item => isCrmNavPathActive(pathname, item.href));
              return (
                <div key={group.id} className="px-2 pb-1">
                  <button
                    type="button"
                    onClick={() => toggleDrawer(group.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                      open || groupHasActive ? "bg-[#1a2332]" : "hover:bg-[#1a2332]/40"
                    }`}
                    style={{ border: "none", cursor: "pointer" }}
                    aria-expanded={open}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#484f58]">{group.label}</span>
                    <ChevronDown
                      size={12}
                      strokeWidth={2.5}
                      className={`flex-shrink-0 text-[#484f58] transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
                      aria-hidden
                    />
                  </button>
                  <div className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="min-h-0">
                      <div className="space-y-0.5 py-1">
                        {getNestedGroupMenu(group.id, group.label, group.items) ? (
                          (() => {
                            const nestedMenu = getNestedGroupMenu(group.id, group.label, group.items)!;
                            const nestedItems = nestedMenu.children;
                            const nestedActive = nestedItems.some(item =>
                              isCrmNavPathActive(pathname, item.href),
                            );
                            const nestedOpen = openNestedGroups[group.id] ?? true;
                            return (
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenNestedGroups(prev => ({
                                      ...prev,
                                      [group.id]: !(prev[group.id] ?? true),
                                    }))
                                  }
                                  className={`flex min-h-[38px] w-full items-center justify-between rounded-lg border-l-2 px-3 py-2 text-sm font-semibold transition-colors ${
                                    nestedActive
                                      ? "border-[#c9a24a] bg-[#1a2332] text-[#c9a24a]"
                                      : "border-transparent text-[#8b949e] hover:bg-[#1a2332]/80 hover:text-[#e6edf3]"
                                  }`}
                                >
                                  <span className="flex items-center gap-2.5">
                                    <NavIcon Icon={nestedMenu.parentIcon} expanded />
                                    <span>{nestedMenu.parentLabel}</span>
                                  </span>
                                  <ChevronDown
                                    size={14}
                                    strokeWidth={2.25}
                                    className={`transition-transform ${nestedOpen ? "rotate-0" : "-rotate-90"}`}
                                    aria-hidden
                                  />
                                </button>
                                <div
                                  className={`grid overflow-hidden pl-2 transition-[grid-template-rows] duration-200 ease-out ${
                                    nestedOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                  }`}
                                >
                                  <div className="space-y-0.5 overflow-hidden">
                                    {nestedItems.map(item => {
                                      const active = isCrmNavPathActive(pathname, item.href);
                                      return (
                                        <Link
                                          key={item.href}
                                          href={item.href}
                                          onClick={() => setMobileMenuOpen(false)}
                                          className={`flex min-h-[36px] items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                                            active
                                              ? "border-[#c9a24a] bg-[#003b2620] text-[#c9a24a]"
                                              : "border-transparent text-[#8b949e] hover:bg-[#1a2332] hover:text-[#c7d5e0]"
                                          }`}
                                        >
                                          <NavIcon Icon={item.icon} expanded />
                                          <CrmNavItemLabel item={item} expanded />
                                        </Link>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          group.items.map(item => {
                            const active = isCrmNavPathActive(pathname, item.href);
                            return (
                              <div key={item.href} className="relative">
                                <Link
                                  href={item.href}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className={`flex min-h-[38px] items-center gap-2.5 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors ${
                                    active
                                      ? "border-[#c9a24a] bg-[#003b2620] text-[#c9a24a]"
                                      : `border-transparent text-[#8b949e] hover:bg-[#1a2332] hover:text-[#c7d5e0]${item.extra ? " pr-12" : ""}`
                                  }`}
                                >
                                  <NavIcon Icon={item.icon} expanded />
                                  <CrmNavItemLabel item={item} expanded />
                                </Link>
                                {item.extra && (
                                  <Link
                                    href={item.extra.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-sm font-black"
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
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </div>
        </div>
      </CrmShellProvider>
    </CrmHeaderProvider>
    </CrmQueryProvider>
  );
}
