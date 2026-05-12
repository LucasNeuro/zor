"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogOut, type LucideIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { getInitials } from "@/lib/data/office-map";

function displayNameFromUser(user: Pick<User, "email" | "user_metadata">): string {
  const meta = user.user_metadata as { name?: string } | undefined;
  const n = meta?.name?.trim();
  if (n) return n;
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Utilizador";
}

/** Rótulo curto para o badge (papéis em `public.app_role`). */
function formatRolePill(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === "owner") return "Owner";
  if (r === "admin") return "Admin";
  if (!r) return "";
  return role;
}

async function signOutAndRedirect(router: ReturnType<typeof useRouter>, onNavigate?: () => void) {
  onNavigate?.();
  await fetch("/api/auth/crm-session", { method: "DELETE", credentials: "include" });
  await supabase.auth.signOut();
  router.push("/login");
  router.refresh();
}

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
  /** Por defeito: Escritório → `/office`. Na página do escritório use p.ex. CRM → `/crm`. */
  primaryAction?: { href: string; label: string; title?: string; icon?: LucideIcon };
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const primary = primaryAction ?? {
    href: "/office",
    label: "Escritório",
    title: "Escritório virtual",
    icon: Building2,
  };
  const PrimaryIcon = primary.icon ?? Building2;

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(u: User) {
      setEmail(u.email ?? "");
      setName(displayNameFromUser(u));
      const row = await supabase.from("users").select("name, role").eq("auth_id", u.id).maybeSingle();
      if (cancelled) return;
      if (row.data?.name) setName(String(row.data.name).trim());
      setRole(row.data?.role != null ? String(row.data.role) : "");
    }

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) void loadProfile(user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void loadProfile(session.user);
      else {
        setName("");
        setEmail("");
        setRole("");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const initials = getInitials(name || email || "—");
  const rolePill = formatRolePill(role);
  const isDrawer = variant === "drawer";
  const showExpandedBlock = expanded || isDrawer;

  const avatar = (
    <div
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
      style={{
        background: "linear-gradient(145deg, #21262d 0%, #161b22 100%)",
        color: "var(--obra-dourado, #c9a24a)",
        border: "1px solid rgba(201, 162, 74, 0.35)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
      title={email || undefined}
    >
      {initials}
    </div>
  );

  const btnGroupBase =
    "inline-flex min-h-10 w-full max-w-full overflow-hidden rounded-xl border transition-opacity hover:opacity-95";
  const btnGroupBorder = "1px solid var(--obra-borda, #30363d)";

  const signOutBtnClassIconOnly =
    "flex flex-none items-center justify-center px-2.5 py-2.5 text-sm font-semibold sm:px-3";

  const officeLinkClass =
    "flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold transition-colors no-underline";
  const officeLinkStyle: CSSProperties = {
    background: "var(--obra-verde, #003b26)",
    color: "var(--obra-dourado, #c9a24a)",
  };

  const signOutExpandedStyle: CSSProperties = {
    background: "rgba(248, 81, 73, 0.12)",
    color: "#f85149",
    borderLeft: "1px solid var(--obra-borda, #30363d)",
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 0 #f85149, inset 0 -1px 0 0 #f85149, inset -1px 0 0 0 #f85149",
  };

  const signOutCollapsedStyle: CSSProperties = {
    background: "rgba(248, 81, 73, 0.12)",
    color: "#f85149",
    cursor: "pointer",
    boxShadow: "inset 1px 0 0 0 #f85149, inset -1px 0 0 0 #f85149, inset 0 -1px 0 0 #f85149",
  };

  if (!showExpandedBlock) {
    return (
      <div
        className="mt-auto flex w-full flex-shrink-0 flex-col items-center gap-2 border-t px-1 pt-2 pb-1"
        style={{ borderColor: "rgba(48,54,61,0.65)" }}
      >
        {avatar}
        <div
          className={`${btnGroupBase} w-[2.75rem] flex-col`}
          style={{ border: btnGroupBorder }}
        >
          <Link
            href={primary.href}
            className="flex h-10 w-10 flex-none items-center justify-center border-b"
            style={{ ...officeLinkStyle, borderColor: "rgba(48,54,61,0.65)" }}
            title={primary.title ?? primary.label}
          >
            <PrimaryIcon size={18} strokeWidth={2} aria-hidden />
          </Link>
          <button
            type="button"
            className="flex h-10 w-10 flex-none items-center justify-center"
            style={signOutCollapsedStyle}
            title="Sair da conta"
            onClick={() => void signOutAndRedirect(router, onNavigate)}
          >
            <LogOut size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mt-auto flex flex-shrink-0 flex-col gap-2 border-t pt-2 pb-1 ${isDrawer ? "px-2" : "w-full px-1"}`}
      style={{ borderColor: "rgba(48,54,61,0.65)" }}
    >
      <div className={`flex items-center gap-3 ${isDrawer ? "px-1" : "px-2"} py-1`}>
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--obra-texto, #e6edf3)" }}>
            {name || "…"}
          </p>
          {email ? (
            <p className="truncate text-[11px]" style={{ color: "var(--obra-texto-3, #484f58)" }}>
              {email}
            </p>
          ) : null}
          {rolePill ? (
            <span
              className="mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{
                background: "rgba(0, 59, 38, 0.55)",
                color: "var(--obra-dourado-light, #e0b86a)",
                border: "1px solid rgba(201, 162, 74, 0.25)",
              }}
            >
              {rolePill}
            </span>
          ) : null}
        </div>
      </div>

      <div className={btnGroupBase} style={{ border: btnGroupBorder }}>
        <Link
          href={primary.href}
          className={officeLinkClass}
          style={officeLinkStyle}
          title={primary.title ?? primary.label}
          onClick={onNavigate}
        >
          <PrimaryIcon size={18} strokeWidth={2} className="flex-shrink-0" aria-hidden />
          <span className="truncate">{primary.label}</span>
        </Link>
        <button
          type="button"
          className={signOutBtnClassIconOnly}
          style={signOutExpandedStyle}
          title="Sair da conta"
          aria-label="Sair da conta"
          onClick={() => void signOutAndRedirect(router, onNavigate)}
        >
          <LogOut size={18} strokeWidth={2} className="flex-shrink-0" aria-hidden />
        </button>
      </div>
    </div>
  );
}
