"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { MOBILE_MORE_ITEMS } from "@/lib/mobile/nav";

type Badges = { leads: number; chat: number; aprovacoes: number };

export function MobileMoreSheet({
  open,
  onClose,
  badges,
}: {
  open: boolean;
  onClose: () => void;
  badges: Badges;
}) {
  const router = useRouter();

  if (!open) return null;

  function badgeFor(key?: string): number {
    if (key === "leads") return badges.leads;
    if (key === "aprovacoes") return badges.aprovacoes;
    if (key === "chat") return badges.chat;
    return 0;
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end md:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Fechar menu"
        onClick={onClose}
      />
      <div
        className="relative max-h-[75dvh] overflow-hidden rounded-t-2xl border border-[#30363d] bg-[#161b22]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
      >
        <div className="flex items-center justify-between border-b border-[#30363d] px-4 py-3">
          <p className="text-sm font-bold text-[#e6edf3]">Mais opções</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#21262d] text-[#e6edf3]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="m-0 max-h-[60dvh] list-none overflow-y-auto p-2">
          {MOBILE_MORE_ITEMS.map((item) => {
            const b = badgeFor(item.badgeKey);
            return (
              <li key={item.href}>
                <button
                  type="button"
                  className="flex w-full min-h-12 items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-semibold text-[#e6edf3] hover:bg-[#21262d]"
                  onClick={() => {
                    onClose();
                    router.push(item.href);
                  }}
                >
                  <span>{item.label}</span>
                  {b > 0 && (
                    <span className="rounded-full bg-[#b3261e] px-2 py-0.5 text-[10px] font-black text-white">
                      {b > 9 ? "9+" : b}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
