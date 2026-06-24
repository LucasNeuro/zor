import type { PlatformBrandRow } from "@/components/crm/waje/WajeOwnerPlataformaSideover";

export type WajePlataformaMetric = {
  label: string;
  valor: string | number;
  sub?: string;
  tone: "brand" | "success" | "warning" | "muted";
  seed: number;
};

export function computeWajePlataformaMetrics(rows: PlatformBrandRow[]): WajePlataformaMetric[] {
  const vendors = rows.filter((r) => !r.is_principal);
  const vendorsAtivos = vendors.filter((r) => r.ativo);
  const clientesAtivos = vendors.reduce((s, r) => s + (r.tenants_ativos ?? 0), 0);
  const utilizadoresTotal = vendors.reduce((s, r) => s + (r.usuarios_total ?? 0), 0);
  const principal = rows.find((r) => r.is_principal);
  return [
    {
      label: "Vendors white-label",
      valor: vendorsAtivos.length,
      sub: `${vendors.length} registados`,
      tone: "brand",
      seed: 21,
    },
    {
      label: "Clientes activos",
      valor: clientesAtivos,
      sub: "Tenants activos nos vendors",
      tone: "success",
      seed: 22,
    },
    {
      label: "Utilizadores (vendors)",
      valor: utilizadoresTotal,
      sub: "Controlo financeiro",
      tone: "warning",
      seed: 23,
    },
    {
      label: "Plataforma principal",
      valor: principal?.nome ?? "Waje",
      sub: principal ? `${principal.tenants_ativos ?? 0} clientes activos` : "Owner",
      tone: "muted",
      seed: 24,
    },
  ];
}
