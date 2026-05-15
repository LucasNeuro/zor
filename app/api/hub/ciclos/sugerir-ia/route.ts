import { NextRequest, NextResponse } from "next/server";
import {
  sugerirDescricaoCiclo,
  sugerirParametrosFollowup,
} from "@/lib/hub/sugerir-ciclo-ia";

const ACOES = ["descricao", "followup"] as const;
type Acao = (typeof ACOES)[number];

function isAcao(v: unknown): v is Acao {
  return typeof v === "string" && (ACOES as readonly string[]).includes(v);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const acao = body.acao;
  if (!isAcao(acao)) {
    return NextResponse.json(
      { error: "acao inválida. Use: descricao | followup." },
      { status: 400 }
    );
  }

  const nome = String(body.nome || "").trim();
  const agente_slug = String(body.agente_slug || "").trim();
  if (!nome || !agente_slug) {
    return NextResponse.json(
      { error: "nome e agente_slug são obrigatórios." },
      { status: 400 }
    );
  }

  if (acao === "descricao") {
    const tipo_ciclo = String(body.tipo_ciclo || "programado").trim();
    const cron_resumo =
      typeof body.cron_resumo === "string" ? body.cron_resumo.trim() : undefined;
    const texto_atual = typeof body.texto_atual === "string" ? body.texto_atual : undefined;

    const out = await sugerirDescricaoCiclo({
      nome,
      agente_slug,
      tipo_ciclo,
      cron_resumo,
      texto_atual,
    });
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: 503 });
    return NextResponse.json({ texto: out.texto });
  }

  const descricao = typeof body.descricao === "string" ? body.descricao : undefined;
  const out = await sugerirParametrosFollowup({ nome, agente_slug, descricao });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 503 });
  return NextResponse.json({
    horas_followup: out.horas_followup,
    arquivar_apos_dias: out.arquivar_apos_dias,
  });
}
