import type { PrefixoMercado } from "@/lib/crm/negocio-cadastro";
import type { EmpresaSegmento } from "@/lib/crm/empresa-cadastro";

export type TipoPessoaCadastro = "PF" | "PJ";

export type LeadOrigemCadastro =
  | "whatsapp"
  | "instagram"
  | "meta_ads"
  | "google_ads"
  | "linkedin"
  | "site"
  | "indicacao"
  | "outro";

export type SuperCadastroComercial = {
  mercados: string[];
  criar_lead: boolean;
  lead_origem?: LeadOrigemCadastro | null;
  /** Obrigatório quando lead_origem = indicacao — gravado em dados_extras. */
  indicado_por?: string | null;
  segmento?: EmpresaSegmento | null;
};

export type SuperCadastroInput = {
  tipo_pessoa: TipoPessoaCadastro;
  nome: string;
  nome_fantasia?: string;
  documento: string;
  telefone: string;
  email?: string | null;
  area_atuacao?: string | null;
  area_atuacao_outro?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  prefixo_mercado?: PrefixoMercado;
  comercial: SuperCadastroComercial;
};

export function emptySuperCadastroForm(tipo: TipoPessoaCadastro = "PF"): SuperCadastroInput {
  return {
    tipo_pessoa: tipo,
    nome: "",
    nome_fantasia: tipo === "PJ" ? "" : undefined,
    documento: "",
    telefone: "",
    email: "",
    area_atuacao: "",
    area_atuacao_outro: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    prefixo_mercado: tipo === "PJ" ? "GRL" : undefined,
    comercial: {
      mercados: [],
      criar_lead: false,
      lead_origem: "outro",
      segmento: "cliente",
    },
  };
}
