import { NextRequest, NextResponse } from "next/server";
import { coraConfigurado } from "@/lib/cora/cora-config";
import { getCoraEmissorCnpj, mensagemCoraEmissorAusente } from "@/lib/cora/cora-emissor";
import type { CoraFormaPagamento } from "@/lib/cora/cora-cobranca";
import { gerarBoletosParcelados } from "@/lib/ops/cora-mensalidade";
import { diagnosticarCoraTenant } from "@/lib/cora/cora-diagnostico";
import { requireOpsApiAccess, getOpsActor } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  if (!coraConfigurado()) {
    return NextResponse.json(
      {
        error:
          "Cora não configurada. Defina CORA_CLIENT_ID, CORA_CERT_PEM e CORA_PRIVATE_KEY_PEM no servidor.",
        configured: false,
      },
      { status: 503 },
    );
  }

  if (!getCoraEmissorCnpj()) {
    return NextResponse.json(
      {
        error: mensagemCoraEmissorAusente(),
        configured: false,
      },
      { status: 503 },
    );
  }

  const { id } = await ctx.params;
  const tenantId = id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "ID do tenant obrigatório." }, { status: 400 });
  }

  let body: {
    valor_centavos?: number;
    parcelas?: number;
    primeiro_vencimento?: string;
    forma?: CoraFormaPagamento;
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
    const resultado = await gerarBoletosParcelados(tenantId, {
      valor_centavos,
      parcelas,
      primeiro_vencimento,
      forma: body.forma,
    });

    const actor = await getOpsActor(request);
    if (actor?.email) {
      const ids = resultado.criadas
        .map((r) => (r as { cora_invoice_id?: string }).cora_invoice_id)
        .filter(Boolean);
      console.info(
        "[ops/cora-boletos] tenant",
        tenantId,
        "por",
        actor.email,
        `${resultado.criadas.length}/${parcelas} ok`,
        ids.length ? `invoice_ids=${ids.join(",")}` : "",
      );
    }
    if (resultado.erros.length) {
      console.error(
        "[ops/cora-boletos] falhas:",
        resultado.erros.map((e) => `parcela ${e.parcela}: ${e.error}`).join(" | "),
      );
    }

    const status = resultado.criadas.length === 0 ? 502 : resultado.erros.length ? 207 : 201;
    const primeiroErro = resultado.erros[0]?.error;
    let diagnostico: Awaited<ReturnType<typeof diagnosticarCoraTenant>> | undefined;
    if (resultado.criadas.length === 0 && primeiroErro) {
      try {
        diagnostico = await diagnosticarCoraTenant(tenantId);
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json(
      {
        data: resultado.criadas,
        erros: resultado.erros,
        error:
          resultado.criadas.length === 0 && primeiroErro
            ? primeiroErro
            : undefined,
        diagnostico,
        resumo: {
          emitidas: resultado.criadas.length,
          falhas: resultado.erros.length,
          total_solicitado: parcelas,
        },
      },
      { status },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao gerar boletos.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
