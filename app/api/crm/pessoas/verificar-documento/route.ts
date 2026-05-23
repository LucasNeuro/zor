import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  documentoCompleto,
  mensagemDocumentoInvalido,
  normalizarDocumento,
  validarCnpj,
  validarCpf,
} from "@/lib/crm/documento-brasil";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** GET ?documento=...&tipo_pessoa=PF|PJ — valida formato e indica se já existe no hub. */
export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      { error: "Supabase não configurado no servidor." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo_pessoa");
  const raw = searchParams.get("documento") || "";

  if (tipo !== "PF" && tipo !== "PJ") {
    return NextResponse.json({ error: "tipo_pessoa deve ser PF ou PJ." }, { status: 400 });
  }

  const documento = normalizarDocumento(raw);
  if (!documento) {
    return NextResponse.json({ disponivel: true, valido: false, motivo: "vazio" });
  }

  if (!documentoCompleto(tipo, documento)) {
    return NextResponse.json({
      disponivel: false,
      valido: false,
      error: tipo === "PF" ? "Informe os 11 dígitos do CPF." : "Informe os 14 dígitos do CNPJ.",
    });
  }

  const valido = tipo === "PF" ? validarCpf(documento) : validarCnpj(documento);
  if (!valido) {
    return NextResponse.json({
      disponivel: false,
      valido: false,
      error: mensagemDocumentoInvalido(tipo),
    });
  }

  const supabase = db();
  const { data: existente } = await supabase
    .from("hub_pessoas")
    .select("id, nome, codigo, tipo_pessoa")
    .eq("documento", documento)
    .maybeSingle();

  if (existente) {
    const label = tipo === "PF" ? "CPF" : "CNPJ";
    return NextResponse.json({
      disponivel: false,
      valido: true,
      duplicado: true,
      error: `${label} já cadastrado para ${existente.nome} (${existente.codigo || "sem código"}).`,
      pessoa_id: existente.id,
      codigo: existente.codigo,
      nome: existente.nome,
    });
  }

  return NextResponse.json({ disponivel: true, valido: true, duplicado: false });
}
