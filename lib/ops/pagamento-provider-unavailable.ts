import { NextResponse } from "next/server";

export const PAGAMENTO_PROVIDER_UNAVAILABLE_CODE = "PAGAMENTO_PROVIDER_UNAVAILABLE";

export const PAGAMENTO_PROVIDER_UNAVAILABLE_MESSAGE =
  "Emissão bancária (Cora) descontinuada. Nova integração de pagamentos em breve — use mensalidades pendentes no CRM.";

export function pagamentoProviderUnavailableResponse() {
  return NextResponse.json(
    {
      error: PAGAMENTO_PROVIDER_UNAVAILABLE_MESSAGE,
      code: PAGAMENTO_PROVIDER_UNAVAILABLE_CODE,
    },
    { status: 503 }
  );
}
