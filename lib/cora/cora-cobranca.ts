import { randomUUID } from "node:crypto";
import {
  emitirBoletoCora,
  cancelarCobrancaCora,
  type CoraEmitirBoletoInput,
  type CoraBoletoEmitido,
} from "@/lib/cora/cora-client";

export type CoraFormaPagamento = "boleto" | "pix" | "boleto_pix";

export function paymentFormsFor(forma: CoraFormaPagamento): string[] {
  if (forma === "pix") return ["PIX"];
  if (forma === "boleto") return ["BANK_SLIP"];
  return ["BANK_SLIP", "PIX"];
}

export async function emitirCoraCobranca(
  input: CoraEmitirBoletoInput,
  forma: CoraFormaPagamento,
): Promise<CoraBoletoEmitido> {
  return emitirBoletoCora(
    { ...input, payment_forms: paymentFormsFor(forma) },
    randomUUID(),
  );
}

export { cancelarCobrancaCora };
