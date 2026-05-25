import type { SupabaseClient } from "@supabase/supabase-js";
import { HUB_PREFIXO_CODIGO } from "@/lib/crm/codigos-rastreio";
import { resolverMercadoLead } from "@/lib/crm/mercado-visual";

export type VinculoEntidadeTipo = "pessoa" | "empresa" | "parceiro" | "lead";
export type VinculoPapel =
  | "cliente"
  | "contato_principal"
  | "lead_origem"
  | "empresa"
  | "parceiro"
  | "indicador"
  | "participante";

type VinculoInsert = {
  negocio_id: string;
  entidade_tipo: VinculoEntidadeTipo;
  entidade_id: string;
  codigo_rastreio: string | null;
  papel: VinculoPapel;
  tenant_id?: string | null;
};

type VinculoItemInput = {
  id: string;
  codigo?: string | null;
};

async function insertVinculosCompat(
  supabase: SupabaseClient,
  rows: VinculoInsert[]
): Promise<void> {
  if (!rows.length) return;

  let payload = rows.map((row) => ({ ...row }));

  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase.from("hub_negocio_vinculos").insert(payload);

    if (
      !error ||
      error.message.includes("duplicate") ||
      error.message.includes("idx_hub_negocio_vinculos_unique")
    ) {
      return;
    }

    if (error.message.includes("tenant_id") && error.message.includes("column")) {
      payload = payload.map(({ tenant_id: _tenantId, ...rest }) => rest);
      continue;
    }

    if (error.message.includes("does not exist")) return;
    throw new Error(error.message);
  }
}

export async function criarVinculosNegocio(
  supabase: SupabaseClient,
  opts: {
    negocio_id: string;
    leads?: VinculoItemInput[];
    pessoas?: VinculoItemInput[];
    empresas?: VinculoItemInput[];
    parceiros?: VinculoItemInput[];
    tenant_id?: string | null;
  }
): Promise<void> {
  const rows: VinculoInsert[] = [];

  (opts.leads || []).forEach((lead, index) => {
    rows.push({
      negocio_id: opts.negocio_id,
      entidade_tipo: "lead",
      entidade_id: lead.id,
      codigo_rastreio: lead.codigo ?? null,
      papel: index === 0 ? "lead_origem" : "participante",
      tenant_id: opts.tenant_id,
    });
  });

  (opts.pessoas || []).forEach((pessoa, index) => {
    rows.push({
      negocio_id: opts.negocio_id,
      entidade_tipo: "pessoa",
      entidade_id: pessoa.id,
      codigo_rastreio: pessoa.codigo ?? null,
      papel: index === 0 ? "contato_principal" : "participante",
      tenant_id: opts.tenant_id,
    });
  });

  (opts.empresas || []).forEach((empresa) => {
    rows.push({
      negocio_id: opts.negocio_id,
      entidade_tipo: "empresa",
      entidade_id: empresa.id,
      codigo_rastreio: empresa.codigo ?? null,
      papel: "empresa",
      tenant_id: opts.tenant_id,
    });
  });

  (opts.parceiros || []).forEach((parceiro) => {
    rows.push({
      negocio_id: opts.negocio_id,
      entidade_tipo: "parceiro",
      entidade_id: parceiro.id,
      codigo_rastreio: parceiro.codigo ?? null,
      papel: "parceiro",
      tenant_id: opts.tenant_id,
    });
  });

  await insertVinculosCompat(supabase, rows);
}

/**
 * Cria vínculos de rastreio ao converter lead → negócio (PES, LED, EMP quando PJ).
 */
export async function criarVinculosNegocioFromLead(
  supabase: SupabaseClient,
  opts: {
    negocio_id: string;
    lead_id: string;
    lead_codigo: string | null;
    pessoa_id: string | null;
    pessoa_codigo: string | null;
    empresa_id?: string | null;
    empresa_codigo?: string | null;
    tenant_id?: string | null;
  }
): Promise<void> {
  const rows: VinculoInsert[] = [];

  rows.push({
    negocio_id: opts.negocio_id,
    entidade_tipo: "lead",
    entidade_id: opts.lead_id,
    codigo_rastreio: opts.lead_codigo,
    papel: "lead_origem",
    tenant_id: opts.tenant_id,
  });

  if (opts.pessoa_id) {
    rows.push({
      negocio_id: opts.negocio_id,
      entidade_tipo: "pessoa",
      entidade_id: opts.pessoa_id,
      codigo_rastreio: opts.pessoa_codigo,
      papel: "contato_principal",
      tenant_id: opts.tenant_id,
    });
  }

  if (opts.empresa_id) {
    rows.push({
      negocio_id: opts.negocio_id,
      entidade_tipo: "empresa",
      entidade_id: opts.empresa_id,
      codigo_rastreio: opts.empresa_codigo ?? null,
      papel: "empresa",
      tenant_id: opts.tenant_id,
    });
  }

  await insertVinculosCompat(supabase, rows);
}

/** Prefixo de mercado a partir do metadata do lead. */
export function prefixoMercadoFromLead(metadata: unknown): string {
  return resolverMercadoLead(metadata);
}

export { HUB_PREFIXO_CODIGO };
