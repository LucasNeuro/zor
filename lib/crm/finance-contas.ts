export type TipoConta = "pagar" | "receber";

export type ContaFinanceira = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string | null;
  status: string;
  criado_em?: string;
};

export function hojeLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysISO(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diasAteVencimento(vencimento: string | null): number | null {
  if (!vencimento) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(`${String(vencimento).slice(0, 10)}T12:00:00`);
  return Math.round((v.getTime() - hoje.getTime()) / 86400000);
}

export function labelDias(dias: number | null): string {
  if (dias === null) return "Sem vencimento";
  if (dias < 0) return `${Math.abs(dias)}d atraso`;
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  return `Em ${dias}d`;
}

export function moedaFinanceiro(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

export function filtrarContas(
  contas: ContaFinanceira[],
  opts: {
    status?: string;
    vencido?: boolean;
    proximos?: number;
  }
): ContaFinanceira[] {
  const hoje = hojeLocalISO();
  let out = [...contas];

  if (opts.status) {
    out = out.filter((c) => c.status === opts.status);
  }

  if (opts.vencido) {
    out = out.filter(
      (c) =>
        c.status === "pendente" &&
        c.vencimento != null &&
        String(c.vencimento).slice(0, 10) < hoje
    );
  }

  if (opts.proximos != null && opts.proximos > 0) {
    const limite = addDaysISO(hoje, opts.proximos);
    out = out.filter((c) => {
      if (c.status !== "pendente" || !c.vencimento) return false;
      const v = String(c.vencimento).slice(0, 10);
      return v >= hoje && v <= limite;
    });
  }

  return out.sort((a, b) => {
    if (!a.vencimento && !b.vencimento) return 0;
    if (!a.vencimento) return 1;
    if (!b.vencimento) return -1;
    return String(a.vencimento).localeCompare(String(b.vencimento));
  });
}

export const STATUS_PAGAR = [
  { id: "pendente", label: "Pendente" },
  { id: "pago", label: "Pago" },
  { id: "cancelado", label: "Cancelado" },
] as const;

export const STATUS_RECEBER = [
  { id: "pendente", label: "Pendente" },
  { id: "recebido", label: "Recebido" },
  { id: "cancelado", label: "Cancelado" },
] as const;
