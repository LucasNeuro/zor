"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  MOBILE_TABS,
  mobileTabIdFromPath,
  isMobileShellRoute,
  needsMobileSubHeader,
  mobilePageTitle,
} from "@/lib/mobile/nav";
import { MobileMoreSheet } from "@/components/mobile/MobileMoreSheet";

interface Props {
  children: React.ReactNode;
}

const BOTTOM_NAV_H = "calc(3.75rem + env(safe-area-inset-bottom, 8px))";

export default function MobileShell({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [badges, setBadges] = useState({ leads: 0, chat: 0, aprovacoes: 0 });
  const [moreOpen, setMoreOpen] = useState(false);
  const [historico, setHistorico] = useState<string[]>([]);

  const abaAtiva = mobileTabIdFromPath(pathname);

  useEffect(() => {
    setHistorico((prev) => {
      if (prev[prev.length - 1] === pathname) return prev;
      return [...prev.slice(-9), pathname];
    });
  }, [pathname]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const carregarBadges = useCallback(async () => {
    const [leads, msgs, aprovs] = await Promise.all([
      supabase
        .from("hub_leads_crm")
        .select("id", { count: "exact", head: true })
        .not("estagio", "in", '("ganho","perdido")')
        .is("humano_responsavel", null),
      supabase
        .from("hub_fila_mensagens")
        .select("id", { count: "exact", head: true })
        .eq("direcao", "entrada")
        .eq("status", "pendente"),
      supabase
        .from("hub_aprovacoes")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente"),
    ]);
    setBadges({
      leads: leads.count || 0,
      chat: msgs.count || 0,
      aprovacoes: aprovs.count || 0,
    });
  }, []);

  useEffect(() => {
    void carregarBadges();
    const sub = supabase
      .channel("mobile-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregarBadges)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_fila_mensagens" }, carregarBadges)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregarBadges)
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [carregarBadges]);

  if (!isMobileShellRoute(pathname)) {
    return <>{children}</>;
  }

  function voltar() {
    if (historico.length > 1) {
      const anterior = historico[historico.length - 2];
      setHistorico((prev) => prev.slice(0, -1));
      router.push(anterior);
    } else {
      router.push("/crm");
    }
  }

  function badgeForTab(tabId: string): number {
    if (tabId === "atendimento") return badges.chat;
    if (tabId === "mais") return badges.leads + badges.aprovacoes;
    return 0;
  }

  const showSubHeader = needsMobileSubHeader(pathname);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#0d1117]">
      {showSubHeader && (
        <div
          className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-[#30363d] bg-[#161b22]/95 px-4 backdrop-blur-md"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
            paddingBottom: "12px",
            minHeight: "52px",
          }}
        >
          <button
            type="button"
            onClick={voltar}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#21262d] text-lg text-white"
            aria-label="Voltar"
          >
            ←
          </button>
          <h1 className="min-w-0 flex-1 truncate text-base font-bold text-[#e6edf3]">
            {mobilePageTitle(pathname)}
          </h1>
        </div>
      )}

      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ paddingBottom: BOTTOM_NAV_H }}
      >
        {children}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#30363d] bg-[#161b22] shadow-[0_-1px_0_0_#30363d]"
        style={{
          paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}
        aria-label="Navegação principal"
      >
        <div className="flex">
          {MOBILE_TABS.map((aba) => {
            const ativo = abaAtiva === aba.id;
            const badge = badgeForTab(aba.id);
            const TabIcon = aba.icon;
            return (
              <button
                key={aba.id}
                type="button"
                onClick={() => {
                  if (aba.opensSheet) {
                    setMoreOpen(true);
                    return;
                  }
                  if (aba.rota) router.push(aba.rota);
                }}
                className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 border-none bg-transparent py-2"
                style={{ color: ativo ? "#c9a24a" : "#484f58", cursor: "pointer" }}
                aria-current={ativo ? "page" : undefined}
              >
                <div className="relative">
                  <TabIcon size={22} strokeWidth={1.5} aria-hidden />
                  {badge > 0 && (
                    <span
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white"
                      style={{ background: "#b3261e" }}
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold">{aba.label}</span>
                {ativo && <span className="h-1 w-1 rounded-full bg-[#c9a24a]" />}
              </button>
            );
          })}
        </div>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} badges={badges} />
    </div>
  );
}
