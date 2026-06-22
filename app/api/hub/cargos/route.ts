import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import { slugifyCargoSlug } from "@/lib/hub/cargo-slug";
import { applyCargoTenantFilter, cargoSlugExistsForTenant } from "@/lib/hub/cargo-catalogo-tenant";
import {
  modeloAltoValorForHubInsert,
  modeloCriticoForHubInsert,
  modeloPadraoForHubInsert,
} from "@/lib/ia/hub-model-defaults";
import {
  cargoTituloFromRow,
  deleteCargoCatalogo,
  insertCargoCatalogRow,
  listCargosCatalog,
  updateCargoCatalogRow,
} from "@/lib/hub/cargo-catalogo-db";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function asTrimmedOrNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function asOptionalTrimPatch(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  return asTrimmedOrNull(v);
}

function asOptionalNumberPatch(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function asStringArrayPatch(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) {
    const out = v.map((x) => String(x).trim()).filter(Boolean);
    return out;
  }
  if (typeof v === "string") {
    return v
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

function asOptionalBooleanPatch(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (["1", "true", "sim", "yes", "on"].includes(t)) return true;
    if (["0", "false", "nao", "não", "no", "off"].includes(t)) return false;
  }
  if (typeof v === "number") return v !== 0;
  return undefined;
}

type CargoAtendimentoDefaults = {
  saudacao_cliente: string;
  usar_perguntas_essenciais: boolean;
  ordem_perguntas_essenciais: "inicio" | "final";
  perguntas_essenciais: string[];
  comprimento_padrao: string;
};

function defaultsAtendimentoPorTipoCargo(input: {
  slug: string;
  titulo: string;
  segmento: string | null;
  especialidade: string | null;
}): CargoAtendimentoDefaults {
  const corpus = `${input.slug} ${input.titulo} ${input.segmento ?? ""} ${input.especialidade ?? ""}`.toLowerCase();

  const base: CargoAtendimentoDefaults = {
    saudacao_cliente: "Olá! Aqui é o time de atendimento. Como posso te ajudar hoje?",
    usar_perguntas_essenciais: false,
    ordem_perguntas_essenciais: "inicio",
    perguntas_essenciais: [],
    comprimento_padrao: "Máx. 2 frases por mensagem.",
  };

  const ehQualificacao =
    /\b(sdr|qualific|closer|vendas|comercial|inside sales|pré-venda|pre-venda)\b/i.test(corpus);
  if (ehQualificacao) {
    return {
      saudacao_cliente: "Olá! Aqui é o time de atendimento. Posso te ajudar com algumas perguntas rápidas?",
      usar_perguntas_essenciais: true,
      ordem_perguntas_essenciais: "inicio",
      perguntas_essenciais: [
        "Qual o seu nome?",
        "O que procura no momento?",
        "Qual região ou faixa de valor?",
        "Qual o prazo para decidir?",
      ],
      comprimento_padrao: "Máx. 2 frases por mensagem.",
    };
  }

  const ehSuporte = /\b(suporte|support|atendimento|help|sac|pós-venda|pos-venda)\b/i.test(corpus);
  if (ehSuporte) {
    return {
      saudacao_cliente: "Olá! Aqui é o suporte. Me conta rapidamente o que aconteceu para eu te ajudar.",
      usar_perguntas_essenciais: true,
      ordem_perguntas_essenciais: "inicio",
      perguntas_essenciais: [
        "O que aconteceu exatamente?",
        "Quando começou o problema?",
        "Qual produto/serviço está envolvido?",
        "Qual é o melhor contato para retorno?",
      ],
      comprimento_padrao: "Respostas curtas, diretas e objetivas (máx. 2 frases).",
    };
  }

  const ehOperacoes = /\b(operaç|operac|analista|finance|cobran|backoffice|processo)\b/i.test(corpus);
  if (ehOperacoes) {
    return {
      saudacao_cliente: "Olá! Vou validar seu pedido e já te atualizo com o próximo passo.",
      usar_perguntas_essenciais: true,
      ordem_perguntas_essenciais: "final",
      perguntas_essenciais: [
        "Qual é a sua solicitação principal?",
        "Você tem algum número de pedido/protocolo?",
        "Há prazo limite para essa solicitação?",
      ],
      comprimento_padrao: "Máx. 3 frases por mensagem; priorize clareza.",
    };
  }

  const ehMarketing = /\b(marketing|tráfego|trafego|copy|social|conteúdo|conteudo)\b/i.test(corpus);
  if (ehMarketing) {
    return {
      saudacao_cliente: "Olá! Vamos entender seu objetivo para te direcionar da melhor forma.",
      usar_perguntas_essenciais: true,
      ordem_perguntas_essenciais: "inicio",
      perguntas_essenciais: [
        "Qual objetivo principal da campanha/projeto?",
        "Qual o público-alvo?",
        "Qual orçamento ou limite de investimento?",
      ],
      comprimento_padrao: "Máx. 2 frases por mensagem; sem rodeios.",
    };
  }

  return base;
}

export async function GET(request: NextRequest) {
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const { tenantId } = tenantResolved;

  const supabase = db();
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "true";

  const { data, error } = await listCargosCatalog(supabase, all, tenantId);

  if (error) {
    const msg = error.message ?? "";
    if (/tenant_id|column|schema cache/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Catálogo de cargos por cliente ainda não está no Supabase. Aplique a migração 20260622180000_hub_cargos_catalogo_tenant_id.sql.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/** Corpo para criar cargo — `titulo` obrigatório; `slug` opcional (derivado do título). */
export async function POST(request: NextRequest) {
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const { tenantId } = tenantResolved;

  const supabase = db();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const titulo = asTrimmedOrNull(body.titulo);
  if (!titulo) {
    return NextResponse.json({ error: "titulo é obrigatório." }, { status: 400 });
  }

  const slugRaw = body.slug != null ? String(body.slug).trim() : "";
  const slugFinal = slugRaw ? slugifyCargoSlug(slugRaw) : slugifyCargoSlug(titulo);
  if (!slugFinal || slugFinal.length < 2) {
    return NextResponse.json({ error: "slug inválido (mínimo 2 caracteres após normalização)." }, { status: 400 });
  }

  const slugCheck = await cargoSlugExistsForTenant(supabase, slugFinal, tenantId);
  if (slugCheck.columnMissing) {
    return NextResponse.json(
      {
        error:
          "Catálogo de cargos por cliente ainda não está no Supabase. Aplique a migração 20260622180000_hub_cargos_catalogo_tenant_id.sql.",
      },
      { status: 503 }
    );
  }
  if (slugCheck.exists) {
    return NextResponse.json({ error: `Já existe cargo com slug «${slugFinal}».` }, { status: 409 });
  }

  const nivelRaw = body.nivel != null ? Number(body.nivel) : 3;
  const nivel = Number.isFinite(nivelRaw) ? Math.min(5, Math.max(1, Math.round(nivelRaw))) : 3;

  const pode = asStringArrayPatch(body.pode_fazer_padrao) ?? [];
  const naoPode = asStringArrayPatch(body.nao_pode_fazer_padrao) ?? [];
  const segmentoNorm = asTrimmedOrNull(body.segmento);
  const especialidadeNorm = asTrimmedOrNull(body.especialidade);
  const defaultsAtendimento = defaultsAtendimentoPorTipoCargo({
    slug: slugFinal,
    titulo,
    segmento: segmentoNorm,
    especialidade: especialidadeNorm,
  });

  const row: Record<string, unknown> = {
    slug: slugFinal,
    titulo,
    segmento: segmentoNorm,
    especialidade: especialidadeNorm,
    descricao_curta: asTrimmedOrNull(body.descricao_curta),
    area: asTrimmedOrNull(body.area) ?? "geral",
    nivel,
    modelo_padrao: modeloPadraoForHubInsert(typeof body.modelo_padrao === "string" ? body.modelo_padrao : null),
    modelo_critico: modeloCriticoForHubInsert(typeof body.modelo_critico === "string" ? body.modelo_critico : null),
    modelo_alto_valor: modeloAltoValorForHubInsert(
      typeof body.modelo_alto_valor === "string" ? body.modelo_alto_valor : null
    ),
    supervisor_slug: body.supervisor_slug != null ? asTrimmedOrNull(body.supervisor_slug) : null,
    pode_fazer_padrao: pode,
    nao_pode_fazer_padrao: naoPode,
    prompt_template: asTrimmedOrNull(body.prompt_template) ?? "",
    descricao: asTrimmedOrNull(body.descricao) ?? "",
    saudacao_cliente: asTrimmedOrNull(body.saudacao_cliente) ?? defaultsAtendimento.saudacao_cliente,
    usar_perguntas_essenciais:
      asOptionalBooleanPatch(body.usar_perguntas_essenciais) ?? defaultsAtendimento.usar_perguntas_essenciais,
    ordem_perguntas_essenciais:
      body.ordem_perguntas_essenciais === "final"
        ? "final"
        : body.ordem_perguntas_essenciais === "inicio"
          ? "inicio"
          : defaultsAtendimento.ordem_perguntas_essenciais,
    perguntas_essenciais: asStringArrayPatch(body.perguntas_essenciais) ?? defaultsAtendimento.perguntas_essenciais,
    comprimento_padrao: asTrimmedOrNull(body.comprimento_padrao) ?? defaultsAtendimento.comprimento_padrao,
    ativo: body.ativo !== false,
    tenant_id: tenantId,
  };

  const lim = asOptionalNumberPatch(body.limite_autonomia_brl);
  if (lim !== undefined && lim !== null) {
    row.limite_autonomia_brl = Math.max(0, lim);
  }

  const { data, error } = await insertCargoCatalogRow(supabase, row);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const { tenantId } = tenantResolved;

  const supabase = db();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const slug = String(body.slug || "").trim();
  if (!slug) {
    return NextResponse.json({ error: "slug é obrigatório." }, { status: 400 });
  }

  const propagarTitulo = body.propagar_titulo_para_agentes === true;

  const novoSlugNorm =
    typeof body.novo_slug === "string" && String(body.novo_slug).trim().length > 0
      ? slugifyCargoSlug(String(body.novo_slug))
      : "";

  const { data: oldRow, error: oldErr } = await applyCargoTenantFilter(
    supabase.from("hub_cargos_catalogo").select("*").eq("slug", slug),
    tenantId
  ).maybeSingle();

  if (oldErr) {
    return NextResponse.json({ error: oldErr.message }, { status: 500 });
  }
  if (!oldRow) {
    return NextResponse.json({ error: "Cargo não encontrado." }, { status: 404 });
  }

  const oldTitulo = cargoTituloFromRow(oldRow as Record<string, unknown>);

  if (novoSlugNorm && novoSlugNorm !== slug) {
    const clashCheck = await cargoSlugExistsForTenant(supabase, novoSlugNorm, tenantId);
    if (clashCheck.exists) {
      return NextResponse.json({ error: `Slug «${novoSlugNorm}» já está em uso.` }, { status: 409 });
    }
  }

  const patch: Record<string, unknown> = {};

  if ("ativo" in body) patch.ativo = !!body.ativo;
  if ("titulo" in body) {
    const tTit = asTrimmedOrNull(body.titulo);
    if (!tTit) {
      return NextResponse.json({ error: "titulo não pode ser vazio." }, { status: 400 });
    }
    patch.titulo = tTit;
  }
  if ("segmento" in body) patch.segmento = asOptionalTrimPatch(body.segmento);
  if ("especialidade" in body) patch.especialidade = asOptionalTrimPatch(body.especialidade);
  if ("descricao_curta" in body) patch.descricao_curta = asOptionalTrimPatch(body.descricao_curta);
  if ("area" in body) patch.area = asOptionalTrimPatch(body.area);
  if ("supervisor_slug" in body) {
    patch.supervisor_slug =
      body.supervisor_slug === null ? null : asOptionalTrimPatch(body.supervisor_slug);
  }
  if ("prompt_template" in body) patch.prompt_template = asOptionalTrimPatch(body.prompt_template);
  if ("descricao" in body) patch.descricao = asOptionalTrimPatch(body.descricao);
  if ("saudacao_cliente" in body) patch.saudacao_cliente = asOptionalTrimPatch(body.saudacao_cliente);
  if ("comprimento_padrao" in body) patch.comprimento_padrao = asOptionalTrimPatch(body.comprimento_padrao);
  const usarPerguntasPatch = asOptionalBooleanPatch(body.usar_perguntas_essenciais);
  if (usarPerguntasPatch !== undefined) patch.usar_perguntas_essenciais = usarPerguntasPatch;
  const perguntasPatch = asStringArrayPatch(body.perguntas_essenciais);
  if (perguntasPatch !== undefined) patch.perguntas_essenciais = perguntasPatch;
  if (body.ordem_perguntas_essenciais === "inicio" || body.ordem_perguntas_essenciais === "final") {
    patch.ordem_perguntas_essenciais = body.ordem_perguntas_essenciais;
  }

  const nivelPatch = asOptionalNumberPatch(body.nivel);
  if (nivelPatch !== undefined && nivelPatch !== null) {
    patch.nivel = Math.min(5, Math.max(1, Math.round(nivelPatch)));
  }

  const limPatch = asOptionalNumberPatch(body.limite_autonomia_brl);
  if (limPatch !== undefined) {
    patch.limite_autonomia_brl = limPatch === null ? null : Math.max(0, limPatch);
  }

  if ("modelo_padrao" in body && typeof body.modelo_padrao === "string") {
    patch.modelo_padrao = modeloPadraoForHubInsert(body.modelo_padrao);
  }
  if ("modelo_critico" in body && typeof body.modelo_critico === "string") {
    patch.modelo_critico = modeloCriticoForHubInsert(body.modelo_critico);
  }
  if ("modelo_alto_valor" in body && typeof body.modelo_alto_valor === "string") {
    patch.modelo_alto_valor = modeloAltoValorForHubInsert(body.modelo_alto_valor);
  }

  const podePatch = asStringArrayPatch(body.pode_fazer_padrao);
  if (podePatch !== undefined) patch.pode_fazer_padrao = podePatch;

  const naoPatch = asStringArrayPatch(body.nao_pode_fazer_padrao);
  if (naoPatch !== undefined) patch.nao_pode_fazer_padrao = naoPatch;

  if (novoSlugNorm && novoSlugNorm !== slug) {
    patch.slug = novoSlugNorm;
  }

  const novosCampos = Object.keys(patch).filter((k) => k !== "slug");
  if (novosCampos.length === 0 && !(patch.slug && patch.slug !== slug)) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const { data, error } = await updateCargoCatalogRow(supabase, slug, patch, tenantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Cargo não encontrado após atualização." }, { status: 404 });
  }

  const tituloFinal = cargoTituloFromRow(data);
  if (propagarTitulo && tituloFinal && oldTitulo && tituloFinal !== oldTitulo) {
    await applyCargoTenantFilter(
      supabase.from("hub_agente_identidade").update({ cargo: tituloFinal }).eq("cargo", oldTitulo),
      tenantId
    );
  }

  return NextResponse.json(data);
}

/** Query: ?slug= — elimina via RPC com SET LOCAL app.delete_authorized (trigger delete). */
export async function DELETE(request: NextRequest) {
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const { tenantId } = tenantResolved;

  const supabase = db();
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Query slug é obrigatória." }, { status: 400 });
  }

  const result = await deleteCargoCatalogo(supabase, slug, tenantId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, slug: result.slug });
}
