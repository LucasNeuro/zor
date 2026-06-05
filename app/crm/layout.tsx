"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { Plus, X, ChevronRight, ChevronDown, Menu } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import {
  CRM_NAV_GROUPS,
  filterCrmNavGroupsForRole,
  findCrmNavGroupIdForPath,
  isCrmNavPathActive,
  type CrmNavItem,
  type CrmNavGroup,
} from "@/lib/crm-nav-groups";
import { WajeLogoMark } from "@/components/brand/WajeLogoMark";
import { WajeWordmark } from "@/components/brand/WajeWordmark";
import { CrmQueryProvider } from "@/components/crm/CrmQueryProvider";
import { CrmSessionFooter } from "@/components/crm/CrmSessionFooter";
import { CrmHeaderProvider } from "@/components/crm/CrmHeaderContext";
import { CrmUniversalHeader } from "@/components/crm/CrmUniversalHeader";
import { CrmShellProvider } from "@/components/crm/CrmShellContext";
import { CrmSidebarToggleButton } from "@/components/crm/CrmSidebarToggleButton";
import {
  CRM_CHROME_SOLID,
  CRM_SURFACE_ALT,
  CRM_SURFACE_CARD,
  CRM_SURFACE_MAIN,
} from "@/lib/crm-shell-theme";
import { shouldHideCrmUniversalHeader } from "@/lib/crm-universal-header-visibility";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";

const SIDEBAR_STORAGE_KEY = "crm-sidebar-expanded";

/* ── Waje sidebar tokens ──────────────────────────────────────────── */
const SB = {
  bg: CRM_SURFACE_CARD,
  border: "#e8f0e6",
  sectionLabel: "#3d6b4f",
  sectionLabelMuted: "#96a89e",
  itemText: "#1e3a23",
  itemTextMuted: "#6b8a76",
  itemHoverBg: "#f0f9ee",
  itemActiveBg: "rgba(63,152,72,0.10)",
  itemActiveBorder: "#3f9848",
  itemActiveText: "#0b2210",
  badgeBg: "rgba(146,255,0,0.14)",
  badgeText: "#1e4a24",
  plusBg: "#0b1f10",
  plusText: "#92ff00",
} as const;

/* ── Nav item row ──────────────────────────────────────────────────── */
function NavItemRow({
  item,
  active,
  onClick,
}: {
  item: CrmNavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <div className="relative">
      <Link
        href={item.href}
        onClick={onClick}
        className="group flex min-h-[38px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150"
        style={{
          background: active ? SB.itemActiveBg : "transparent",
          color: active ? SB.itemActiveText : SB.itemText,
          borderLeft: active ? `3px solid ${SB.itemActiveBorder}` : "3px solid transparent",
        }}
      >
        <Icon
          size={17}
          strokeWidth={active ? 2 : 1.75}
          className="flex-shrink-0 transition-colors"
          style={{ color: active ? SB.itemActiveBorder : SB.itemTextMuted }}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.navBadge && (
        <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{ background: SB.badgeBg, color: SB.badgeText }}
        >
          {item.navBadge}
        </span>
        )}
      </Link>
      {item.extra && (
        <Link
          href={item.extra.href}
          title={item.extra.label}
          onClick={onClick}
          className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg transition-opacity hover:opacity-80"
          style={{ background: SB.plusBg, color: SB.plusText }}
        >
          <Plus size={13} strokeWidth={2.5} aria-hidden />
        </Link>
      )}
    </div>
  );
}

/* ── Accordion expanded sidebar ────────────────────────────────────── */
function ExpandedSidebar({
  navGroups,
  pathname,
  onNavigate,
  activeGroupId,
}: {
  navGroups: CrmNavGroup[];
  pathname: string;
  onNavigate?: () => void;
  activeGroupId?: string;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    // default: open the group that has the active route
    const initial = navGroups.find((g) =>
      g.items.some((i) => isCrmNavPathActive(pathname, i.href)),
    );
    return new Set([initial?.id ?? navGroups[0]?.id ?? ""]);
  });

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // auto-open the active section when route changes
  useEffect(() => {
    if (activeGroupId) {
      setOpenIds((prev) => {
        if (prev.has(activeGroupId)) return prev;
        return new Set([...prev, activeGroupId]);
      });
    }
  }, [activeGroupId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-3 px-2">
      {navGroups.map((group, gi) => {
        const open = openIds.has(group.id);
        return (
          <div key={group.id} className={gi > 0 ? "mt-0.5" : ""}>
            {/* Section header — clickable toggle */}
            <button
              type="button"
              onClick={() => toggle(group.id)}
              className="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-all hover:bg-[#f0f9ee]"
              style={{ border: "none", cursor: "pointer", background: open ? "#f5fbf4" : "transparent" }}
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: open ? SB.itemActiveText : SB.sectionLabel }}
              >
                {group.label}
              </span>
              <ChevronDown
                size={14}
                strokeWidth={2}
                className="flex-shrink-0 transition-transform duration-200"
                style={{
                  color: open ? SB.itemActiveBorder : SB.sectionLabelMuted,
                  transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                }}
                aria-hidden
              />
            </button>

            {/* Items — animated drawer */}
            <div
              className="overflow-hidden transition-all duration-200 ease-out"
              style={{
                maxHeight: open ? `${group.items.length * 52}px` : 0,
                opacity: open ? 1 : 0,
              }}
            >
              <div className="space-y-0.5 pb-1 pl-1">
                {group.items.map((item) => (
                  <NavItemRow
                    key={item.href}
                    item={item}
                    active={isCrmNavPathActive(pathname, item.href)}
                    onClick={onNavigate}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Collapsed icon rail ───────────────────────────────────────────── */
function CollapsedRail({
  navGroups,
  pathname,
  flyoutId,
  onToggleFlyout,
}: {
  navGroups: CrmNavGroup[];
  pathname: string;
  flyoutId: string | null;
  onToggleFlyout: (id: string) => void;
}) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 py-2">
      {navGroups.map((group) => {
        const Icon = group.sectionIcon;
        const isOpen = flyoutId === group.id;
        const hasActive = group.items.some((i) => isCrmNavPathActive(pathname, i.href));
        return (
          <button
            key={group.id}
            type="button"
            title={group.label}
            onClick={() => onToggleFlyout(group.id)}
            className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-150"
            style={{
              background: isOpen || hasActive ? SB.itemActiveBg : "transparent",
              color: isOpen || hasActive ? SB.itemActiveBorder : SB.itemTextMuted,
              border: "none",
              cursor: "pointer",
            }}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
          >
            {hasActive && (
              <span
                className="pointer-events-none absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full"
                style={{ background: SB.itemActiveBorder }}
                aria-hidden
              />
            )}
            <Icon size={19} strokeWidth={1.75} aria-hidden />
          </button>
        );
      })}
    </nav>
  );
}

/* ── Flyout panel (collapsed → hover/click) ──────────────────────── */
function FlyoutPanel({
  group,
  pathname,
  onClose,
  railRef,
}: {
  group: CrmNavGroup;
  pathname: string;
  onClose: () => void;
  railRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      role="dialog"
      aria-label={group.label}
      className="pointer-events-auto absolute z-[60] flex max-h-[min(72vh,calc(100%-4rem))] w-52 flex-col overflow-hidden rounded-2xl border shadow-2xl"
      style={{
        left: "calc(100% + 8px)",
        top: "3.5rem",
        background: CRM_SURFACE_CARD,
        borderColor: SB.border,
        boxShadow: "0 16px 40px rgba(15,56,39,0.14)",
      }}
    >
      {/* header */}
      <div
        className="flex flex-shrink-0 items-center justify-between gap-2 border-b px-3.5 py-2.5"
        style={{ borderColor: SB.border, background: CRM_SURFACE_MAIN }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: SB.sectionLabel }}
        >
          {group.label}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-[#edf6ea]"
          style={{ color: SB.itemTextMuted, cursor: "pointer", border: "none", background: "transparent" }}
          aria-label="Fechar"
        >
          <X size={13} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {/* items */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2 px-2">
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <NavItemRow
              key={item.href}
              item={item}
              active={isCrmNavPathActive(pathname, item.href)}
              onClick={onClose}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main layout ───────────────────────────────────────────────────── */
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const narrow = useNarrowViewport();
  const slimMobile = narrow !== false;

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [flyoutId, setFlyoutId] = useState<string | null>(null);

  const railRef = useRef<HTMLDivElement>(null);

  const navGroups = useMemo(
    () => filterCrmNavGroupsForRole(CRM_NAV_GROUPS, userRole),
    [userRole],
  );

  const activeGroupId = useMemo(
    () => findCrmNavGroupIdForPath(navGroups, pathname) ?? undefined,
    [navGroups, pathname],
  );

  /* load role */
  useEffect(() => {
    let cancelled = false;
    async function loadRole(u: User) {
      const row = await supabase.from("users").select("role").eq("auth_id", u.id).maybeSingle();
      if (!cancelled) setUserRole(row.data?.role != null ? String(row.data.role) : "");
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      if (u) void loadRole(u);
      else setUserRole("");
    });
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) void loadRole(user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  /* close flyout on route change */
  useEffect(() => { setFlyoutId(null); setMobileMenuOpen(false); }, [pathname]);
  useEffect(() => { if (sidebarExpanded) setFlyoutId(null); }, [sidebarExpanded]);

  /* close flyout on outside click / Escape */
  useEffect(() => {
    if (flyoutId == null) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setFlyoutId(null); }
    function onPointer(e: PointerEvent) {
      if (railRef.current?.contains(e.target as Node)) return;
      setFlyoutId(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [flyoutId]);

  /* persist sidebar state */
  useEffect(() => {
    try {
      const s = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (s === "1") setSidebarExpanded(true);
    } catch { /* noop */ }
  }, []);

  function toggleSidebar() {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  }

  /* ── Mobile layout ─────────────────────────────── */
  if (slimMobile) {
    return (
      <CrmQueryProvider>
        <CrmHeaderProvider>
          <CrmShellProvider value={{ sidebarExpanded: false, toggleSidebar: () => {} }}>
            <div
              className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain"
              style={{ background: CRM_SURFACE_MAIN, WebkitOverflowScrolling: "touch" }}
            >
              {children}
            </div>
          </CrmShellProvider>
        </CrmHeaderProvider>
      </CrmQueryProvider>
    );
  }

  /* ── Desktop layout ────────────────────────────── */
  return (
    <CrmQueryProvider>
    <CrmHeaderProvider>
      <CrmShellProvider value={{ sidebarExpanded, toggleSidebar }}>
          <div className="flex h-[100dvh] overflow-hidden" style={{ background: CRM_SURFACE_ALT }}>

            {/* ── Sidebar shell ──────────────────── */}
            <div
              ref={railRef}
              className="relative z-20 flex flex-shrink-0 h-full"
                                        style={{
                width: sidebarExpanded ? 240 : 64,
                transition: "width 220ms cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <aside
                className="relative flex h-full w-full flex-col border-r"
                style={{ background: SB.bg, borderColor: SB.border }}
              >
                {/* Brand */}
                <div
                  className="flex flex-shrink-0 items-center border-b"
                  style={{
                    borderColor: SB.border,
                    minHeight: 60,
                    padding: sidebarExpanded ? "0 12px" : "0",
                    justifyContent: sidebarExpanded ? "space-between" : "center",
                  }}
                >
                  {/* Brand — same icon always, expanded shows label too */}
                  <Link
                    href="/crm"
                    className="flex items-center gap-2.5 no-underline"
                    style={{ justifyContent: sidebarExpanded ? "flex-start" : "center", width: "100%" }}
                  >
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ background: "#0b1f10", border: "1px solid rgba(146,255,0,0.35)" }}
                    >
                      <WajeLogoMark size={20} />
                    </div>
                    {sidebarExpanded && <WajeWordmark size="sm" tone="brand" />}
                  </Link>
                  </div>

                {/* Navigation */}
                {sidebarExpanded ? (
                  <ExpandedSidebar navGroups={navGroups} pathname={pathname} activeGroupId={activeGroupId} />
                ) : (
                  <CollapsedRail
                    navGroups={navGroups}
                    pathname={pathname}
                    flyoutId={flyoutId}
                    onToggleFlyout={(id) => setFlyoutId((prev) => (prev === id ? null : id))}
                  />
                )}

                {/* Footer */}
                <div
                  className="flex-shrink-0 border-t"
                  style={{ borderColor: SB.border }}
                >
                  <CrmSessionFooter expanded={sidebarExpanded} />
                </div>
              </aside>

              {/* Flyout */}
              {flyoutId && !sidebarExpanded && (() => {
                const group = navGroups.find((g) => g.id === flyoutId);
                if (!group) return null;
                return (
                  <FlyoutPanel
                    group={group}
                    pathname={pathname}
                    onClose={() => setFlyoutId(null)}
                    railRef={railRef}
                  />
                );
              })()}
      </div>

            {/* ── Main content ───────────────────── */}
            <div
              className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-r-2xl"
              style={{ background: CRM_SURFACE_MAIN }}
            >
              {/* Mobile topbar (hidden on desktop) */}
        <div
                className="flex flex-shrink-0 items-center justify-between gap-2 border-b px-3 py-2 md:hidden sticky top-0 z-30"
          style={{
                  background: "rgba(248,252,246,0.96)",
                  borderColor: SB.border,
                  backdropFilter: "blur(8px)",
            paddingTop: "max(0.5rem, env(safe-area-inset-top))",
          }}
        >
          <button
            type="button"
            onClick={() =>
                    typeof window !== "undefined" && window.history.length > 1
                      ? router.back()
                      : router.push("/crm")
                  }
                  className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border"
                  style={{ background: "#fff", color: "#0b2010", borderColor: SB.border, cursor: "pointer" }}
            aria-label="Voltar"
          >
                  <ChevronRight size={20} className="rotate-180" aria-hidden />
                </button>
                <Link href="/crm" className="flex items-center gap-2 no-underline">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: "#0b1f10" }}
                  >
                    <WajeLogoMark size={16} />
                  </div>
                  <WajeWordmark size="sm" tone="brand" />
                </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
                  className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border"
                  style={{ background: "#fff", color: "#0b2010", borderColor: SB.border, cursor: "pointer" }}
                  aria-label="Abrir menu"
                >
                  <Menu size={19} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {shouldHideCrmUniversalHeader(pathname) ? (
          <div
                  className="relative z-[12] hidden min-h-[4rem] flex-shrink-0 items-center border-b px-3 md:flex"
                  style={{ backgroundColor: CRM_CHROME_SOLID, borderColor: SB.border }}
          >
            <CrmSidebarToggleButton variant="header" />
          </div>
              ) : (
        <CrmUniversalHeader />
              )}

        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>
      </div>

            {/* ── Mobile menu drawer ─────────────── */}
      <div
              className={`fixed inset-0 z-[100] flex md:hidden transition-opacity duration-200 ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        role="dialog"
        aria-modal="true"
              aria-label="Menu"
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
                className="absolute inset-0 cursor-default"
                style={{ background: "rgba(11,31,16,0.28)", WebkitTapHighlightColor: "transparent" }}
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
                className={`relative flex h-full w-[min(100%,20rem)] max-w-[85vw] flex-col border-r transition-transform duration-200 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{
                  background: SB.bg,
                  borderColor: SB.border,
                  boxShadow: "4px 0 32px rgba(15,56,39,0.16)",
                  paddingTop: "env(safe-area-inset-top,0px)",
                  paddingBottom: "env(safe-area-inset-bottom,0px)",
                }}
              >
                {/* mobile header */}
                <div
                  className="flex flex-shrink-0 items-center justify-between gap-2 border-b px-4 py-3.5"
                  style={{ borderColor: SB.border }}
                >
                  <Link href="/crm" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 no-underline">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "#0b1f10" }}>
                      <WajeLogoMark size={20} />
                    </div>
                    <WajeWordmark tone="brand" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:bg-[#f0f9ed]"
                    style={{ color: SB.itemTextMuted, borderColor: SB.border, cursor: "pointer", background: "transparent" }}
                    aria-label="Fechar"
                  >
                    <X size={18} strokeWidth={2} aria-hidden />
                  </button>
                                  </div>

                {/* mobile session */}
                <div className="flex-shrink-0 border-b px-3 py-3" style={{ borderColor: SB.border }}>
                  <CrmSessionFooter variant="drawer" onNavigate={() => setMobileMenuOpen(false)} />
                </div>

                {/* mobile nav */}
                <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" style={{ WebkitOverflowScrolling: "touch" }}>
                  <ExpandedSidebar
                    navGroups={navGroups}
                    pathname={pathname}
                    activeGroupId={activeGroupId}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
          </nav>
        </div>
      </div>

        </div>
      </CrmShellProvider>
    </CrmHeaderProvider>
    </CrmQueryProvider>
  );
}
