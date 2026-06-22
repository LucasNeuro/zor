import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse, after } from "next/server";
import { runPlaybookPipeline } from "@/lib/playbook/orchestrate";
import { deleteAgenteHubCompleto } from "@/lib/hub/delete-agente-completo";
import {
  serializarUsoFerramentasParaDb,
  syncHubAgenteParaMistral,
} from "@/lib/mistral/sync-hub-agent";
import { sanitizarAgenteHubParaCliente } from "@/lib/hub/sanitize-agente-hub-public";
import { mensagemErroHubAgente } from "@/lib/hub/agente-hub-errors";
import {
  selectHubAgenteIdentidadeCompat,
  updateHubAgenteIdentidadeCompat,
} from "@/lib/hub/hub-agente-schema-compat";
import {
  EMAIL_CHANNEL_DISABLED_CODE,
  EMAIL_CHANNEL_DISABLED_MESSAGE,
  isEmailChannelEnabled,
} from "@/lib/feature-flags";

function erroAgenteJson(message: string, status: number) {
  return NextResponse.json({ error: mensagemErroHubAgente(message) }, { status });
}

function parseBoolPatch(v: unknown): boolean | undefined {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return undefined;
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select("*")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  const out = { ...(data as Record<string, unknown>) };
  const bio = typeof out.bio === "string" ? out.bio.trim() : "";
  const spb = typeof out.system_prompt_base === "string" ? out.system_prompt_base.trim() : "";
  if (!bio || !spb) {
    const cargoTitulo = typeof out.cargo === "string" ? out.cargo.trim() : "";
    if (cargoTitulo) {
      const { resolverCargoCatalogoParaAgente } = await import("@/lib/hub/resolver-cargo-catalogo");
      const catBasico = await resolverCargoCatalogoParaAgente(supabase, cargoTitulo);
      const { data: cat } = catBasico
        ? await supabase
            .from("hub_cargos_catalogo")
            .select("descricao_curta,saudacao_cliente,prompt_template,descricao")
            .eq("slug", catBasico.slug)
            .eq("ativo", true)
            .limit(1)
            .maybeSingle()
        : { data: null };
      if (cat) {
        const descCurta = typeof cat.descricao_curta === "string" ? cat.descricao_curta.trim() : "";
        const saudacao = typeof cat.saudacao_cliente === "string" ? cat.saudacao_cliente.trim() : "";
        const promptTemplate = typeof cat.prompt_template === "string" ? cat.prompt_template.trim() : "";
        const descricao = typeof cat.descricao === "string" ? cat.descricao.trim() : "";
        if (!out.bio || !String(out.bio).trim()) {
          out.bio =
            (descCurta || saudacao || `Atendimento orientado pelo cargo ${cargoTitulo}.`).slice(0, 200);
        }
        if (!out.system_prompt_base || !String(out.system_prompt_base).trim()) {
          out.system_prompt_base =
            promptTemplate ||
            descricao ||
            `Agente em atendimento externo. Use o cargo ${cargoTitulo} como guia interno de operação.`;
        }
      }
    }
  }

  return NextResponse.json(sanitizarAgenteHubParaCliente(out));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const allowed = [
    "nome",
    "prefixo_mercado",
    "personalidade",
    "horario_inicio",
    "horario_fim",
    "dias_semana",
    "bio",
    "tom_voz",
    "estilo_comunicacao",
    "system_prompt_base",
    "avatar_url",
    "ativo",
    "modo_operacao",
    "ciclo_execucao_padrao",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if ("motor_ferramentas_habilitado" in body) {
    const v = parseBoolPatch(body.motor_ferramentas_habilitado);
    if (v !== undefined) patch.motor_ferramentas_habilitado = v;
  }
  if ("mistral_agent_sync_habilitado" in body) {
    const v = parseBoolPatch(body.mistral_agent_sync_habilitado);
    if (v !== undefined) patch.mistral_agent_sync_habilitado = v;
  }
  if ("uso_ferramentas_ia" in body && body.uso_ferramentas_ia !== undefined) {
    patch.uso_ferramentas_ia = serializarUsoFerramentasParaDb(body.uso_ferramentas_ia);
  }

  if (patch.modo_operacao === "canal_email" && !isEmailChannelEnabled()) {
    return NextResponse.json(
      { error: EMAIL_CHANNEL_DISABLED_MESSAGE, code: EMAIL_CHANNEL_DISABLED_CODE },
      { status: 403 }
    );
  }

  const syncTriggers = [
    "motor_ferramentas_habilitado",
    "mistral_agent_sync_habilitado",
    "uso_ferramentas_ia",
    "system_prompt_base",
  ] as const;

  const patchAfetaSyncMistral = syncTriggers.some((k) => k in patch);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
  }

  const supabase = db();
  const { data: current, error: currentError } = await selectHubAgenteIdentidadeCompat(
    supabase,
    slug,
    ["agente_slug", "ativo", "arquivado_em"]
  );

  if (currentError) {
    return erroAgenteJson(currentError.message, 500);
  }
  if (!current) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  const arquivado = current.arquivado_em != null && current.arquivado_em !== "";
  if ("ativo" in patch) {
    const nextAtivo = patch.ativo === true;
    // Regra única de estado: agente arquivado sempre permanece inativo.
    if (arquivado && nextAtivo) {
      return NextResponse.json(
        { error: "Agente arquivado não pode ser reativado. Use fluxo específico de desarquivamento." },
        { status: 409 }
      );
    }
    if (arquivado) patch.ativo = false;
  }

  const { data, error } = await updateHubAgenteIdentidadeCompat(supabase, slug, patch);

  if (error) {
    return erroAgenteJson(error.message, 500);
  }
  if (!data) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  const updated = data as {
    agente_slug: string;
    mistral_agent_sync_habilitado?: boolean;
  };
  const sb = supabase;

  after(async () => {
    try {
      const out = await runPlaybookPipeline(sb, updated.agente_slug);
      if (!out.ok) {
        console.error("[playbook] pós-atualização agente:", updated.agente_slug, out.error);
      }
    } catch (e) {
      console.error("[playbook] pós-atualização agente (exceção):", updated.agente_slug, e);
    }
    if (
      patchAfetaSyncMistral &&
      updated.mistral_agent_sync_habilitado === true
    ) {
      try {
        const syn = await syncHubAgenteParaMistral(sb, updated.agente_slug);
        if (!syn.ok) {
          console.warn("[mistral-agents] pós-patch sync:", updated.agente_slug, syn.error);
        }
      } catch (e) {
        console.error("[mistral-agents] pós-patch sync (exceção):", updated.agente_slug, e);
      }
    }
  });

  return NextResponse.json(sanitizarAgenteHubParaCliente(data as Record<string, unknown>));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const supabase = db();
  const result = await deleteAgenteHubCompleto(supabase, slug);

  if (!result.ok) {
    const msg = result.error;
    const is404 = msg.includes("não encontrado") || /not found/i.test(msg);
    return NextResponse.json({ error: msg }, { status: is404 ? 404 : 500 });
  }

  return NextResponse.json({
    ok: true,
    agente_slug: slug,
    ...(result.uazapi_remote_deleted ? { uazapi_remote_deleted: true } : {}),
    ...(result.uazapi_delete_warning ? { uazapi_delete_warning: result.uazapi_delete_warning } : {}),
  });
}
