"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils/initials";

/* ── Shared auth listener ───────────────────────────────────────────── */
type AuthProfileListener = (user: User | null) => void;
const authProfileHub = {
  listeners: new Set<AuthProfileListener>(),
  subscription: null as { unsubscribe: () => void } | null,
};

function subscribeSharedAuthProfile(listener: AuthProfileListener): () => void {
  authProfileHub.listeners.add(listener);
  if (!authProfileHub.subscription) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

/* ── Helpers ────────────────────────────────────────────────────────── */
function displayNameFromUser(user: Pick<User, "email" | "user_metadata">): string {
  const meta = user.user_metadata as { name?: string } | undefined;
  const n = meta?.name?.trim();
  if (n) return n;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Utilizador";
}

function formatRole(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === "owner") return "Owner";
  if (r === "admin") return "Admin";
  if (r === "platform_admin") return "Plataforma";
  if (r === "member") return "Membro";
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

/* ── Avatar ─────────────────────────────────────────────────────────── */
function Avatar({ initials, size }: { initials: string; size: number }) {
  return (
    <div
      className="relative flex-shrink-0 rounded-full"
      style={{ width: size, height: size }}
    >
      {/* ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "linear-gradient(135deg, #92ff00 0%, #3f9848 60%, #0b1f10 100%)",
          padding: 2,
        }}
      >
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-bold tracking-wide"
          style={{
            background: "#f5fbf4",
            color: "#0b2210",
            fontSize: size >= 40 ? 13 : 10,
          }}
        >
          {initials}
        </div>
      </div>
    </div>
  );
}

/* ── Component ──────────────────────────────────────────────────────── */
export function CrmSessionFooter({
  expanded = false,
  variant = "sidebar",
  onNavigate,
}: {
  expanded?: boolean;
  variant?: "sidebar" | "drawer";
  onNavigate?: () => void;
  /** @deprecated não utilizado */
  primaryAction?: unknown;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [platformTeam, setPlatformTeam] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(u: User) {
      setEmail(u.email ?? "");
      setName(displayNameFromUser(u));
      const row = await supabase
        .from("users")
        .select("name, role, owner")
        .eq("auth_id", u.id)
        .maybeSingle();
      if (cancelled) return;
      if (row.data?.name) setName(String(row.data.name).trim());
      const r = row.data?.role != null ? String(row.data.role) : "";
      const ownerFlag =
        row.data?.owner === true ||
        row.data?.owner === "true" ||
        row.data?.owner === 1;
      setPlatformTeam(ownerFlag || r.trim().toLowerCase() === "platform_admin");
      setRole(r);
    }

    function onAuthUser(user: User | null) {
      if (cancelled) return;
      if (user) void loadProfile(user);
      else { setName(""); setEmail(""); setRole(""); setPlatformTeam(false); }
    }

    const unsubscribe = subscribeSharedAuthProfile(onAuthUser);
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  const initials = getInitials(name || email || "—");
  const rolePill = platformTeam ? "Plataforma" : formatRole(role);
  const showExpanded = expanded || variant === "drawer";

  /* ── Collapsed ──────────────────────────────────────────────────── */
  if (!showExpanded) {
    return (
      <div className="mt-auto flex w-full flex-shrink-0 flex-col items-center gap-2 px-1 pt-3 pb-3">
        <Avatar initials={initials} size={36} />

        {/* logout */}
        <button
          type="button"
          title="Sair da conta"
          aria-label="Sair da conta"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-colors"
          style={{
            background: "#fff2f1",
            border: "1px solid #f0c0bd",
            color: "#c0392b",
          }}
          onClick={() => void signOutAndRedirect(router, onNavigate)}
        >
          <LogOut size={14} strokeWidth={2} aria-hidden />
        </button>
      </div>
    );
  }

  /* ── Expanded ───────────────────────────────────────────────────── */
  return (
    <div className="mt-auto w-full flex-shrink-0 px-2 pb-3">
      <div
        className="w-full rounded-2xl p-3"
        style={{
          background: "#f5fbf4",
          border: "1px solid #d8edd4",
          boxShadow: "0 2px 8px rgba(11,31,16,0.06)",
        }}
      >
        {/* Top row: avatar + info */}
        <div className="flex items-center gap-2.5">
          <Avatar initials={initials} size={40} />

          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-bold leading-tight"
              style={{ color: "#0b2210" }}
            >
              {name || "…"}
            </p>
            {email && (
              <p
                className="mt-0.5 truncate text-[11px] leading-snug"
                style={{ color: "#5a7a62" }}
              >
                {email}
              </p>
            )}
            {rolePill && (
              <span
                className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: "rgba(146,255,0,0.12)",
                  color: "#1e4a24",
                  border: "1px solid rgba(146,255,0,0.3)",
                }}
              >
                {rolePill}
              </span>
            )}
          </div>
        </div>

        {/* Bottom row: actions */}
        <div
          className="mt-2.5 flex items-center gap-2 pt-2.5"
          style={{ borderTop: "1px solid #d8edd4" }}
        >
          <a
            href="/crm/configuracoes"
            onClick={onNavigate}
            className="flex flex-1 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium no-underline transition-colors hover:bg-[#e8f5e4]"
            style={{ color: "#3d6b4f" }}
          >
            <Settings size={13} strokeWidth={2} aria-hidden />
            Conta
          </a>

          <button
            type="button"
            title="Sair da conta"
            aria-label="Sair da conta"
            onClick={() => void signOutAndRedirect(router, onNavigate)}
            className="flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition-colors hover:bg-[#ffe8e6]"
            style={{
              background: "#fff2f1",
              border: "1px solid #f0c0bd",
              color: "#c0392b",
              cursor: "pointer",
            }}
          >
            <LogOut size={13} strokeWidth={2} aria-hidden />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
