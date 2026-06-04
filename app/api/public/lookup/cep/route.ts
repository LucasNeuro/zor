import { NextRequest, NextResponse } from "next/server";
import { onlyDigits } from "@/lib/brasil-docs";

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("cep") ?? "";
  const cep = onlyDigits(raw);

  if (cep.length !== 8) {
    return NextResponse.json({ ok: false, error: "CEP inválido." }, { status: 400 });
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível consultar o CEP." },
        { status: 502 },
      );
    }

    const data = (await res.json()) as ViaCepResponse;
    if (data.erro) {
      return NextResponse.json({ ok: false, error: "CEP não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      cep: data.cep ? onlyDigits(data.cep) : cep,
      logradouro: data.logradouro ?? null,
      complemento: data.complemento ?? null,
      bairro: data.bairro ?? null,
      cidade: data.localidade ?? null,
      uf: data.uf ?? null,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Falha de rede ao consultar CEP." },
      { status: 502 },
    );
  }
}
