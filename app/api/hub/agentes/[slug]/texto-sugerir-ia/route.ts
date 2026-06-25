import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import {
  isTextoSugestaoContexto,
  sugerirTextoFluxoIa,
  type TextoSugestaoAcao,
  type TextoSugestaoMeta,
} from "@/lib/hub/sugerir-texto-fluxo-ia";

const ACOES: TextoSugestaoAcao[] = ["sugerir", "melhorar"];

function isAcao(v: unknown): v is TextoSugestaoAcao {
  return typeof v === "string" && (ACOES as readonly string[]).includes(v);
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function parseMeta(raw: unknown): TextoSugestaoMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const passos_anteriores = Array.isArray(o.passos_anteriores)
    ? o.passos_anteriores.map((x) => String(x ?? "").trim()).filter(Boolean)
    : undefined;
  return {
    passo_ordem: typeof o.passo_ordem === "number" ? o.passo_ordem : undefined,
    tipo_conteudo: typeof o.tipo_conteudo === "string" ? o.tipo_conteudo : undefined,
    atraso_label: typeof o.atraso_label === "string" ? o.atraso_label : undefined,
    passos_anteriores,
    step_id: typeof o.step_id === "string" ? o.step_id : undefined,
    step_kind: typeof o.step_kind === "string" ? o.step_kind : undefined,
    step_title: typeof o.step_title === "string" ? o.step_title : undefined,
    menu_prompt: typeof o.menu_prompt === "string" ? o.menu_prompt : undefined,
    option_id: typeof o.option_id === "string" ? o.option_id : undefined,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const acao = body.acao;
  const contexto = body.contexto;
  if (!isAcao(acao)) {
    return NextResponse.json({ error: "acao inválida. Use: sugerir | melhorar." }, { status: 400 });
  }
  if (!isTextoSugestaoContexto(contexto)) {
    return NextResponse.json({ error: "contexto inválido." }, { status: 400 });
  }

  const supabase = db();
  const { data: agente, error: agErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome, cargo, area, tom_voz, personalidade, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 });
  if (!agente) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });

  const agenteTenant =
    typeof agente.tenant_id === "string" && agente.tenant_id.trim()
      ? agente.tenant_id.trim()
      : null;
  if (
    agenteTenant &&
    tenantResolved.tenantId &&
    agenteTenant !== tenantResolved.tenantId
  ) {
    return NextResponse.json({ error: "Agente não pertence a este tenant." }, { status: 403 });
  }

  const texto_atual = typeof body.texto_atual === "string" ? body.texto_atual : undefined;
  const meta = parseMeta(body.meta);

  const out = await sugerirTextoFluxoIa({
    acao,
    contexto,
    agente: {
      nome: String(agente.nome || slug),
      cargo: typeof agente.cargo === "string" ? agente.cargo : undefined,
      area: typeof agente.area === "string" ? agente.area : undefined,
      tom_voz: typeof agente.tom_voz === "string" ? agente.tom_voz : undefined,
      personalidade: typeof agente.personalidade === "string" ? agente.personalidade : undefined,
    },
    texto_atual,
    meta,
  });

  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 503 });
  return NextResponse.json({ texto: out.texto });
}
