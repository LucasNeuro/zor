import { crmDb } from "@/lib/crm/supabase-server";
import { lerEmpresaCadastralTenant } from "@/lib/hub/tenant-empresa-cadastral";
import {
  carregarUsuarioCobrancaTenant,
  onlyDigits,
  perfilCobrancaFromTenantCadastral,
  perfilCobrancaFromTenantSettings,
  perfilCobrancaFromUserRow,
  resolverPerfilCobrancaTenant,
} from "@/lib/hub/user-billing-cadastral";
import { montarInputCora, formatarCnpj } from "@/lib/ops/cora-mensalidade";
import { coraConfigurado, getCoraConfig } from "@/lib/cora/cora-config";
import {
  avaliarEmissaoCoraTenant,
  cnpjMesmoEmissorCora,
  getCoraEmissorCnpj,
  getCoraEmissorNome,
  mensagemCoraEmissorAusente,
} from "@/lib/cora/cora-emissor";
import { obterCoraAccessToken } from "@/lib/cora/cora-client";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fmtDoc(doc: string | null | undefined, tipo?: string | null): string | null {
  const d = onlyDigits(doc ?? "");
  if (!d) return null;
  if (tipo === "CPF" && d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  if (d.length === 14) return formatarCnpj(d) || d;
  return d;
}

export type CoraDiagnosticoTenant = {
  tenant_id: string;
  cora_configurada: boolean;
  cora_emissor_cnpj_env: string | null;
  cora_emissor_nome_env: string | null;
  cora_client_id: string | null;
  cora_ambiente: string | null;
  token_ok: boolean;
  token_client_id: string | null;
  token_erro: string | null;
  fontes: {
    users: { documento: string | null; documento_fmt: string | null; email: string | null; role: string | null; owner: boolean | null } | null;
    settings: { documento: string | null; documento_fmt: string | null } | null;
    cadastral: { documento: string | null; documento_fmt: string | null } | null;
  };
  perfil_resolvido: {
    documento: string | null;
    documento_fmt: string | null;
    documento_tipo: string | null;
    legal_name: string | null;
    fonte: string | null;
  } | null;
  cora_check: ReturnType<typeof avaliarEmissaoCoraTenant>;
  payload_pagador: {
    name: string;
    email: string;
    document_identity: string;
    document_type: string;
  } | null;
  payload_erro: string | null;
  conclusao: string;
};

export async function diagnosticarCoraTenant(tenantId: string): Promise<CoraDiagnosticoTenant> {
  const db = crmDb();
  const { data: tenant, error } = await db
    .from("hub_tenants")
    .select("id, nome_exibicao, settings")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!tenant) throw new Error("Tenant não encontrado.");

  const { cadastral, nome_exibicao } = await lerEmpresaCadastralTenant(db, tenantId);
  const billingUser = await carregarUsuarioCobrancaTenant(db, tenantId, tenant.settings);
  const fromUser = perfilCobrancaFromUserRow(billingUser);
  const fromSettings = perfilCobrancaFromTenantSettings(tenant.settings, nome_exibicao);
  const fromCadastral = perfilCobrancaFromTenantCadastral(cadastral, nome_exibicao);
  const billing = await resolverPerfilCobrancaTenant(
    db,
    tenantId,
    cadastral,
    nome_exibicao,
    tenant.settings,
  );

  const emissorEnv = getCoraEmissorCnpj();
  const check = avaliarEmissaoCoraTenant(billing?.document ?? null, billing?.document_type ?? "CNPJ");

  let payload_pagador: CoraDiagnosticoTenant["payload_pagador"] = null;
  let payload_erro: string | null = null;

  if (billing) {
    try {
      const input = montarInputCora(
        {
          id: tenant.id,
          nome_exibicao: tenant.nome_exibicao,
          cadastral,
          billing,
        },
        {
          id: "diagnostico",
          competencia: "2099-01-01",
          valor_centavos: 500,
          vencimento: "2099-12-31",
        },
      );
      payload_pagador = {
        name: input.customer.name,
        email: input.customer.email,
        document_identity: input.customer.document.identity,
        document_type: input.customer.document.type,
      };
    } catch (e) {
      payload_erro = e instanceof Error ? e.message : String(e);
    }
  }

  let token_ok = false;
  let token_client_id: string | null = null;
  let token_erro: string | null = null;
  let cora_client_id: string | null = null;
  let cora_ambiente: string | null = null;

  if (coraConfigurado()) {
    try {
      const cfg = getCoraConfig();
      cora_client_id = cfg.clientId;
      cora_ambiente = cfg.env;
      const token = await obterCoraAccessToken();
      token_ok = Boolean(token);
      const payload = decodeJwtPayload(token);
      token_client_id =
        (typeof payload?.clientId === "string" && payload.clientId) ||
        (typeof payload?.azp === "string" && payload.azp) ||
        null;
    } catch (e) {
      token_erro = e instanceof Error ? e.message : String(e);
    }
  }

  const docEnviado = payload_pagador?.document_identity ?? billing?.document ?? null;
  const docFmt = fmtDoc(docEnviado, billing?.document_type);

  let conclusao: string;
  if (!coraConfigurado()) {
    conclusao = "Cora não configurada no servidor (certificado/client_id).";
  } else if (!emissorEnv) {
    conclusao = mensagemCoraEmissorAusente();
  } else if (!billing) {
    conclusao = "Cadastro de faturamento incompleto — preencha CNPJ do cliente no painel.";
  } else if (check.bloqueado || cnpjMesmoEmissorCora(docEnviado)) {
    conclusao = `O pagador resolvido (${docFmt ?? "?"}) é igual ao emissor configurado (${formatarCnpj(emissorEnv)}). Corrija o CNPJ no formulário de faturamento.`;
  } else if (!token_ok) {
    conclusao = `Credenciais Cora inválidas ou certificado errado: ${token_erro ?? "falha no token"}.`;
  } else if (payload_erro) {
    conclusao = `Payload bloqueado antes da Cora: ${payload_erro}`;
  } else {
    conclusao =
      `Pronto para emitir: pagador ${docFmt ?? "?"} → conta Cora ${getCoraEmissorNome()} (${formatarCnpj(emissorEnv)}). ` +
      `Se a Cora ainda recusar com "own identity", as credenciais (client_id ${cora_client_id ?? "?"}) ` +
      `não são da conta Onze — gere novo certificado na conta Cora correta.`;
  }

  return {
    tenant_id: tenantId,
    cora_configurada: coraConfigurado(),
    cora_emissor_cnpj_env: emissorEnv ? formatarCnpj(emissorEnv) : null,
    cora_emissor_nome_env: getCoraEmissorNome(),
    cora_client_id,
    cora_ambiente,
    token_ok,
    token_client_id,
    token_erro,
    fontes: {
      users: billingUser
        ? {
            documento: onlyDigits(billingUser.document) || null,
            documento_fmt: fmtDoc(billingUser.document, billingUser.document_type as string),
            email: billingUser.email ?? null,
            role: billingUser.role != null ? String(billingUser.role) : null,
            owner: billingUser.owner === true,
          }
        : null,
      settings: fromSettings
        ? {
            documento: fromSettings.document,
            documento_fmt: fmtDoc(fromSettings.document, fromSettings.document_type),
          }
        : null,
      cadastral: fromCadastral
        ? {
            documento: fromCadastral.document,
            documento_fmt: fmtDoc(fromCadastral.document, fromCadastral.document_type),
          }
        : null,
    },
    perfil_resolvido: billing
      ? {
          documento: billing.document,
          documento_fmt: fmtDoc(billing.document, billing.document_type),
          documento_tipo: billing.document_type,
          legal_name: billing.legal_name,
          fonte: billing.fonte,
        }
      : null,
    cora_check: check,
    payload_pagador,
    payload_erro,
    conclusao,
  };
}
