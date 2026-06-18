import { crmDb } from "@/lib/crm/supabase-server";
import type { CoraEmitirBoletoInput } from "@/lib/cora/cora-client";
import { emitirCoraCobranca, type CoraFormaPagamento } from "@/lib/cora/cora-cobranca";
import { extrairPixEmvCora, extrairUrlBoletoCora } from "@/lib/cora/cora-client";
import { persistirBoletoPdf } from "@/lib/ops/ops-boleto-storage";
import {
  lerEmpresaCadastralTenant,
  nomeComercialEmpresa,
  type TenantEmpresaCadastral,
} from "@/lib/hub/tenant-empresa-cadastral";

export const MAX_MENSALIDADES_POR_TENANT = 12;

export const MENSALIDADE_SELECT =
  "id, tenant_id, competencia, valor_centavos, status, vencimento, pago_em, notas, cora_invoice_id, cora_boleto_url, cora_pix_emv, cora_meta, boleto_storage_path, boleto_arquivo_url, cora_status, cora_erro, parcela_numero, total_parcelas, whatsapp_enviado_em, whatsapp_telefone, whatsapp_envio_erro, criado_em";

export type TenantCobrancaContext = {
  id: string;
  nome_exibicao: string;
  cadastral: TenantEmpresaCadastral | null;
};

export type MensalidadeDbRow = {
  id: string;
  tenant_id: string;
  competencia: string;
  valor_centavos: number;
  status: string;
  vencimento: string | null;
  cora_invoice_id?: string | null;
};

export function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

export function formatarCnpj(v: string | null | undefined) {
  const d = onlyDigits(v ?? "");
  if (d.length !== 14) return v ?? "";
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function enderecoFromCadastral(cad: TenantEmpresaCadastral | null) {
  const fallback = {
    street: "Não informado",
    number: "S/N",
    district: "Centro",
    city: "São Paulo",
    state: "SP",
    complement: "N/A",
    zip_code: "01000000",
  };
  if (!cad) return fallback;
  return {
    street: (cad.logradouro || fallback.street).slice(0, 80),
    number: (cad.numero || fallback.number).slice(0, 12),
    district: (cad.bairro || fallback.district).slice(0, 60),
    city: (cad.cidade || fallback.city).slice(0, 60),
    state: (cad.estado || fallback.state).slice(0, 2).toUpperCase(),
    complement: (cad.complemento || "N/A").slice(0, 40),
    zip_code: onlyDigits(cad.cep || fallback.zip_code).padStart(8, "0").slice(0, 8),
  };
}

export function resumoEnderecoCadastral(cad: TenantEmpresaCadastral | null): string | null {
  if (!cad) return null;
  const partes = [
    cad.logradouro,
    cad.numero,
    cad.bairro,
    cad.cidade,
    cad.estado,
  ].filter(Boolean);
  return partes.length ? partes.join(", ") : null;
}

export function cadastroProntoParaCora(cad: TenantEmpresaCadastral | null): boolean {
  if (!cad) return false;
  return onlyDigits(cad.cnpj).length >= 14;
}

export async function carregarTenantParaCobranca(tenantId: string): Promise<TenantCobrancaContext> {
  const { data: tenant, error } = await crmDb()
    .from("hub_tenants")
    .select("id, nome_exibicao")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tenant) throw new Error("Tenant não encontrado.");

  const { cadastral } = await lerEmpresaCadastralTenant(crmDb(), tenantId);
  return {
    id: tenant.id,
    nome_exibicao: tenant.nome_exibicao,
    cadastral,
  };
}

export function montarInputCora(
  tenant: TenantCobrancaContext,
  pag: { id: string; competencia: string; valor_centavos: number; vencimento: string | null; parcela?: number; total_parcelas?: number },
): CoraEmitirBoletoInput {
  const cad = tenant.cadastral;
  const cnpj = onlyDigits(cad?.cnpj ?? "");
  if (cnpj.length < 14) {
    throw new Error("Tenant sem CNPJ no cadastro — complete o cadastro PJ antes de emitir na Cora.");
  }

  const valorCentavos = pag.valor_centavos ?? 0;
  if (valorCentavos < 500) {
    throw new Error("Valor mínimo da cobrança Cora é R$ 5,00.");
  }

  const dueDate =
    pag.vencimento?.slice(0, 10) ??
    new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const competenciaLabel = pag.competencia?.slice(0, 7) ?? "";
  const parcelaLabel =
    pag.parcela && pag.total_parcelas
      ? ` · parcela ${pag.parcela}/${pag.total_parcelas}`
      : "";

  const nomeCliente = nomeComercialEmpresa(cad, tenant.nome_exibicao).slice(0, 60) || tenant.nome_exibicao.slice(0, 60);
  const email = (cad?.email?.trim() || "financeiro@waje.com.br").slice(0, 60);

  return {
    code: `waje-mensalidade-${pag.id}`,
    customer: {
      name: nomeCliente,
      email,
      document: { identity: cnpj, type: "CNPJ" },
      address: enderecoFromCadastral(cad),
    },
    services: [
      {
        name: "Plano Waje",
        description: `Mensalidade ${competenciaLabel}${parcelaLabel}`,
        amount: valorCentavos,
      },
    ],
    payment_terms: { due_date: dueDate },
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

export async function emitirMensalidadeNaCora(
  pag: MensalidadeDbRow,
  forma: CoraFormaPagamento,
  tenantCtx?: TenantCobrancaContext,
  meta?: { parcela?: number; total_parcelas?: number },
) {
  if (pag.cora_invoice_id) {
    throw new Error("Cobrança Cora já emitida para esta mensalidade.");
  }

  const tenant = tenantCtx ?? (await carregarTenantParaCobranca(pag.tenant_id));
  const input = montarInputCora(tenant, { ...pag, ...meta });
  const invoice = await emitirCoraCobranca(input, forma);

  const boletoUrl =
    (invoice as { document_url?: string }).document_url ?? invoice.bank_slip?.url ?? null;
  const pixEmv = invoice.pix?.emv ?? null;

  let boletoStoragePath: string | null = null;
  let boletoArquivoUrl: string | null = null;
  if (boletoUrl) {
    try {
      const persisted = await persistirBoletoPdf(pag.tenant_id, pag.id, boletoUrl);
      if (persisted) {
        boletoStoragePath = persisted.storagePath;
        boletoArquivoUrl = persisted.publicUrl;
      }
    } catch (e) {
      console.warn("[ops/cora] falha ao persistir PDF no bucket:", e);
    }
  }

  const { data: updated, error: upErr } = await crmDb()
    .from("hub_tenant_mensalidades")
    .update({
      cora_invoice_id: invoice.id,
      cora_boleto_url: boletoUrl,
      cora_pix_emv: pixEmv,
      boleto_storage_path: boletoStoragePath,
      boleto_arquivo_url: boletoArquivoUrl,
      cora_status: "emitido",
      cora_erro: null,
      parcela_numero: meta?.parcela ?? null,
      total_parcelas: meta?.total_parcelas ?? null,
      cora_meta: {
        status: invoice.status,
        forma,
        emitted_at: new Date().toISOString(),
        parcela: meta?.parcela ?? null,
        total_parcelas: meta?.total_parcelas ?? null,
        cora_invoice_id: invoice.id,
      },
    })
    .eq("id", pag.id)
    .select(MENSALIDADE_SELECT)
    .single();

  if (upErr) {
    throw new Error(upErr.message);
  }

  if (!updated?.cora_invoice_id) {
    throw new Error("Cora não confirmou emissão — invoice_id ausente.");
  }

  return { ...updated, valor_reais: (updated.valor_centavos ?? 0) / 100 };
}

export type GerarBoletosInput = {
  valor_centavos: number;
  parcelas: number;
  primeiro_vencimento: string;
  forma?: CoraFormaPagamento;
};

export type GerarBoletosResultado = {
  criadas: Array<Record<string, unknown>>;
  erros: Array<{ parcela: number; error: string }>;
};

export async function gerarBoletosParcelados(
  tenantId: string,
  input: GerarBoletosInput,
): Promise<GerarBoletosResultado> {
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

  const existentes = await contarMensalidadesTenant(tenantId);
  if (existentes + parcelas > MAX_MENSALIDADES_POR_TENANT) {
    throw new Error(
      `Limite de ${MAX_MENSALIDADES_POR_TENANT} mensalidades. Já existem ${existentes}; máximo ${MAX_MENSALIDADES_POR_TENANT - existentes} parcela(s) nova(s).`,
    );
  }

  const tenant = await carregarTenantParaCobranca(tenantId);
  if (!cadastroProntoParaCora(tenant.cadastral)) {
    throw new Error("Cadastro PJ incompleto — CNPJ obrigatório para emitir na Cora.");
  }

  const forma: CoraFormaPagamento = input.forma ?? "boleto_pix";
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
      .select("id, tenant_id, competencia, valor_centavos, status, vencimento, cora_invoice_id")
      .single();

    if (insErr || !inserted) {
      erros.push({ parcela: parcelaNum, error: insErr?.message ?? "Falha ao criar mensalidade." });
      continue;
    }

    try {
      const emitida = await emitirMensalidadeNaCora(
        inserted as MensalidadeDbRow,
        forma,
        tenant,
        { parcela: parcelaNum, total_parcelas: parcelas },
      );
      criadas.push(emitida);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao emitir na Cora.";
      await crmDb()
        .from("hub_tenant_mensalidades")
        .delete()
        .eq("id", inserted.id);
      erros.push({ parcela: parcelaNum, error: msg });
    }
  }

  return { criadas, erros };
}
