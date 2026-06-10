"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, MessageSquare, User } from "lucide-react";
import type { Metricas } from "@/hooks/useMetricas";

type Item = {
  label: string;
  valor: number;
  href: string;
  cor: string;
  icon: ReactNode;
};

export function CrmAcaoAgora({
  m,
  loading,
  indisponivel,
}: {
  m: Metricas;
  loading: boolean;
  /** Painel não carregou — evita “Nada urgente” enganoso */
  indisponivel?: boolean;
}) {
  const itens: Item[] = [
    {
      label: "Leads aguardando você",
      valor: m.leadsAguardando,
      href: "/crm/leads?tab=chat",
      cor: "#c9a24a",
      icon: <User className="h-4 w-4" />,
    },
    {
      label: "Aprovações pendentes",
      valor: m.aprovacoesPendentes,
      href: "/crm/aprovacoes",
      cor: "#f85149",
      icon: <AlertCircle className="h-4 w-4" />,
    },
    {
      label: "Mensagens na fila",
      valor: m.mensagensFilaPendentes,
      href: "/crm/leads?tab=chat",
      cor: m.mensagensFilaPendentes > 0 ? "#d29922" : "#3fb950",
      icon: <MessageSquare className="h-4 w-4" />,
    },
  ];

  const pendentes = itens.filter((i) => i.valor > 0);

  if (indisponivel) {
    return null;
  }

  if (loading) {
    return (
      <div className="mb-6 animate-pulse rounded-2xl border border-[#e8f0e6] bg-[#ffffff] p-5">
        <div className="h-4 w-32 rounded bg-[#e8f0e6]" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="h-16 rounded-xl bg-[#dcebd8]" />
          <div className="h-16 rounded-xl bg-[#dcebd8]" />
          <div className="h-16 rounded-xl bg-[#dcebd8]" />
        </div>
      </div>
    );
  }

  if (pendentes.length === 0) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#23863655] bg-gradient-to-r from-[#003b2622] to-[#ffffff] px-4 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#23863633]">
          <CheckCircle2 className="h-5 w-5 text-[#3fb950]" />
        </span>
        <p className="text-sm leading-snug text-[#0b2210]">
          Nada urgente no momento — funil e métricas abaixo estão atualizados.
        </p>
      </div>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border border-[#c9a24a55] bg-gradient-to-br from-[#1a1508] via-[#ffffff] to-[#0f1520] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.28)] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#c9a24a]">Ação agora</p>
        <span className="rounded-full border border-[#c9a24a44] bg-[#c9a24a14] px-2 py-0.5 text-[10px] font-bold text-[#c9a24a]">
          {pendentes.length} pendente{pendentes.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pendentes.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-[#dcebd8] bg-[#f8fcf6]/80 px-3.5 py-3 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[#c9a24a66]"
            style={{ borderLeftColor: item.cor, borderLeftWidth: 3 }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: `${item.cor}22`, color: item.cor }}
            >
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#5d7a67]">{item.label}</p>
              <p className="text-xl font-black tabular-nums leading-tight" style={{ color: item.cor }}>
                {item.valor}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
