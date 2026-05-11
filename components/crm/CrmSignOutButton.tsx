"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export function CrmSignOutButton({ expanded }: { expanded: boolean }) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/crm-session", { method: "DELETE", credentials: "include" });
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className={
        expanded
          ? "mt-1 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
          : "mt-1 flex h-10 w-10 items-center justify-center rounded-xl transition-opacity hover:opacity-90"
      }
      style={{
        background: "var(--obra-dark-3, #21262d)",
        color: "var(--obra-texto-2, #8b949e)",
        border: "1px solid var(--obra-borda, #30363d)",
        cursor: "pointer",
      }}
      title="Sair da conta"
    >
      <LogOut size={expanded ? 16 : 18} strokeWidth={2} className="flex-shrink-0" aria-hidden />
      {expanded && <span className="truncate">Sair</span>}
    </button>
  );
}
