import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  excluirEmpresaCrm,
  excluirPessoaCrm,
} from "@/lib/crm/excluir-cadastro-crm";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  let body: { tipo?: string; ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const tipo = body.tipo === "empresa" ? "empresa" : body.tipo === "pessoa" ? "pessoa" : null;
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((id) => typeof id === "string" && id.trim()))]
    : [];

  if (!tipo || ids.length === 0) {
    return NextResponse.json(
      { error: "Informe tipo (pessoa|empresa) e ao menos um id." },
      { status: 400 }
    );
  }

  if (ids.length > 100) {
    return NextResponse.json({ error: "Máximo de 100 registos por operação." }, { status: 400 });
  }

  const supabase = db();
  const erros: { id: string; error: string }[] = [];
  let ok = 0;

  for (const id of ids) {
    const { result, httpStatus } =
      tipo === "pessoa"
        ? await excluirPessoaCrm(supabase, id)
        : await excluirEmpresaCrm(supabase, id);

    if (result.ok) {
      ok += 1;
    } else {
      erros.push({ id, error: result.error || `HTTP ${httpStatus}` });
    }
  }

  return NextResponse.json({
    ok: erros.length === 0,
    excluidos: ok,
    falhas: erros.length,
    erros,
  });
}
