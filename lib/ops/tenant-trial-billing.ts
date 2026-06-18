import { crmDb } from "@/lib/crm/supabase-server";

export type TenantTrialRow = {
  id: string;
  slug: string;
  nome_exibicao: string;
  ativo: boolean;
  trial_ate: string | null;
};

/** Tenant com trial expirado e sem mensalidade paga após o fim do teste. */
export async function listarTenantsTrialExpiradoSemPagamento(): Promise<TenantTrialRow[]> {
  const agora = new Date().toISOString();
  const { data: tenants, error } = await crmDb()
    .from("hub_tenants")
    .select("id, slug, nome_exibicao, ativo, trial_ate")
    .eq("ativo", true)
    .not("trial_ate", "is", null)
    .lt("trial_ate", agora);

  if (error) throw new Error(error.message);
  if (!tenants?.length) return [];

  const ids = tenants.map((t) => t.id);
  const { data: pagos, error: payErr } = await crmDb()
    .from("hub_tenant_mensalidades")
    .select("tenant_id, pago_em, competencia")
    .in("tenant_id", ids)
    .eq("status", "pago");

  if (payErr) throw new Error(payErr.message);

  const pagosPorTenant = new Map<string, { pago_em: string | null; competencia: string }[]>();
  for (const p of pagos ?? []) {
    const list = pagosPorTenant.get(p.tenant_id) ?? [];
    list.push({ pago_em: p.pago_em, competencia: p.competencia });
    pagosPorTenant.set(p.tenant_id, list);
  }

  return tenants.filter((t) => {
    const trialEnd = t.trial_ate ? new Date(t.trial_ate).getTime() : 0;
    const mensalidades = pagosPorTenant.get(t.id) ?? [];
    const temPagamentoPosTrial = mensalidades.some((m) => {
      if (m.pago_em && new Date(m.pago_em).getTime() >= trialEnd) return true;
      if (m.competencia && new Date(m.competencia).getTime() >= trialEnd) return true;
      return false;
    });
    return !temPagamentoPosTrial;
  });
}

export async function desativarTenantsTrialExpiradoSemPagamento(): Promise<{
  verificados: number;
  desativados: string[];
}> {
  const candidatos = await listarTenantsTrialExpiradoSemPagamento();
  const desativados: string[] = [];

  for (const t of candidatos) {
    const { error } = await crmDb()
      .from("hub_tenants")
      .update({ ativo: false })
      .eq("id", t.id)
      .eq("ativo", true);

    if (!error) {
      desativados.push(t.slug);
      console.info("[ops/trial] tenant desativado por trial expirado sem pagamento:", t.slug);
    }
  }

  return { verificados: candidatos.length, desativados };
}
