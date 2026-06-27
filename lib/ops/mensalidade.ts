import { crmDb } from "@/lib/crm/supabase-server";
import {
  lerEmpresaCadastralTenant,
  type TenantEmpresaCadastral,
} from "@/lib/hub/tenant-empresa-cadastral";
import {
  documentoProntoParaCora,
  resolverPerfilCobrancaTenant,
  resumoEnderecoPerfilCobranca,
  sincronizarBillingDoTenant,
  type UserBillingProfile,
} from "@/lib/hub/user-billing-cadastral";

export const MAX_MENSALIDADES_POR_TENANT = 12;

export const MENSALIDADE_SELECT =
  "id, tenant_id, competencia, valor_centavos, status, vencimento, pago_em, notas, cora_invoice_id, cora_boleto_url, cora_pix_emv, cora_meta, boleto_storage_path, boleto_arquivo_url, cora_status, cora_erro, parcela_numero, total_parcelas, whatsapp_enviado_em, whatsapp_telefone, whatsapp_envio_erro, criado_em";

export type TenantCobrancaContext = {
  id: string;
  nome_exibicao: string;
  cadastral: TenantEmpresaCadastral | null;
  billing: UserBillingProfile | null;
};

export function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

export function formatarCnpj(v: string | null | undefined) {
  const d = onlyDigits(v ?? "");
  if (d.length !== 14) return v ?? "";
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function resumoEnderecoCadastral(cad: TenantEmpresaCadastral | null): string | null {
  if (!cad) return null;
  const partes = [cad.logradouro, cad.numero, cad.bairro, cad.cidade, cad.estado].filter(Boolean);
  return partes.length ? partes.join(", ") : null;
}

/** Cadastro mínimo para cobrança (CPF/CNPJ + endereço). */
export function cadastroProntoParaCobranca(
  billing: UserBillingProfile | null,
  cad?: TenantEmpresaCadastral | null
): boolean {
  if (billing && documentoProntoParaCora(billing.document, billing.document_type)) {
    return true;
  }
  if (cad) return onlyDigits(cad.cnpj).length >= 14;
  return false;
}

/** @deprecated alias — use cadastroProntoParaCobranca */
export const cadastroProntoParaCora = cadastroProntoParaCobranca;

export type CobrancaEmissaoCheck = {
  bloqueado: boolean;
  motivo: string | null;
  emissor_configurado: boolean;
  emissor_cnpj: string | null;
  emissor_nome: string | null;
  cliente_documento: string | null;
};

/** Valida documento do cliente; emissão via API externa descontinuada (Cora). */
export function avaliarEmissaoCobrancaTenant(
  clienteDocumento: string | null | undefined,
  _tipo: "CPF" | "CNPJ" = "CNPJ"
): CobrancaEmissaoCheck {
  const cliente = onlyDigits(clienteDocumento ?? "").slice(0, 14);
  return {
    bloqueado: false,
    motivo: null,
    emissor_configurado: false,
    emissor_cnpj: null,
    emissor_nome: null,
    cliente_documento: cliente.length >= 11 ? cliente : null,
  };
}

/** @deprecated alias */
export const avaliarEmissaoCoraTenant = avaliarEmissaoCobrancaTenant;

export async function carregarTenantParaCobranca(tenantId: string): Promise<TenantCobrancaContext> {
  const db = crmDb();
  const { data: tenant, error } = await db
    .from("hub_tenants")
    .select("id, nome_exibicao, settings")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tenant) throw new Error("Tenant não encontrado.");

  const { cadastral } = await lerEmpresaCadastralTenant(db, tenantId);
  await sincronizarBillingDoTenant(db, tenantId, tenant.settings, tenant.nome_exibicao, cadastral);
  const billing = await resolverPerfilCobrancaTenant(
    db,
    tenantId,
    cadastral,
    tenant.nome_exibicao,
    tenant.settings
  );

  return {
    id: tenant.id,
    nome_exibicao: tenant.nome_exibicao,
    cadastral,
    billing,
  };
}

export function addMonthsIso(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1 + months, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function competenciaDoMes(dateStr: string, offsetMonths = 0): string {
  const iso = addMonthsIso(dateStr, offsetMonths);
  return `${iso.slice(0, 7)}-01`;
}

export async function contarMensalidadesTenant(tenantId: string): Promise<number> {
  const { count, error } = await crmDb()
    .from("hub_tenant_mensalidades")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type CriarMensalidadesParceladasInput = {
  valor_centavos: number;
  parcelas: number;
  primeiro_vencimento: string;
};

export type CriarMensalidadesParceladasResultado = {
  criadas: Array<Record<string, unknown>>;
  erros: Array<{ parcela: number; error: string }>;
};

/** Cria mensalidades no CRM sem emissão bancária (nova API de pagamentos em breve). */
export async function criarMensalidadesParceladas(
  tenantId: string,
  input: CriarMensalidadesParceladasInput
): Promise<CriarMensalidadesParceladasResultado> {
  const parcelas = Math.round(input.parcelas);
  if (parcelas < 1 || parcelas > MAX_MENSALIDADES_POR_TENANT) {
    throw new Error(`Parcelas deve ser entre 1 e ${MAX_MENSALIDADES_POR_TENANT}.`);
  }

  const valorCentavos = Math.round(input.valor_centavos);
  if (!Number.isFinite(valorCentavos) || valorCentavos < 500) {
    throw new Error("Valor mínimo por parcela é R$ 5,00.");
  }

  const primeiroVencimento = input.primeiro_vencimento?.slice(0, 10);
  if (!primeiroVencimento || Number.isNaN(new Date(primeiroVencimento).getTime())) {
    throw new Error("primeiro_vencimento inválido.");
  }

  const tenant = await carregarTenantParaCobranca(tenantId);
  if (!cadastroProntoParaCobranca(tenant.billing, tenant.cadastral)) {
    throw new Error(
      "Cadastro incompleto — CPF/CNPJ e endereço do cliente obrigatórios antes de criar mensalidades."
    );
  }

  const existentes = await contarMensalidadesTenant(tenantId);
  if (existentes + parcelas > MAX_MENSALIDADES_POR_TENANT) {
    throw new Error(
      `Limite de ${MAX_MENSALIDADES_POR_TENANT} mensalidades. Já existem ${existentes}; máximo ${MAX_MENSALIDADES_POR_TENANT - existentes} parcela(s) nova(s).`
    );
  }

  const criadas: Array<Record<string, unknown>> = [];
  const erros: Array<{ parcela: number; error: string }> = [];

  for (let i = 0; i < parcelas; i++) {
    const parcelaNum = i + 1;
    const vencimento = addMonthsIso(primeiroVencimento, i);
    const competencia = competenciaDoMes(primeiroVencimento, i);

    const { data: inserted, error: insErr } = await crmDb()
      .from("hub_tenant_mensalidades")
      .insert({
        tenant_id: tenantId,
        competencia,
        valor_centavos: valorCentavos,
        vencimento,
        status: "pendente",
        notas: `Parcela ${parcelaNum}/${parcelas}`,
        parcela_numero: parcelaNum,
        total_parcelas: parcelas,
        cora_status: "pendente_emissao",
      })
      .select(MENSALIDADE_SELECT)
      .single();

    if (insErr || !inserted) {
      erros.push({ parcela: parcelaNum, error: insErr?.message ?? "Falha ao criar mensalidade." });
      continue;
    }

    criadas.push({ ...inserted, valor_reais: (inserted.valor_centavos ?? 0) / 100 });
  }

  return { criadas, erros };
}

export { resumoEnderecoPerfilCobranca };
