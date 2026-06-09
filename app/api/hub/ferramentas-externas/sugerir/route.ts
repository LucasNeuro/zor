import { NextRequest, NextResponse } from "next/server";
import { sugerirFerramentaExternaComMistral } from "@/lib/hub/sugerir-ferramenta-externa";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "titulo é obrigatório." }, { status: 400 });

  const contexto =
    body.contexto != null && String(body.contexto).trim() ? String(body.contexto).trim() : undefined;

  const out = await sugerirFerramentaExternaComMistral({ tituloPedido: titulo, contextoApi: contexto });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 502 });

  return NextResponse.json({ sugestao: out.sugestao });
}
