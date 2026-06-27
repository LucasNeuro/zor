export const OPS_BOLETOS_BUCKET = "waje-ops-boletos";

export type BoletoPersistido = {
  storagePath: string;
  publicUrl: string;
};

export function urlBoletoParaEnvio(
  boletoArquivoUrl: string | null | undefined,
  coraBoletoUrl: string | null | undefined,
): string | null {
  return boletoArquivoUrl?.trim() || coraBoletoUrl?.trim() || null;
}
