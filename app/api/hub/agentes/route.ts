import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function slugify(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

function isTenantColumnMissing(message?: string): boolean {
  if (!message) return false;
  return message.includes("hub_agente_identidade.tenant_id does not exist");
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const { searchParams } = new URL(request.url);
  const ativo = searchParams.get("ativo");
  const todos = searchParams.get("todos") === "true";
  /** `somente` = linhas com arquivado_em preenchido (exclui ativos/inativos “de produção”). */
  const arquivados = searchParams.get("arquivados");
  const tenantId = tenantIdFromRequest(request.headers);

  async function executarConsulta(aplicarTenant: boolean) {
    let query = supabase
      .from("hub_agente_identidade")
      .select("*")
      .order("nivel")
      .order("nome");

    if (aplicarTenant) {
      query = query.eq("tenant_id", tenantId);
    }

    if (todos) {
      // Inclui ativos, inativos e arquivados.
    } else if (arquivados === "somente") {
      query = query.not("arquivado_em", "is", null);
    } else {
      query = query.is("arquivado_em", null);
      if (ativo === "false") {
        query = query.eq("ativo", false);
      } else {
        query = query.eq("ativo", true);
      }
    }

    return await query;
  }

  let { data, error } = await executarConsulta(true);

  // Compatibilidade com bases antigas que ainda não têm tenant_id.
  if (error && isTenantColumnMissing(error.message)) {
    ({ data, error } = await executarConsulta(false));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const {
    cargo_slug,
    nome,
    personalidade,
    prefixo_mercado,
    bio,
    horario_inicio,
    horario_fim,
    dias_semana,
    system_prompt_base,
    tom_voz,
    estilo_comunicacao,
    avatar_url,
  } = body as {
    cargo_slug?: string;
    nome?: string;
    personalidade?: string;
    prefixo_mercado?: string;
    bio?: string;
    horario_inicio?: string;
    horario_fim?: string;
    dias_semana?: unknown;
    system_prompt_base?: string;
    tom_voz?: string;
    estilo_comunicacao?: string;
    avatar_url?: string;
  };

  if (!cargo_slug || !nome) {
    return NextResponse.json(
      { error: "cargo_slug e nome são obrigatórios." },
      { status: 400 }
    );
  }

  const { data: cat, error: catErr } = await supabase
    .from("hub_cargos_catalogo")
    .select(
      "slug, titulo, area, nivel, modelo_padrao, modelo_critico, modelo_alto_valor, supervisor_slug, pode_fazer_padrao, nao_pode_fazer_padrao, prompt_template, descricao"
    )
    .eq("slug", cargo_slug)
    .eq("ativo", true)
    .maybeSingle();

  if (catErr) {
    return NextResponse.json({ error: catErr.message }, { status: 500 });
  }
  if (!cat) {
    return NextResponse.json(
      { error: `Cargo "${cargo_slug}" não encontrado em hub_cargos_catalogo (ativo).` },
      { status: 400 }
    );
  }

  const nivel = typeof cat.nivel === "number" ? cat.nivel : Number(cat.nivel) || 3;
  const promptBase =
    (system_prompt_base && String(system_prompt_base).trim()) ||
    (cat.prompt_template && String(cat.prompt_template).trim()) ||
    (cat.descricao && String(cat.descricao).trim()) ||
    `Agente ${nome} — ${cat.titulo}. Siga as regras do Obra10+ e escale decisões críticas para humano.`;

  // Gerar slug único
  const baseSlug = slugify(nome);
  let agente_slug = baseSlug;
  let sufixo = 2;

  while (true) {
    const { data: existing } = await supabase
      .from("hub_agente_identidade")
      .select("agente_slug")
      .eq("agente_slug", agente_slug)
      .maybeSingle();

    if (!existing) break;

    agente_slug = `${baseSlug.slice(0, 37)}_${sufixo}`;
    sufixo++;
  }

  const podeFazer = Array.isArray(cat.pode_fazer_padrao) ? cat.pode_fazer_padrao : [];
  const naoPode = Array.isArray(cat.nao_pode_fazer_padrao) ? cat.nao_pode_fazer_padrao : [];

  const diaLabels = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  const rawDias = Array.isArray(dias_semana) ? (dias_semana as unknown[]) : [0, 1, 2, 3, 4, 5, 6];
  const diasParsed = rawDias
    .map((d) => {
      const n = typeof d === "number" ? d : parseInt(String(d), 10);
      return Number.isFinite(n) && n >= 0 && n <= 6 ? diaLabels[n] : null;
    })
    .filter((x): x is string => x != null);
  const diasTexto = [...new Set(diasParsed)];

  const row: Record<string, unknown> = {
    agente_slug,
    nome: nome.trim(),
    cargo: cat.titulo as string,
    area: (cat.area as string) || "geral",
    nivel,
    personalidade: (personalidade && String(personalidade).trim()) || "## Tom\n\nTom alinhado ao cargo.",
    tom_voz: (tom_voz && String(tom_voz).trim()) || "profissional e cordial",
    estilo_comunicacao: (estilo_comunicacao && String(estilo_comunicacao).trim()) || "Direto",
    system_prompt_base: promptBase,
    modelo_padrao: (cat.modelo_padrao as string) || "claude-haiku-4-5-20251001",
    modelo_critico: (cat.modelo_critico as string) || "claude-sonnet-4-6",
    modelo_alto_valor: (cat.modelo_alto_valor as string) || "claude-opus-4-7",
    pode_fazer: podeFazer,
    nao_pode_fazer: naoPode,
    sempre_dizer: [],
    nunca_dizer: [],
    prefixo_mercado: (prefixo_mercado && String(prefixo_mercado).trim()) || "GRL",
    bio: (bio && String(bio).trim()) || null,
    horario_inicio: horario_inicio || "08:00:00",
    horario_fim: horario_fim || "22:00:00",
    dias_semana: diasTexto.length > 0 ? diasTexto : ["seg", "ter", "qua", "qui", "sex"],
    ativo: true,
    tenant_id: tenantId || defaultTenantId(),
  };

  const avatarTrim = avatar_url != null ? String(avatar_url).trim() : "";
  if (avatarTrim.length > 600_000) {
    return NextResponse.json(
      { error: "avatar_url excede o tamanho máximo permitido." },
      { status: 400 }
    );
  }
  if (avatarTrim.length > 0) {
    row.avatar_url = avatarTrim;
  }

  let { data, error } = await supabase.from("hub_agente_identidade").insert(row).select().single();

  // Compatibilidade com bases antigas que ainda não têm tenant_id.
  if (error && isTenantColumnMissing(error.message)) {
    const { tenant_id, ...rowWithoutTenant } = row;
    ({ data, error } = await supabase
      .from("hub_agente_identidade")
      .insert(rowWithoutTenant)
      .select()
      .single());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
