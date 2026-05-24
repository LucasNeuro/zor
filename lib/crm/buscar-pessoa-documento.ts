import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatarCnpjMascara,
  formatarCpfMascara,
  normalizarDocumento,
} from "@/lib/crm/documento-brasil";

export type PessoaDocumentoRow = {
  id: string;
  nome: string | null;
  codigo: string | null;
  tipo_pessoa: string | null;
  documento: string | null;
};

/** Procura pessoa pelo documento (só dígitos), aceitando gravação com ou sem máscara. */
export async function buscarPessoaPorDocumento(
  supabase: SupabaseClient,
  tipo: "PF" | "PJ",
  documentoDigits: string
): Promise<PessoaDocumentoRow | null> {
  const digits = normalizarDocumento(documentoDigits);
  if (!digits) return null;

  const mascarado = tipo === "PF" ? formatarCpfMascara(digits) : formatarCnpjMascara(digits);
  const variantes = [...new Set([digits, mascarado].filter(Boolean))];

  for (const doc of variantes) {
    const { data } = await supabase
      .from("hub_pessoas")
      .select("id, nome, codigo, tipo_pessoa, documento")
      .eq("documento", doc)
      .maybeSingle();
    if (data) return data as PessoaDocumentoRow;
  }

  return null;
}
