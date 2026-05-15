import { NextRequest, NextResponse } from "next/server";
import {
  SECOES_CONHECIMENTO_IDS,
  type CargoContextoSugerir,
  type SecaoConhecimentoId,
  gerarConhecimentoSecaoComIa,
} from "@/lib/hub/sugerir-conhecimento-secao";

function isSecao(v: unknown): v is SecaoConhecimentoId {
  return typeof v === "string" && (SECOES_CONHECIMENTO_IDS as readonly string[]).includes(v);
}

function parseCargo(body: Record<string, unknown>): CargoContextoSugerir | null {
  const c = body.cargo;
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  const o = c as Record<string, unknown>;
  const slug = String(o.slug || "").trim();
  const titulo = String(o.titulo || "").trim();
  if (!slug || !titulo) return null;
  return {
    slug,
    titulo,
    segmento: o.segmento != null ? String(o.segmento) : null,
    nivel: o.nivel != null ? String(o.nivel) : null,
    especialidade: o.especialidade != null ? String(o.especialidade) : null,
    descricao_curta: o.descricao_curta != null ? String(o.descricao_curta) : null,
    descricao: o.descricao != null ? String(o.descricao) : null,
  };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const secao = body.secao;
  if (!isSecao(secao)) {
    return NextResponse.json(
      {
        error: `secao inválida. Use: ${(SECOES_CONHECIMENTO_IDS as readonly string[]).join(" | ")}.`,
      },
      { status: 400 }
    );
  }

  const nomeAgente = String(body.nome_agente || "").trim();
  if (!nomeAgente) {
    return NextResponse.json({ error: "nome_agente é obrigatório." }, { status: 400 });
  }

  const cargo = parseCargo(body);
  if (!cargo) {
    return NextResponse.json(
      { error: "cargo obrigatório: { slug, titulo, segmento?, nivel?, … }." },
      { status: 400 }
    );
  }

  const mercadosRaw = body.mercados;
  const mercados = Array.isArray(mercadosRaw)
    ? mercadosRaw.map((x) => String(x).trim()).filter(Boolean)
    : undefined;

  const textoAtual =
    typeof body.texto_atual === "string" ? body.texto_atual : undefined;

  const result = await gerarConhecimentoSecaoComIa({
    secao,
    cargo,
    nomeAgente,
    mercados,
    textoAtual,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json({ texto: result.texto });
}
