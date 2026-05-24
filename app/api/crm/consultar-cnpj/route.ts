import { NextRequest, NextResponse } from "next/server";
import { validarCnpj, normalizarDocumento, documentoCompleto } from "@/lib/crm/documento-brasil";
import { buscarCnpjOpenCnpj } from "@/lib/crm/opencnpj";

/** GET ?cnpj= — consulta OpenCNPJ e devolve dados para auto-preenchimento. */
export async function GET(request: NextRequest) {
  const cnpj = request.nextUrl.searchParams.get("cnpj") || "";
  const digits = normalizarDocumento(cnpj);

  if (!documentoCompleto("PJ", digits)) {
    return NextResponse.json(
      { error: "Informe o CNPJ com 14 dígitos.", valido: false },
      { status: 400 }
    );
  }

  if (!validarCnpj(digits)) {
    return NextResponse.json({ error: "CNPJ inválido (dígitos verificadores).", valido: false }, { status: 400 });
  }

  const result = await buscarCnpjOpenCnpj(digits);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.erro, valido: false },
      { status: result.status >= 400 ? result.status : 502 }
    );
  }

  return NextResponse.json({
    valido: true,
    dados: result.dados,
  });
}
