/** Valores e patch seguro para `hub_atualizar_lead` (alinhado a CHECKs em hub_leads_crm). */

export const HUB_LEADS_CRM_ESTAGIOS = [
  "novo",
  "em_atendimento",
  "aguardando_resposta",
  "qualificando",
  "encaminhado",
  "convertido_negocio",
  "perdido",
  "spam_invalido",
  /** Legado (compatibilidade) */
  "qualificado",
  "proposta",
  "negociando",
  "fechamento",
  "ganho",
] as const;

export type HubLeadsCrmEstagio = (typeof HUB_LEADS_CRM_ESTAGIOS)[number];

/** Estágios que exigem confirmação humana no CRM — a IA não pode definir via tool. */
export const HUB_LEADS_CRM_ESTAGIOS_BLOQUEADOS_IA: ReadonlySet<string> = new Set([
  "ganho",
  "perdido",
  "convertido_negocio",
  "spam_invalido",
]);

export type BuildLeadPatchResult =
  | { ok: true; patch: Record<string, unknown>; estagioAnterior?: string; estagioNovo?: string }
  | { ok: false; erro: string; codigo?: string };

function normStr(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

function normTags(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "").trim()))
    .filter((s) => s.length > 0)
    .slice(0, 20)
    .map((s) => s.slice(0, 80));
  return out.length > 0 ? out : undefined;
}

function mergeJsonObject(
  existing: unknown,
  patch: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!patch || Object.keys(patch).length === 0) return undefined;
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  for (const [k, val] of Object.entries(patch)) {
    if (val === null || val === undefined) continue;
    base[k] = val;
  }
  return base;
}

/** Monta PATCH para Supabase; não inclui campos vazios. */
export function buildHubLeadsCrmPatch(
  args: Record<string, unknown>,
  leadAtual: Record<string, unknown> | null
): BuildLeadPatchResult {
  const patch: Record<string, unknown> = {};
  let estagioAnterior: string | undefined;
  let estagioNovo: string | undefined;

  const est = normStr(args.estagio, 40)?.toLowerCase();
  if (est) {
    if (!HUB_LEADS_CRM_ESTAGIOS.includes(est as HubLeadsCrmEstagio)) {
      return { ok: false, erro: "estagio_invalido", codigo: "estagio_invalido" };
    }
    if (HUB_LEADS_CRM_ESTAGIOS_BLOQUEADOS_IA.has(est)) {
      return {
        ok: false,
        erro: `estagio_${est}_requer_humano`,
        codigo: "estagio_bloqueado_ia",
      };
    }
    estagioAnterior =
      leadAtual && typeof leadAtual.estagio === "string" ? leadAtual.estagio : undefined;
    estagioNovo = est;
    patch.estagio = est;
  }

  if (args.score !== undefined && args.score !== null) {
    const n = typeof args.score === "number" ? args.score : Number(args.score);
    if (!Number.isFinite(n)) return { ok: false, erro: "score_invalido", codigo: "score_invalido" };
    patch.score = Math.min(100, Math.max(0, Math.floor(n)));
  }

  if (args.valor_estimado !== undefined && args.valor_estimado !== null) {
    const n = typeof args.valor_estimado === "number" ? args.valor_estimado : Number(args.valor_estimado);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, erro: "valor_estimado_invalido", codigo: "valor_estimado_invalido" };
    }
    patch.valor_estimado = Math.round(n * 100) / 100;
  }

  const nome = normStr(args.nome, 240);
  if (nome) patch.nome = nome;

  const email = normStr(args.email, 320);
  if (email) patch.email = email;

  const interesse = normStr(args.interesse_principal, 500);
  if (interesse) patch.interesse_principal = interesse;

  const prox = normStr(args.proxima_acao, 500);
  if (prox) patch.proxima_acao = prox;

  const dataProx = normStr(args.data_proxima_acao, 64);
  if (dataProx) {
    const d = new Date(dataProx);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, erro: "data_proxima_acao_invalida", codigo: "data_proxima_acao_invalida" };
    }
    patch.data_proxima_acao = d.toISOString();
  }

  const motivo = normStr(args.motivo_perda, 500);
  if (motivo) patch.motivo_perda = motivo;

  const humor = normStr(args.humor, 40);
  if (humor) patch.humor = humor;

  const cpf = normStr(args.cpf, 20);
  if (cpf) patch.cpf = cpf.replace(/\D/g, "").slice(0, 14);

  const end = normStr(args.endereco_completo, 800);
  if (end) patch.endereco_completo = end;

  const tagsAdd = normTags(args.tags_adicionar);
  if (tagsAdd) {
    const prev = Array.isArray(leadAtual?.tags)
      ? (leadAtual!.tags as unknown[]).map((t) => String(t).trim()).filter(Boolean)
      : [];
    const merged = [...new Set([...prev, ...tagsAdd])].slice(0, 30);
    patch.tags = merged;
  }

  const metaPatch =
    args.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata)
      ? (args.metadata as Record<string, unknown>)
      : undefined;
  const metaMerged = mergeJsonObject(leadAtual?.metadata, metaPatch);
  if (metaMerged) patch.metadata = metaMerged;

  const prefPatch =
    args.preferencias && typeof args.preferencias === "object" && !Array.isArray(args.preferencias)
      ? (args.preferencias as Record<string, unknown>)
      : undefined;
  const prefMerged = mergeJsonObject(leadAtual?.preferencias, prefPatch);
  if (prefMerged) patch.preferencias = prefMerged;

  if (Object.keys(patch).length === 0) {
    return { ok: false, erro: "nenhum_campo_para_atualizar", codigo: "patch_vazio" };
  }

  patch.atualizado_em = new Date().toISOString();
  patch.ultimo_contato = new Date().toISOString();

  return { ok: true, patch, estagioAnterior, estagioNovo };
}
