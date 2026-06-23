import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeUsoFerramentasWhatsappCanal } from "@/lib/hub/agente-ferramentas-registry";
import {
  CONHECIMENTO_TITULO_INSERT,
  isConhecimentoSecaoId,
  ordemConhecimentoSecao,
} from "@/lib/hub/conhecimento-secoes";
import {
  ensureHubCicloPadraoParaAgente,
  provisionFollowupCicloWhatsapp,
} from "@/lib/hub/provision-hub-ciclo-padrao";
import { provisionHubAgenteFollowupConfig } from "@/lib/hub/followup-db";
import { serializarUsoFerramentasParaDb } from "@/lib/mistral/sync-hub-agent";
import { ensureMarkdownWithWhatsappFlow } from "@/lib/playbook/playbook-flow-template";
import {
  loadCurrentPlaybookMarkdown,
  savePlaybookMarkdownForAgent,
} from "@/lib/playbook/custom-playbook";
import { assessPlaybookFlowInMarkdown } from "@/lib/playbook/playbook-flow-ui";
import { loadPlaybookFlowTemplateMarkdown } from "@/lib/playbook/playbook-flow-template";
import { aplicarFluxoEmpresaAoMarkdown } from "@/lib/playbook/playbook-flow-from-context";
import { updateHubAgenteIdentidadeCompat } from "@/lib/hub/hub-agente-schema-compat";
import { defaultTenantId } from "@/lib/tenant-default";
import {
  CONHECIMENTO_PRESET,
  NUNCA_DIZER_PRESET,
  personalizarPlaybookTemplate,
  WA_PRESET_CARGO_SLUG,
  type WaPresetId,
} from "@/lib/hub/presets/wa-conversacao-preset-shared";

export type {
  WaPresetCreateHints,
  WaPresetId,
  WaPresetMeta,
} from "@/lib/hub/presets/wa-conversacao-preset-shared";
export {
  CONHECIMENTO_PRESET,
  isWaPresetId,
  NUNCA_DIZER_PRESET,
  personalizarPlaybookTemplate,
  WA_PRESET_CARGO_SLUG,
  WA_PRESET_IDS,
  WA_PRESETS_META,
  waPresetHintsParaCriacao,
} from "@/lib/hub/presets/wa-conversacao-preset-shared";

function mergeNuncaDizer(existing: unknown): string[] {
  const base = Array.isArray(existing)
    ? existing.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const set = new Set([...base, ...NUNCA_DIZER_PRESET]);
  return [...set];
}

export type ApplyWaPresetOptions = {
  presetId?: WaPresetId;
  /** Publica playbook template (ou só garante fluxo WA se já existir markdown). */
  publicarPlaybook?: boolean;
  /** Substitui playbook existente pelo template (default: só se agente não tem playbook). */
  forcarPlaybook?: boolean;
  /** Slug do cargo; default WA_PRESET_CARGO_SLUG. */
  cargoSlug?: string;
  /** Atualiza cargo/título do agente a partir do catálogo. */
  sincronizarCargo?: boolean;
};

export type ApplyWaPresetStep = {
  passo: string;
  ok: boolean;
  detalhe?: string;
};

export type ApplyWaPresetResult =
  | {
      ok: true;
      agente_slug: string;
      preset_id: WaPresetId;
      passos: ApplyWaPresetStep[];
      playbook_publicado: boolean;
      ciclo_followup_criado: boolean;
    }
  | { ok: false; error: string; passos?: ApplyWaPresetStep[] };

async function upsertConhecimentoPreset(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<ApplyWaPresetStep> {
  const { data: existentes } = await supabase
    .from("hub_agente_conhecimento")
    .select("secao, conteudo")
    .eq("agente_slug", agenteSlug);

  const porSecao = new Map(
    (existentes ?? []).map((r) => [String(r.secao), String(r.conteudo ?? "").trim()])
  );

  const rows: Array<Record<string, unknown>> = [];
  for (const [secao, conteudoPreset] of Object.entries(CONHECIMENTO_PRESET)) {
    if (!isConhecimentoSecaoId(secao) || !conteudoPreset?.trim()) continue;
    const atual = porSecao.get(secao) ?? "";
    if (atual.length > 0) continue;
    rows.push({
      agente_slug: agenteSlug,
      secao,
      titulo: CONHECIMENTO_TITULO_INSERT[secao],
      conteudo: conteudoPreset.trim(),
      ordem: ordemConhecimentoSecao(secao),
      ativo: true,
    });
  }

  if (rows.length === 0) {
    return { passo: "conhecimento", ok: true, detalhe: "Secções já preenchidas — nada a inserir." };
  }

  const { error } = await supabase.from("hub_agente_conhecimento").insert(rows);
  if (error) return { passo: "conhecimento", ok: false, detalhe: error.message };
  return { passo: "conhecimento", ok: true, detalhe: `${rows.length} secção(ões) inserida(s).` };
}

async function sincronizarCargoDoCatalogo(
  supabase: SupabaseClient,
  agenteSlug: string,
  cargoSlug: string
): Promise<ApplyWaPresetStep> {
  const { data: cat, error: catErr } = await supabase
    .from("hub_cargos_catalogo")
    .select("titulo, area, nivel, pode_fazer_padrao, nao_pode_fazer_padrao")
    .eq("slug", cargoSlug)
    .eq("ativo", true)
    .maybeSingle();

  if (catErr) return { passo: "cargo", ok: false, detalhe: catErr.message };
  if (!cat) {
    return {
      passo: "cargo",
      ok: false,
      detalhe: `Cargo "${cargoSlug}" não encontrado no catálogo. Execute a migração do preset.`,
    };
  }

  const patch: Record<string, unknown> = {
    cargo: cat.titulo,
    area: cat.area ?? "atendimento",
    nivel: typeof cat.nivel === "number" ? cat.nivel : 2,
    pode_fazer: Array.isArray(cat.pode_fazer_padrao) ? cat.pode_fazer_padrao : [],
    nao_pode_fazer: Array.isArray(cat.nao_pode_fazer_padrao) ? cat.nao_pode_fazer_padrao : [],
  };

  const { error } = await updateHubAgenteIdentidadeCompat(supabase, agenteSlug, patch);
  if (error) return { passo: "cargo", ok: false, detalhe: error.message };
  return { passo: "cargo", ok: true, detalhe: String(cat.titulo) };
}

/**
 * Aplica o preset universal de conversação WhatsApp a um agente existente.
 * Server-only — não importar em componentes client.
 */
export async function applyWaConversacaoPreset(
  supabase: SupabaseClient,
  agenteSlug: string,
  options: ApplyWaPresetOptions = {}
): Promise<ApplyWaPresetResult> {
  const presetId: WaPresetId = options.presetId ?? "conversacao_universal";
  const cargoSlug = (options.cargoSlug ?? WA_PRESET_CARGO_SLUG).trim();
  const passos: ApplyWaPresetStep[] = [];

  const { data: agente, error: agErr } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, nome, tenant_id, modo_operacao, playbook_object_path, playbook_public_url, nunca_dizer, uso_ferramentas_ia, motor_ferramentas_habilitado"
    )
    .eq("agente_slug", agenteSlug)
    .maybeSingle();

  if (agErr) return { ok: false, error: agErr.message, passos };
  if (!agente) return { ok: false, error: "Agente não encontrado.", passos };

  const nomeAgente = typeof agente.nome === "string" ? agente.nome.trim() : agenteSlug;
  const tenantId =
    (typeof agente.tenant_id === "string" && agente.tenant_id.trim()) || defaultTenantId();

  const usoMerged = mergeUsoFerramentasWhatsappCanal(
    (agente.uso_ferramentas_ia as Record<string, boolean> | null) ?? {},
    "canal_whatsapp"
  );

  const patchIdentidade: Record<string, unknown> = {
    modo_operacao: "canal_whatsapp",
    ciclo_execucao_padrao: "interacao",
    motor_ferramentas_habilitado: true,
    uso_ferramentas_ia: serializarUsoFerramentasParaDb(usoMerged),
    nunca_dizer: mergeNuncaDizer(agente.nunca_dizer),
  };

  const { error: patchErr } = await updateHubAgenteIdentidadeCompat(supabase, agenteSlug, patchIdentidade);
  passos.push({
    passo: "identidade_wa",
    ok: !patchErr,
    detalhe: patchErr?.message ?? "modo_operacao, ferramentas e regras aplicados.",
  });
  if (patchErr) return { ok: false, error: patchErr.message, passos };

  if (options.sincronizarCargo !== false) {
    passos.push(await sincronizarCargoDoCatalogo(supabase, agenteSlug, cargoSlug));
  }

  passos.push(await upsertConhecimentoPreset(supabase, agenteSlug));

  const temPlaybook =
    Boolean(String(agente.playbook_object_path ?? "").trim()) ||
    Boolean(String(agente.playbook_public_url ?? "").trim());
  const devePublicarPlaybook =
    options.forcarPlaybook === true ||
    options.publicarPlaybook === true ||
    (!temPlaybook && options.publicarPlaybook !== false);

  let playbookPublicado = false;

  if (devePublicarPlaybook) {
    try {
      const template = await loadPlaybookFlowTemplateMarkdown();
      const personalizado = personalizarPlaybookTemplate(template, nomeAgente);
      const narrativeSemFluxo = personalizado.replace(
        /\n---\n\n## Bloco de fluxo din[aá]mico[\s\S]*$/i,
        ""
      ).trimEnd();

      const fluxoEmpresa = await aplicarFluxoEmpresaAoMarkdown(
        supabase,
        agenteSlug,
        narrativeSemFluxo
      );

      let markdownFinal: string;
      let detalheFluxo: string;

      if (fluxoEmpresa.ok) {
        markdownFinal = fluxoEmpresa.markdown;
        detalheFluxo = `Playbook com fluxo contextual (${fluxoEmpresa.resumo.empresa_label}; triagem: ${fluxoEmpresa.resumo.opcoes_triagem.slice(0, 3).join(", ")}).`;
      } else {
        const ensured = await ensureMarkdownWithWhatsappFlow(personalizado);
        if (!ensured.ok) {
          passos.push({
            passo: "playbook",
            ok: false,
            detalhe: ensured.errors.join("; "),
          });
          return { ok: false, error: "Falha ao validar playbook do preset.", passos };
        }
        markdownFinal = ensured.markdown;
        detalheFluxo = ensured.auto_appended_flow
          ? "Template publicado (fluxo genérico — cadastre conhecimento para fluxo da empresa)."
          : "Template Waje v1 publicado com fluxo WA.";
      }

      const saved = await savePlaybookMarkdownForAgent(supabase, agenteSlug, markdownFinal);
      if (!saved.ok) {
        passos.push({ passo: "playbook", ok: false, detalhe: saved.error });
        return { ok: false, error: saved.error, passos };
      }

      playbookPublicado = true;
      passos.push({
        passo: "playbook",
        ok: true,
        detalhe: detalheFluxo,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      passos.push({ passo: "playbook", ok: false, detalhe: msg });
      return { ok: false, error: msg, passos };
    }
  } else {
    const loaded = await loadCurrentPlaybookMarkdown(supabase, agenteSlug);
    if (!loaded.ok) {
      passos.push({
        passo: "playbook",
        ok: true,
        detalhe: "Playbook referenciado mas não legível — use «Gerar fluxo da empresa» no CRM.",
      });
    } else {
      const fluxoAtual = assessPlaybookFlowInMarkdown(loaded.markdown);
      if (fluxoAtual.kind === "ready") {
        passos.push({
          passo: "playbook",
          ok: true,
          detalhe: "Texto narrativo preservado — fluxo WA já válido.",
        });
      } else {
        const fluxoEmpresa = await aplicarFluxoEmpresaAoMarkdown(supabase, agenteSlug, loaded.markdown);
        if (!fluxoEmpresa.ok) {
          const ensured = await ensureMarkdownWithWhatsappFlow(loaded.markdown);
          if (!ensured.ok) {
            passos.push({
              passo: "playbook",
              ok: false,
              detalhe: ensured.errors.join("; "),
            });
            return {
              ok: false,
              error: "Não foi possível acrescentar fluxo WA ao playbook existente.",
              passos,
            };
          }
          const saved = await savePlaybookMarkdownForAgent(supabase, agenteSlug, ensured.markdown);
          if (!saved.ok) {
            passos.push({ passo: "playbook", ok: false, detalhe: saved.error });
            return { ok: false, error: saved.error, passos };
          }
          playbookPublicado = true;
          passos.push({
            passo: "playbook",
            ok: true,
            detalhe: ensured.auto_appended_flow
              ? "Bloco waje_playbook_flow acrescentado (template genérico — enriqueça a base de conhecimento)."
              : "Playbook existente validado e republicado com fluxo WA.",
          });
        } else {
          const saved = await savePlaybookMarkdownForAgent(supabase, agenteSlug, fluxoEmpresa.markdown);
          if (!saved.ok) {
            passos.push({ passo: "playbook", ok: false, detalhe: saved.error });
            return { ok: false, error: saved.error, passos };
          }
          playbookPublicado = true;
          passos.push({
            passo: "playbook",
            ok: true,
            detalhe: `Fluxo contextual da empresa anexado (${fluxoEmpresa.resumo.opcoes_triagem.slice(0, 2).join(", ")}…).`,
          });
        }
      }
    }
  }

  const cicloGatilho = await ensureHubCicloPadraoParaAgente(supabase, agenteSlug);
  passos.push({
    passo: "ciclo_gatilho",
    ok: !cicloGatilho.erro,
    detalhe:
      cicloGatilho.erro ??
      (cicloGatilho.provisionado ? "Ciclo «Sob interação» criado." : "Ciclo gatilho já existia."),
  });
  if (cicloGatilho.erro) {
    return { ok: false, error: cicloGatilho.erro, passos };
  }

  const followup = await provisionFollowupCicloWhatsapp(supabase, agenteSlug, nomeAgente, tenantId);
  passos.push({
    passo: "ciclo_followup",
    ok: !followup.erro,
    detalhe:
      followup.erro ??
      (followup.criado
        ? "Ciclo follow-up (telemetria) criado."
        : "Ciclo follow-up já existia."),
  });
  if (followup.erro) {
    return { ok: false, error: followup.erro, passos };
  }

  const followupCfg = await provisionHubAgenteFollowupConfig(supabase, agenteSlug, tenantId);
  passos.push({
    passo: "followup_config",
    ok: !followupCfg.erro,
    detalhe:
      followupCfg.erro ??
      (followupCfg.criado
        ? "Config follow-up: 3 passos padrão (desligado)."
        : "Config follow-up já existia."),
  });
  if (followupCfg.erro) {
    return { ok: false, error: followupCfg.erro, passos };
  }

  return {
    ok: true,
    agente_slug: agenteSlug,
    preset_id: presetId,
    passos,
    playbook_publicado: playbookPublicado,
    ciclo_followup_criado: followup.criado,
  };
}
