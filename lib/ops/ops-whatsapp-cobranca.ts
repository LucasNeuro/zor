import { crmDb } from "@/lib/crm/supabase-server";
import { whatsappConfigured, whatsappSendMedia } from "@/lib/whatsapp/whatsapp-send";
import { urlBoletoParaEnvio } from "@/lib/ops/ops-boleto-storage";

export function opsWhatsappInstanceToken(): string | null {
  return (
    process.env.OPS_UAZAPI_INSTANCE_TOKEN?.trim() ||
    process.env.UAZAPI_INSTANCE_TOKEN?.trim() ||
    null
  );
}

export function opsWhatsappConfigurado(): boolean {
  return whatsappConfigured({ instanceToken: opsWhatsappInstanceToken() });
}

function formatarMoeda(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(v: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("pt-BR");
  } catch {
    return v;
  }
}

export async function enviarBoletoWhatsappOps(opts: {
  mensalidadeId: string;
  tenantId: string;
  telefone: string;
  tenantNome: string;
  valorCentavos: number;
  vencimento: string | null;
  boletoArquivoUrl: string | null;
  coraBoletoUrl: string | null;
  actorEmail?: string | null;
}) {
  const token = opsWhatsappInstanceToken();
  if (!opsWhatsappConfigurado()) {
    throw new Error(
      "WhatsApp ops não configurado. Defina UAZAPI_BASE_URL e OPS_UAZAPI_INSTANCE_TOKEN (instância adm).",
    );
  }

  const fileUrl = urlBoletoParaEnvio(opts.boletoArquivoUrl, opts.coraBoletoUrl);
  if (!fileUrl) {
    throw new Error("Boleto sem arquivo — emita na Cora antes de enviar por WhatsApp.");
  }

  const caption = [
    `Olá! Segue o boleto da mensalidade *Waje*.`,
    `Empresa: ${opts.tenantNome}`,
    `Valor: ${formatarMoeda(opts.valorCentavos)}`,
    `Vencimento: ${formatarData(opts.vencimento)}`,
  ].join("\n");

  const { data: logRow, error: logErr } = await crmDb()
    .from("hub_ops_cobranca_envios")
    .insert({
      mensalidade_id: opts.mensalidadeId,
      tenant_id: opts.tenantId,
      telefone: opts.telefone.replace(/\D/g, ""),
      status: "pendente",
      mensagem: caption,
    })
    .select("id")
    .single();

  if (logErr) throw new Error(logErr.message);

  const envio = await whatsappSendMedia(opts.telefone, {
    type: "document",
    file: fileUrl,
    docName: `boleto-waje-${opts.mensalidadeId.slice(0, 8)}.pdf`,
    mimetype: "application/pdf",
    caption,
    instanceToken: token,
  });

  const agora = new Date().toISOString();

  if (!envio.ok) {
    await crmDb()
      .from("hub_ops_cobranca_envios")
      .update({ status: "erro", erro: envio.error, enviado_em: agora })
      .eq("id", logRow.id);
    await crmDb()
      .from("hub_tenant_mensalidades")
      .update({
        whatsapp_envio_erro: envio.error,
      })
      .eq("id", opts.mensalidadeId);
    throw new Error(envio.error);
  }

  await crmDb()
    .from("hub_ops_cobranca_envios")
    .update({ status: "enviado", enviado_em: agora })
    .eq("id", logRow.id);

  await crmDb()
    .from("hub_tenant_mensalidades")
    .update({
      whatsapp_enviado_em: agora,
      whatsapp_telefone: opts.telefone.replace(/\D/g, ""),
      whatsapp_envio_erro: null,
    })
    .eq("id", opts.mensalidadeId);

  if (opts.actorEmail) {
    console.info("[ops/whatsapp-cobranca] enviado por", opts.actorEmail, opts.mensalidadeId);
  }

  return { ok: true as const, envio_id: logRow.id };
}
