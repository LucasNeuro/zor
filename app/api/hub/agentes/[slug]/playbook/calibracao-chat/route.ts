import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  executarCalibracaoPlaybookReply,
  type CalibracaoMensagemLinha,
} from "@/lib/playbook/calibracao-chat";
import { loadCurrentPlaybookMarkdown } from "@/lib/playbook/custom-playbook";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MAX_MENSAGEM_LEN = 12_000;
const MAX_HISTORICO = 32;

function normalizarHistorico(raw: unknown): CalibracaoMensagemLinha[] {
  if (!Array.isArray(raw)) return [];
  const out: CalibracaoMensagemLinha[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const papel = row.papel === "assistant" ? "assistant" : row.papel === "user" ? "user" : null;
    const conteudo = typeof row.conteudo === "string" ? row.conteudo.trim() : "";
    if (!papel || !conteudo) continue;
    out.push({ papel, conteudo });
    if (out.length >= MAX_HISTORICO) break;
  }
  return out;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  let body: {
    mensagem?: unknown;
    historico?: unknown;
    markdown_rascunho?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const mensagem = typeof body.mensagem === "string" ? body.mensagem.trim() : "";
  if (!mensagem) {
    return NextResponse.json({ error: "mensagem é obrigatória." }, { status: 400 });
  }
  if (mensagem.length > MAX_MENSAGEM_LEN) {
    return NextResponse.json({ error: "Mensagem demasiado longa." }, { status: 400 });
  }

  const { data: agente, error: agErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome, cargo, modelo_padrao")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 });
  if (!agente) return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });

  let playbookMarkdown =
    typeof body.markdown_rascunho === "string" && body.markdown_rascunho.trim()
      ? body.markdown_rascunho.trim()
      : "";

  if (!playbookMarkdown) {
    const loaded = await loadCurrentPlaybookMarkdown(supabase, slug);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }
    playbookMarkdown = loaded.markdown;
  }

  const historico = normalizarHistorico(body.historico);
  const modelo =
    typeof agente.modelo_padrao === "string" && agente.modelo_padrao.trim()
      ? agente.modelo_padrao.trim()
      : undefined;

  try {
    const resultado = await executarCalibracaoPlaybookReply({
      agenteNome: String(agente.nome || slug),
      agenteSlug: slug,
      cargo: typeof agente.cargo === "string" ? agente.cargo : null,
      playbookMarkdown,
      historico,
      mensagemUsuario: mensagem,
      modelo,
    });

    return NextResponse.json({
      sucesso: true,
      resposta: resultado.texto,
      modelo: resultado.modelo,
      tokens_input: resultado.tokens_input,
      tokens_output: resultado.tokens_output,
      custo_brl: resultado.custo_brl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao gerar resposta";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
