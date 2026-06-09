import { MERCADOS_PREFIXO, type PrefixoMercado } from "@/lib/crm/negocio-cadastro";
import { EMPRESA_SEGMENTOS, type EmpresaSegmento } from "@/lib/crm/empresa-cadastro";
import type { SuperCadastroInput } from "@/lib/crm/super-cadastro-form";
import { validarPessoaCadastro } from "@/lib/crm/pessoa-cadastro";
import { AREA_ATUACAO_OUTRO_VALUE } from "@/lib/crm/areas-atuacao";
import { cepValidoParaBusca } from "@/lib/crm/viacep";
import {
  mercadosLeadComPadrao,
  resolverNomeCadastro,
  resolverTelefoneCadastro,
  temIdentificadorMinimoCadastro,
} from "@/lib/crm/cadastro-flexivel";

const LEAD_ORIGENS = [
  "whatsapp",
  "instagram",
  "meta_ads",
  "google_ads",
  "linkedin",
  "site",
  "indicacao",
  "outro",
] as const;

export type SuperCadastroValidado = SuperCadastroInput & {
  tipo_pessoa: "PF" | "PJ";
  documento: string | null;
  nome: string;
  telefone: string;
  prefixo_mercado?: PrefixoMercado;
};

export function validarSuperCadastro(
  body: unknown
): { ok: true; data: SuperCadastroValidado } | { ok: false; erro: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, erro: "JSON inválido." };
  }
  const b = body as Record<string, unknown>;
  const tipo = b.tipo_pessoa;
  if (tipo !== "PF" && tipo !== "PJ") {
    return { ok: false, erro: "Selecione PF ou PJ." };
  }

  const comercialRaw = b.comercial;
  const comercial =
    comercialRaw && typeof comercialRaw === "object" && !Array.isArray(comercialRaw)
      ? (comercialRaw as Record<string, unknown>)
      : {};

  const mercadosRaw = Array.isArray(comercial.mercados)
    ? comercial.mercados
        .map((m) => String(m).trim().toUpperCase())
        .filter((m): m is PrefixoMercado => MERCADOS_PREFIXO.includes(m as PrefixoMercado))
    : [];

  const criar_lead = comercial.criar_lead !== false;
  const mercados = criar_lead ? mercadosLeadComPadrao(mercadosRaw) : mercadosRaw;

  const leadOrigem = String(comercial.lead_origem || "outro");
  if (!LEAD_ORIGENS.includes(leadOrigem as (typeof LEAD_ORIGENS)[number])) {
    return { ok: false, erro: "Origem do lead inválida." };
  }

  const indicadoPor = String(comercial.indicado_por ?? "").trim();
  if (criar_lead && leadOrigem === "indicacao" && indicadoPor.length < 2) {
    return { ok: false, erro: "Informe quem indicou (mínimo 2 caracteres)." };
  }

  let segmento: EmpresaSegmento | null = null;
  if (comercial.segmento) {
    const seg = String(comercial.segmento);
    if (!EMPRESA_SEGMENTOS.find((s) => s.value === seg)) {
      return { ok: false, erro: "Segmento inválido." };
    }
    segmento = seg as EmpresaSegmento;
  }

  const nomeInput = String(b.nome || "");
  const telefoneInput = String(b.telefone || "");
  const emailInput = b.email != null ? String(b.email) : null;

  if (!temIdentificadorMinimoCadastro({ nome: nomeInput, telefone: telefoneInput, email: emailInput })) {
    return {
      ok: false,
      erro: "Informe ao menos nome, telefone ou e-mail para identificar o contacto (campanha).",
    };
  }

  const pessoaVal = validarPessoaCadastro(
    {
      tipo_pessoa: tipo,
      nome: nomeInput,
      documento: String(b.documento || ""),
      telefone: telefoneInput,
      email: emailInput,
      empresa: tipo === "PJ" ? String(b.nome_fantasia || "") : null,
      area_atuacao: b.area_atuacao != null ? String(b.area_atuacao) : null,
      area_atuacao_outro:
        b.area_atuacao === AREA_ATUACAO_OUTRO_VALUE
          ? String(b.area_atuacao_outro || "")
          : null,
      cep: b.cep != null ? String(b.cep) : null,
      logradouro: b.logradouro != null ? String(b.logradouro) : null,
      numero: b.numero != null ? String(b.numero) : null,
      complemento: b.complemento != null ? String(b.complemento) : null,
      bairro: b.bairro != null ? String(b.bairro) : null,
      cidade: b.cidade != null ? String(b.cidade) : null,
      estado: b.estado != null ? String(b.estado) : null,
      origem: leadOrigem,
    },
    { flexivel: true }
  );

  if (!pessoaVal.ok) {
    return { ok: false, erro: pessoaVal.erro };
  }

  const cepRaw = (b.cep != null ? String(b.cep) : "").trim();
  if (cepRaw && !cepValidoParaBusca(cepRaw)) {
    return { ok: false, erro: "CEP inválido (use 8 dígitos)." };
  }

  let prefixo_mercado: PrefixoMercado | undefined;
  if (tipo === "PJ") {
    const prefixo = String(b.prefixo_mercado || mercados[0] || "GRL")
      .trim()
      .toUpperCase() as PrefixoMercado;
    if (!MERCADOS_PREFIXO.includes(prefixo)) {
      return { ok: false, erro: "Mercado principal inválido." };
    }
    prefixo_mercado = prefixo;
  }

  const nomeResolvido = resolverNomeCadastro({
    nome: nomeInput,
    telefone: telefoneInput,
    email: emailInput,
    tipo_pessoa: tipo,
  });
  const telResolvido = resolverTelefoneCadastro(telefoneInput) || "";

  const data: SuperCadastroValidado = {
    tipo_pessoa: tipo,
    nome: nomeResolvido,
    nome_fantasia:
      tipo === "PJ"
        ? String(b.nome_fantasia || "").trim() || undefined
        : undefined,
    documento: pessoaVal.data.documento ?? "",
    telefone: telResolvido,
    email: pessoaVal.data.email,
    area_atuacao: pessoaVal.data.area_atuacao,
    area_atuacao_outro: b.area_atuacao_outro != null ? String(b.area_atuacao_outro) : null,
    cep: pessoaVal.data.cep,
    logradouro: pessoaVal.data.logradouro,
    numero: pessoaVal.data.numero,
    complemento: pessoaVal.data.complemento,
    bairro: pessoaVal.data.bairro,
    cidade: pessoaVal.data.cidade,
    estado: pessoaVal.data.estado,
    prefixo_mercado,
    comercial: {
      mercados,
      criar_lead,
      lead_origem: leadOrigem as SuperCadastroInput["comercial"]["lead_origem"],
      indicado_por: leadOrigem === "indicacao" ? indicadoPor : null,
      segmento: segmento ?? "cliente",
    },
  };

  return { ok: true, data };
}
