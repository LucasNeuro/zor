"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Shield, type LucideIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { getInitials } from "@/lib/data/office-map";

/** Um único `onAuthStateChange` + um `getUser` inicial para todos os footers (sidebar + drawer) — evita locks GoTrue duplicados. */
type AuthProfileListener = (user: User | null) => void;

const authProfileHub = {
  listeners: new Set<AuthProfileListener>(),
  subscription: null as { unsubscribe: () => void } | null,
};

function subscribeSharedAuthProfile(listener: AuthProfileListener): () => void {
  authProfileHub.listeners.add(listener);
  if (!authProfileHub.subscription) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      authProfileHub.listeners.forEach((fn) => fn(u));
    });
    authProfileHub.subscription = subscription;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      authProfileHub.listeners.forEach((fn) => fn(user ?? null));
    });
  }
  return () => {
    authProfileHub.listeners.delete(listener);
    if (authProfileHub.listeners.size === 0 && authProfileHub.subscription) {
      authProfileHub.subscription.unsubscribe();
      authProfileHub.subscription = null;
    }
  };
}

function displayNameFromUser(user: Pick<User, "email" | "user_metadata">): string {
  const meta = user.user_metadata as { name?: string } | undefined;
  const n = meta?.name?.trim();
  if (n) return n;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Utilizador";
}

function formatRolePill(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === "owner") return "Owner";
  if (r === "admin") return "Admin";
  if (!r) return "";
  return role;
}

async function signOutAndRedirect(
  router: ReturnType<typeof useRouter>,
  onNavigate?: () => void,
) {
  onNavigate?.();
  await fetch("/api/auth/crm-session", { method: "DELETE", credentials: "include" });
  await supabase.auth.signOut();
  router.push("/login");
  router.refresh();
}

/* ─── Avatar ─────────────────────────────────────────────────────────────── */

const AVATAR_RING =
  "linear-gradient(135deg, #c9a24a 0%, #e0c068 40%, #5a9e7a 70%, #003b26 100%)";
const AVATAR_INNER = "linear-gradient(145deg, #1c2a1e 0%, #0d1117 100%)";
const AVATAR_SHADOW = "0 0 0 1px rgba(201,162,74,0.30), 0 4px 12px rgba(0,0,0,0.55)";

function Avatar({ initials, email, size }: { initials: string; email: string; size: number }) {
  return (
    <div
      className="relative flex-shrink-0 rounded-full"
      style={{ width: size, height: size, boxShadow: AVATAR_SHADOW }}
      title={email || undefined}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: AVATAR_RING, padding: 2 }}
      >
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-bold tracking-wide text-white"
          style={{
            background: AVATAR_INNER,
            fontSize: size >= 44 ? 14 : 11,
          }}
        >
          {initials}
        </div>
      </div>
    </div>
  );
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function CrmSessionFooter({
  expanded = false,
  variant = "sidebar",
  onNavigate,
  primaryAction,
}: {
  expanded?: boolean;
  variant?: "sidebar" | "drawer";
  /** Chamado antes do redirect (ex.: fechar menu mobile). */
  onNavigate?: () => void;
  /** Ação opcional (ex. link secundário). No CRM omitir — não promover escritório virtual. */
  primaryAction?: { href: string; label: string; title?: string; icon?: LucideIcon };
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const primary = primaryAction;
  const PrimaryIcon = primary?.icon;

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(u: User) {
      setEmail(u.email ?? "");
      setName(displayNameFromUser(u));
      const row = await supabase
        .from("users")
        .select("name, role")
        .eq("auth_id", u.id)
        .maybeSingle();
      if (cancelled) return;
      if (row.data?.name) setName(String(row.data.name).trim());
      setRole(row.data?.role != null ? String(row.data.role) : "");
    }

    function onAuthUser(user: User | null) {
      if (cancelled) return;
      if (user) void loadProfile(user);
      else {
        setName("");
        setEmail("");
        setRole("");
      }
    }

    const unsubscribe = subscribeSharedAuthProfile(onAuthUser);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const initials = getInitials(name || email || "—");
  const rolePill = formatRolePill(role);
  const isDrawer = variant === "drawer";
  const showExpandedBlock = expanded || isDrawer;
  const isPrivileged = ["owner", "admin"].includes(role.trim().toLowerCase());

  /* ── Role badge ─────────────────────────────────────────────────── */
  const roleBadge = rolePill ? (
    <span
      className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{
        background: "#c9a24a14",
        color: "#c9a24a",
        border: "1px solid #c9a24a44",
      }}
    >
      {isPrivileged && <Shield size={9} strokeWidth={2.5} aria-hidden />}
      {rolePill}
    </span>
  ) : null;

  /* ── Collapsed (sidebar minimizada) ─────────────────────────────── */
  if (!showExpandedBlock) {
    return (
      <div className="mt-auto flex w-full flex-shrink-0 flex-col items-center gap-2.5 px-1 pt-3 pb-2">
        <Avatar initials={initials} email={email} size={40} />

        {primary && PrimaryIcon && (
          <Link
            href={primary.href}
            title={primary.title ?? primary.label}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:opacity-80"
            style={{
              background: "var(--obra-verde, #003b26)",
              color: "var(--obra-dourado, #c9a24a)",
              border: "1px solid rgba(201,162,74,0.2)",
            }}
          >
            <PrimaryIcon size={16} strokeWidth={2} aria-hidden />
          </Link>
        )}

        <button
          type="button"
          title="Sair da conta"
          aria-label="Sair da conta"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[#f8514944] bg-[#f8514914] text-[#f85149] transition-colors hover:border-[#f85149] hover:bg-[#f8514930]"
          onClick={() => void signOutAndRedirect(router, onNavigate)}
        >
          <LogOut size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>
    );
  }

  const signOutIconBtn = (
    <button
      type="button"
      title="Sair da conta"
      aria-label="Sair da conta"
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[#f8514944] bg-[#f8514914] text-[#f85149] transition-colors hover:border-[#f85149] hover:bg-[#f8514930]"
      onClick={() => void signOutAndRedirect(router, onNavigate)}
    >
      <LogOut size={16} strokeWidth={2} aria-hidden />
    </button>
  );

  /* ── Expanded (sidebar aberta ou drawer) ─────────────────────────── */
  return (
    <div
      className={`mt-auto flex flex-shrink-0 ${isDrawer ? "px-2 pb-2" : "w-full px-2 pb-2"}`}
    >
      <div className="w-full rounded-2xl border border-[#2b3544] bg-[#121926] p-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar initials={initials} email={email} size={40} />

          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-bold leading-tight tracking-tight"
              style={{ color: "var(--obra-texto, #e6edf3)" }}
            >
              {name || "…"}
            </p>
            {email ? (
              <p className="mt-0.5 truncate text-[11px] leading-tight" style={{ color: "#6e7681" }}>
                {email}
              </p>
            ) : null}
            {roleBadge}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1.5 self-center">
            {primary && PrimaryIcon ? (
              <Link
                href={primary.href}
                title={primary.title ?? primary.label}
                className="flex h-9 w-9 items-center justify-center rounded-xl no-underline transition-opacity hover:opacity-90"
                style={{
                  background: "var(--obra-verde, #003b26)",
                  color: "var(--obra-dourado, #c9a24a)",
                  border: "1px solid rgba(201,162,74,0.2)",
                }}
                onClick={onNavigate}
              >
                <PrimaryIcon size={16} strokeWidth={2} aria-hidden />
              </Link>
            ) : null}
            {signOutIconBtn}
          </div>
        </div>
      </div>
    </div>
  );
}
