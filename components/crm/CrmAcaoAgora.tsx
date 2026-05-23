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
      href: "/crm/atendimento",
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
      href: "/crm/atendimento",
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
      <div className="mb-4 animate-pulse rounded-xl border border-[#30363d] bg-[#161b22] p-4">
        <div className="h-4 w-32 rounded bg-[#21262d]" />
        <div className="mt-3 flex gap-2">
          <div className="h-10 flex-1 rounded-lg bg-[#21262d]" />
          <div className="h-10 flex-1 rounded-lg bg-[#21262d]" />
        </div>
      </div>
    );
  }

  if (pendentes.length === 0) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#23863644] bg-[#003b2618] px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#3fb950]" />
        <p className="text-sm text-[#e6edf3]">
          Nada urgente no momento — funil e métricas abaixo estão atualizados.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-[#c9a24a44] bg-[#161b22] p-3 sm:p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#c9a24a]">Ação agora</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {pendentes.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-1 min-w-[140px] items-center gap-3 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 transition-colors hover:border-[#c9a24a55]"
            style={{ borderLeftColor: item.cor, borderLeftWidth: 3 }}
          >
            <span style={{ color: item.cor }}>{item.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#8b949e]">{item.label}</p>
              <p className="text-lg font-black tabular-nums" style={{ color: item.cor }}>
                {item.valor}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
