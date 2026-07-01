/**
 * Smoke integração: harness modo operar + lead real + Mistral.
 * Corre com: npm run smoke:harness-copiloto
 * Requer .env.local: SUPABASE_*, MISTRAL_API_KEY, DEFAULT_TENANT_ID
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { runHarnessHost } from "@/lib/harness/host";
import {
  getOrCreateHarnessSession,
  updateHarnessSessionModo,
} from "@/lib/harness/stores/session-store";
import { montarSystemPromptHarness } from "@/lib/harness/build-system-prompt";
import { toolsetsActivos } from "@/lib/harness/toolsets";
import { mergeUsoFerramentasPorModoOperacao } from "@/lib/hub/agente-ferramentas-registry";

function loadEnvLocal() {
  const root = resolve(__dirname, "../..");
  for (const name of [".env.local", ".env"]) {
    const p = resolve(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnvLocal();

if (!process.env.STRICT_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const mistralKey = process.env.MISTRAL_API_KEY?.trim();
const tenantId =
  process.env.DEFAULT_TENANT_ID?.trim() ||
  process.env.NEXT_PUBLIC_TENANT_ID?.trim() ||
  "";

const agenteSlugEnv = process.env.SMOKE_HARNESS_AGENTE_SLUG?.trim() || "";

const podeCorrer = Boolean(url && serviceKey && mistralKey);

describe.skipIf(!podeCorrer)("smoke copiloto harness — modo operar + lead", () => {
  const supabase = createClient(url!, serviceKey!);

  it("prompt Manus-style + consulta lead via runHarnessHost", async () => {
    let agente: Record<string, unknown> | null = null;
    let tenantEfectivo = tenantId;

    if (agenteSlugEnv) {
      const { data, error } = await supabase
        .from("hub_agente_identidade")
        .select(
          "agente_slug, nome, cargo, area, bio, modelo_padrao, system_prompt_base, modo_operacao, uso_ferramentas_ia, motor_ferramentas_habilitado, tenant_id"
        )
        .eq("agente_slug", agenteSlugEnv)
        .maybeSingle();
      expect(error).toBeNull();
      agente = data;
      if (data?.tenant_id) tenantEfectivo = String(data.tenant_id);
    }

    if (!agente) {
      let q = supabase
        .from("hub_agente_identidade")
        .select(
          "agente_slug, nome, cargo, area, bio, modelo_padrao, system_prompt_base, modo_operacao, uso_ferramentas_ia, motor_ferramentas_habilitado, tenant_id"
        )
        .eq("modo_operacao", "jobs_internos")
        .limit(10);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data: agentes, error: agErr } = await q;
      expect(agErr).toBeNull();
      agente =
        agentes?.find((a) => a.motor_ferramentas_habilitado !== false) ?? agentes?.[0] ?? null;
      if (agente?.tenant_id) tenantEfectivo = String(agente.tenant_id);
    }

    if (!agente) {
      const { data: fallback, error: fbErr } = await supabase
        .from("hub_agente_identidade")
        .select(
          "agente_slug, nome, cargo, area, bio, modelo_padrao, system_prompt_base, modo_operacao, uso_ferramentas_ia, motor_ferramentas_habilitado, tenant_id"
        )
        .eq("modo_operacao", "jobs_internos")
        .limit(5);
      expect(fbErr).toBeNull();
      agente = fallback?.[0] ?? null;
      if (agente?.tenant_id) tenantEfectivo = String(agente.tenant_id);
    }

    expect(agente, "Nenhum agente jobs_internos na base — defina SMOKE_HARNESS_AGENTE_SLUG").toBeTruthy();

    const slug = agente!.agente_slug as string;

    let leadQuery = supabase
      .from("hub_leads_crm")
      .select("id, nome, estagio")
      .order("criado_em", { ascending: false })
      .limit(1);
    if (tenantEfectivo) leadQuery = leadQuery.eq("tenant_id", tenantEfectivo);
    const { data: leads, error: leadErr } = await leadQuery;

    expect(leadErr).toBeNull();

    const lead = leads?.[0];
    const mensagem = lead?.nome
      ? `Modo operar: consulta o lead "${lead.nome}" (id ${lead.id}) com hub_int_crm_ent_lead e diz-me o estágio actual. Usa tool no mesmo turno.`
      : "Modo operar: quantos leads existem no CRM? Usa hub_int_crm_ent_lead com acao=consultar no mesmo turno.";

    const usoMap = mergeUsoFerramentasPorModoOperacao(
      (agente!.uso_ferramentas_ia as Record<string, boolean>) ?? {},
      "jobs_internos"
    );
    const toolsetsIds = toolsetsActivos(usoMap).map((t) => t.id);

    const promptPreview = montarSystemPromptHarness({
      agenteNome: agente!.nome as string,
      agenteSlug: slug,
      cargo: (agente!.cargo as string) ?? undefined,
      canalInterno: "copiloto_crm",
      toolsetsAtivos: toolsetsIds,
    });
    expect(promptPreview).toContain("<waje_intro>");
    expect(promptPreview).toContain("<system_capability>");

    const sessao = await getOrCreateHarnessSession(supabase, {
      tenantId: tenantEfectivo,
      agenteSlug: slug,
      surface: "copiloto_crm",
      resourceId: "smoke-harness-qa",
      modoId: "operar",
    });
    expect(sessao?.id).toBeTruthy();
    if (sessao?.id) {
      await updateHarnessSessionModo(supabase, sessao.id, "operar");
    }

    console.log("\n[smoke] agente:", slug, "| lead:", lead?.nome ?? "(nenhum)");

    const resultado = await runHarnessHost({
      supabase,
      modelo: (agente!.modelo_padrao as string) || "mistral-small-latest",
      agenteNome: agente!.nome as string,
      agenteSlug: slug,
      tenantId: tenantEfectivo,
      cargo: (agente!.cargo as string) ?? undefined,
      area: (agente!.area as string) ?? undefined,
      bio: (agente!.bio as string) ?? undefined,
      promptBaseTrecho: (agente!.system_prompt_base as string) ?? undefined,
      historico: [],
      mensagemUsuario: mensagem,
      trigger: "copiloto",
      canalInterno: "copiloto_crm",
      usuarioCrmId: "smoke-harness-qa",
    });

    expect(resultado.texto?.trim().length).toBeGreaterThan(0);
    expect(resultado.harness_version).toBe("0.3.0");

    const textoLower = resultado.texto.toLowerCase();
    expect(
      textoLower.includes("column hub_leads_crm") ||
        textoLower.includes("does not exist") ||
        textoLower.includes("erro técnico"),
      `Resposta indica falha de schema/tool — aplicar ensure_hub_leads_crm_interesse_principal.sql no Supabase.\nTrecho: ${resultado.texto.slice(0, 400)}`
    ).toBe(false);

    const texto = textoLower;
    if (lead?.estagio) {
      const estagio = String(lead.estagio).toLowerCase();
      const mencionaLead =
        texto.includes(lead.nome!.toLowerCase()) ||
        texto.includes(estagio) ||
        texto.includes("lead");
      expect(mencionaLead).toBe(true);
    } else {
      expect(texto.length).toBeGreaterThan(10);
    }

    console.log("[smoke] resposta (trecho):", resultado.texto.slice(0, 280));
    console.log("[smoke] tokens:", resultado.tokens_input, "/", resultado.tokens_output);
    if (resultado.pending_approvals?.length) {
      console.log("[smoke] aprovações pendentes:", resultado.pending_approvals.length);
    }
  }, 120_000);
});

describe("smoke copiloto harness — pré-requisitos", () => {
  it("documenta SKIP quando env ausente", () => {
    if (podeCorrer) {
      expect(podeCorrer).toBe(true);
      return;
    }
    console.log(
      "SKIP integração LLM: falta NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MISTRAL_API_KEY ou DEFAULT_TENANT_ID"
    );
    expect(true).toBe(true);
  });
});
