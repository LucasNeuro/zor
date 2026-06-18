import { crmDb } from "@/lib/crm/supabase-server";
import { baixarArquivoCora } from "@/lib/cora/cora-client";

export const OPS_BOLETOS_BUCKET = "waje-ops-boletos";

export type BoletoPersistido = {
  storagePath: string;
  publicUrl: string;
};

export async function persistirBoletoPdf(
  tenantId: string,
  mensalidadeId: string,
  coraPdfUrl: string | null,
): Promise<BoletoPersistido | null> {
  if (!coraPdfUrl?.trim()) return null;

  const pdf = await baixarArquivoCora(coraPdfUrl.trim());
  if (!pdf.length) throw new Error("PDF do boleto Cora veio vazio.");

  const storagePath = `${tenantId}/${mensalidadeId}.pdf`;
  const supabase = crmDb();

  const upload = await supabase.storage.from(OPS_BOLETOS_BUCKET).upload(storagePath, pdf, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (upload.error) {
    throw new Error(`Falha ao guardar PDF no storage: ${upload.error.message}`);
  }

  const { data: pub } = supabase.storage.from(OPS_BOLETOS_BUCKET).getPublicUrl(storagePath);
  return { storagePath, publicUrl: pub.publicUrl };
}

export function urlBoletoParaEnvio(
  boletoArquivoUrl: string | null | undefined,
  coraBoletoUrl: string | null | undefined,
): string | null {
  return boletoArquivoUrl?.trim() || coraBoletoUrl?.trim() || null;
}
