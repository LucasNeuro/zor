import { NextRequest, NextResponse } from "next/server";
import { criarMensalidadesParceladas } from "@/lib/ops/mensalidade";
import { requireOpsApiAccess, getOpsActor } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

/** Cria mensalidades parceladas no CRM (sem emissão bancária — rota legada cora-boletos). */
export async function POST(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const tenantId = id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "ID do tenant obrigatório." }, { status: 400 });
  }

  let body: {
    valor_centavos?: number;
    parcelas?: number;
    primeiro_vencimento?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const valor_centavos =
    typeof body.valor_centavos === "number" && Number.isFinite(body.valor_centavos)
      ? Math.round(body.valor_centavos)
      : 0;
  const parcelas =
    typeof body.parcelas === "number" && Number.isFinite(body.parcelas)
      ? Math.round(body.parcelas)
      : 0;
  const primeiro_vencimento = body.primeiro_vencimento?.trim() ?? "";

  if (!valor_centavos || !parcelas || !primeiro_vencimento) {
    return NextResponse.json(
      { error: "Informe valor_centavos, parcelas e primeiro_vencimento." },
      { status: 400 },
    );
  }

  try {
    const resultado = await criarMensalidadesParceladas(tenantId, {
      valor_centavos,
      parcelas,
      primeiro_vencimento,
    });

    const actor = await getOpsActor(request);
    if (actor?.email) {
      console.info(
        "[ops/mensalidades-parceladas] tenant",
        tenantId,
        "por",
        actor.email,
        `${resultado.criadas.length}/${parcelas} ok`,
      );
    }
    if (resultado.erros.length) {
      console.error(
        "[ops/mensalidades-parceladas] falhas:",
        resultado.erros.map((e) => `parcela ${e.parcela}: ${e.error}`).join(" | "),
      );
    }

    const status = resultado.criadas.length === 0 ? 502 : resultado.erros.length ? 207 : 201;
    const primeiroErro = resultado.erros[0]?.error;

    return NextResponse.json(
      {
        data: resultado.criadas,
        erros: resultado.erros,
        error:
          resultado.criadas.length === 0 && primeiroErro
            ? primeiroErro
            : undefined,
        aviso:
          "Mensalidades criadas no CRM. Emissão bancária (Cora) descontinuada — nova integração em breve.",
        resumo: {
          criadas: resultado.criadas.length,
          falhas: resultado.erros.length,
          total_solicitado: parcelas,
          emitidas: resultado.criadas.length,
        },
      },
      { status },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao criar mensalidades.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
