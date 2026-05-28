import { ETAPAS_NEGOCIO_POR_MERCADO, MERCADOS_NEGOCIO } from "@/lib/crm/pipelines";

export type FunilBarItem = { id: string; label: string; count: number; color: string };

const NEGOCIO_FUNIL_CORES = [
  "#3b82f6",
  "#f59e0b",
  "#a855f7",
  "#22c55e",
  "#06b6d4",
  "#ef4444",
  "#eab308",
  "#6b7280",
  "#14b8a6",
  "#ec4899",
];

export type EstagioPipelineRef = {
  slug: string;
  label: string;
  cor?: string | null;
};

export function prefixoToMercadoSlug(prefixo: string): string | null {
  const p = prefixo.trim().toUpperCase();
  const m = MERCADOS_NEGOCIO.find((x) => x.prefixo === p);
  return m?.slug ?? null;
}

export function buildFunilNegociosPorMercado(
  rows: { etapa: string; status: string; prefixo_mercado?: string | null }[],
  mercadoPrefixo: string,
  estagiosDb?: EstagioPipelineRef[]
): FunilBarItem[] {
  const prefixo = mercadoPrefixo.trim().toUpperCase();
  const mercadoSlug = prefixoToMercadoSlug(prefixo);
  if (!mercadoSlug) return [];

  const etapasPdf = ETAPAS_NEGOCIO_POR_MERCADO[mercadoSlug] ?? [];
  const etapas =
    estagiosDb && estagiosDb.length > 0
      ? estagiosDb.map((e) => ({
          slug: e.slug,
          label: e.label,
          cor: e.cor ?? undefined,
        }))
      : etapasPdf.map((e) => ({ slug: e.slug, label: e.label, cor: undefined as string | undefined }));

  const counts: Record<string, number> = {};
  for (const r of rows) {
    if ((r.prefixo_mercado ?? "").trim().toUpperCase() !== prefixo) continue;
    if (!["aberto", "em_negociacao"].includes(r.status)) continue;
    const e = String(r.etapa || "novo_negocio");
    counts[e] = (counts[e] ?? 0) + 1;
  }

  return etapas.map((s, i) => ({
    id: s.slug,
    label: s.label,
    count: counts[s.slug] ?? 0,
    color: s.cor ?? NEGOCIO_FUNIL_CORES[i % NEGOCIO_FUNIL_CORES.length]!,
  }));
}
