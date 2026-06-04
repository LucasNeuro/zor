import { NextRequest, NextResponse } from "next/server";
import { isValidCnpj, onlyDigits } from "@/lib/brasil-docs";

type OpenCnpjResponse = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  situacao_cadastral?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  uf?: string;
  municipio?: string;
  email?: string;
};

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("cnpj") ?? "";
  const cnpj = onlyDigits(raw);

  if (!isValidCnpj(cnpj)) {
    return NextResponse.json({ ok: false, error: "CNPJ inválido." }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.opencnpj.org/${cnpj}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível consultar o CNPJ no momento." },
        { status: 502 },
      );
    }

    const data = (await res.json()) as OpenCnpjResponse;
    return NextResponse.json({
      ok: true,
      cnpj,
      razao_social: data.razao_social ?? null,
      nome_fantasia: data.nome_fantasia ?? null,
      situacao_cadastral: data.situacao_cadastral ?? null,
      endereco: {
        logradouro: data.logradouro ?? null,
        numero: data.numero ?? null,
        complemento: data.complemento ?? null,
        bairro: data.bairro ?? null,
        cep: data.cep ? onlyDigits(data.cep) : null,
        cidade: data.municipio ?? null,
        uf: data.uf ?? null,
      },
      email: data.email ?? null,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Falha de rede ao consultar CNPJ." },
      { status: 502 },
    );
  }
}
