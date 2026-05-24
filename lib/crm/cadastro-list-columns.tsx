"use client";

import type { ReactNode } from "react";
import { CrmTelefoneCell } from "@/components/crm/CrmTelefoneCell";
import { labelAreaAtuacao } from "@/lib/crm/areas-atuacao";
import { labelEmpresaSegmento } from "@/lib/crm/empresa-cadastro";
import {
  formatarCnpjMascara,
  formatarCpfMascara,
  normalizarDocumento,
} from "@/lib/crm/documento-brasil";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";

export type CadastroListaColumn<T> = {
  id: string;
  label: string;
  minWidth?: number;
  mono?: boolean;
  render: (row: T) => ReactNode;
};

function cell(v: unknown, mono = false): ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-[#484f58]">—</span>;
  if (typeof v === "boolean") {
    return (
      <span className={v ? "text-[#22C55E]" : "text-[#EF4444]"}>{v ? "Sim" : "Não"}</span>
    );
  }
  const s = String(v);
  if (mono) {
    return <span className="font-mono text-xs text-[#c9a24a]/90">{s}</span>;
  }
  return <span className="text-[#e6edf3]">{s}</span>;
}

function formatData(v: unknown): ReactNode {
  if (!v) return cell(null);
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return cell(v);
  return cell(
    d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}

function formatDocumento(tipo: unknown, doc: unknown): ReactNode {
  if (!doc) return cell(null);
  const d = normalizarDocumento(String(doc));
  if (d.length === 11) return cell(formatarCpfMascara(d));
  if (d.length === 14) return cell(formatarCnpjMascara(d));
  return cell(doc);
}

function formatDadosExtras(v: unknown): ReactNode {
  if (!v || typeof v !== "object") return cell(null);
  const o = v as Record<string, unknown>;
  const indicado =
    typeof o.indicado_por === "string" && o.indicado_por.trim()
      ? `Indicação: ${o.indicado_por.trim()}`
      : null;
  if (indicado) return cell(indicado);
  const mercados = Array.isArray(o.mercados) ? o.mercados.join(", ") : null;
  if (mercados) return cell(mercados);
  try {
    const raw = JSON.stringify(o);
    if (raw.length <= 80) return cell(raw);
    return <span className="text-xs text-[#8b949e]" title={raw}>{raw.slice(0, 77)}…</span>;
  } catch {
    return cell(null);
  }
}

export type PessoaListaRow = Record<string, unknown> & {
  id: string;
  codigo?: string | null;
  nome: string;
};

export type EmpresaListaRow = Record<string, unknown> & {
  id: string;
  razao_social: string;
  codigo?: string | null;
};

const COLUNAS_PESSOA_LISTA: CadastroListaColumn<PessoaListaRow>[] = [
    {
      id: "codigo",
      label: "Código",
      minWidth: 128,
      mono: true,
      render: (p) => cell(p.codigo, true),
    },
    {
      id: "tipo_pessoa",
      label: "Tipo",
      minWidth: 56,
      render: (p) => cell(p.tipo_pessoa),
    },
    {
      id: "tipo",
      label: "Perfil",
      minWidth: 88,
      render: (p) => cell(p.tipo),
    },
    {
      id: "documento",
      label: "CPF/CNPJ",
      minWidth: 140,
      render: (p) => formatDocumento(p.tipo_pessoa, p.documento),
    },
    {
      id: "telefone",
      label: "Telefone",
      minWidth: 200,
      render: (p) => <CrmTelefoneCell telefone={String(p.telefone ?? "")} />,
    },
    {
      id: "email",
      label: "E-mail",
      minWidth: 180,
      render: (p) => cell(p.email),
    },
    {
      id: "empresa",
      label: "Empresa",
      minWidth: 140,
      render: (p) => cell(p.empresa),
    },
    {
      id: "origem",
      label: "Origem",
      minWidth: 100,
      render: (p) => cell(p.origem),
    },
    {
      id: "area_atuacao",
      label: "Área",
      minWidth: 120,
      render: (p) => cell(labelAreaAtuacao(String(p.area_atuacao || ""))),
    },
    {
      id: "cep",
      label: "CEP",
      minWidth: 100,
      render: (p) => cell(p.cep),
    },
    {
      id: "logradouro",
      label: "Logradouro",
      minWidth: 160,
      render: (p) => cell(p.logradouro),
    },
    {
      id: "numero",
      label: "Número",
      minWidth: 72,
      render: (p) => cell(p.numero),
    },
    {
      id: "complemento",
      label: "Complemento",
      minWidth: 120,
      render: (p) => cell(p.complemento),
    },
    {
      id: "bairro",
      label: "Bairro",
      minWidth: 120,
      render: (p) => cell(p.bairro),
    },
    {
      id: "cidade",
      label: "Cidade",
      minWidth: 120,
      render: (p) => cell(p.cidade),
    },
    {
      id: "estado",
      label: "UF",
      minWidth: 48,
      render: (p) => cell(p.estado),
    },
    {
      id: "tenant_id",
      label: "Tenant",
      minWidth: 280,
      mono: true,
      render: (p) => cell(p.tenant_id, true),
    },
    {
      id: "dados_extras",
      label: "Extras",
      minWidth: 160,
      render: (p) => formatDadosExtras(p.dados_extras),
    },
    {
      id: "criado_em",
      label: "Criado em",
      minWidth: 140,
      render: (p) => formatData(p.criado_em),
    },
    {
      id: "atualizado_em",
      label: "Atualizado",
      minWidth: 140,
      render: (p) => formatData(p.atualizado_em),
    },
];

export function colunasPessoaLista(): CadastroListaColumn<PessoaListaRow>[] {
  return COLUNAS_PESSOA_LISTA;
}

const COLUNAS_EMPRESA_LISTA: CadastroListaColumn<EmpresaListaRow>[] = [
    {
      id: "codigo",
      label: "Código",
      minWidth: 120,
      mono: true,
      render: (e) => cell(e.codigo, true),
    },
    {
      id: "nome_fantasia",
      label: "Nome fantasia",
      minWidth: 160,
      render: (e) => cell(e.nome_fantasia),
    },
    {
      id: "cnpj",
      label: "CNPJ",
      minWidth: 140,
      render: (e) => {
        const d = e.cnpj ? normalizarDocumento(String(e.cnpj)) : "";
        return d.length === 14 ? cell(formatarCnpjMascara(d)) : cell(e.cnpj);
      },
    },
    {
      id: "segmento",
      label: "Segmento",
      minWidth: 110,
      render: (e) => cell(labelEmpresaSegmento(String(e.segmento || ""))),
    },
    {
      id: "prefixo_mercado",
      label: "Mercado",
      minWidth: 100,
      render: (e) => cell(labelMercadoPrefixo(String(e.prefixo_mercado || ""))),
    },
    {
      id: "telefone",
      label: "Telefone",
      minWidth: 200,
      render: (e) => <CrmTelefoneCell telefone={String(e.telefone ?? "")} />,
    },
    {
      id: "email",
      label: "E-mail",
      minWidth: 180,
      render: (e) => cell(e.email),
    },
    {
      id: "cep",
      label: "CEP",
      minWidth: 100,
      render: (e) => cell(e.cep),
    },
    {
      id: "logradouro",
      label: "Logradouro",
      minWidth: 160,
      render: (e) => cell(e.logradouro),
    },
    {
      id: "numero",
      label: "Número",
      minWidth: 72,
      render: (e) => cell(e.numero),
    },
    {
      id: "complemento",
      label: "Complemento",
      minWidth: 120,
      render: (e) => cell(e.complemento),
    },
    {
      id: "bairro",
      label: "Bairro",
      minWidth: 120,
      render: (e) => cell(e.bairro),
    },
    {
      id: "cidade",
      label: "Cidade",
      minWidth: 120,
      render: (e) => cell(e.cidade),
    },
    {
      id: "estado",
      label: "UF",
      minWidth: 48,
      render: (e) => cell(e.estado),
    },
    {
      id: "ativo",
      label: "Ativo",
      minWidth: 64,
      render: (e) => cell(e.ativo),
    },
    {
      id: "acesso_habilitado",
      label: "Acesso",
      minWidth: 72,
      render: (e) => cell(e.acesso_habilitado),
    },
    {
      id: "acesso_habilitado_em",
      label: "Acesso em",
      minWidth: 140,
      render: (e) => formatData(e.acesso_habilitado_em),
    },
    {
      id: "tenant_id",
      label: "Tenant",
      minWidth: 280,
      mono: true,
      render: (e) => cell(e.tenant_id, true),
    },
    {
      id: "criado_em",
      label: "Criado em",
      minWidth: 140,
      render: (e) => formatData(e.criado_em),
    },
    {
      id: "atualizado_em",
      label: "Atualizado",
      minWidth: 140,
      render: (e) => formatData(e.atualizado_em),
    },
];

export function colunasEmpresaLista(): CadastroListaColumn<EmpresaListaRow>[] {
  return COLUNAS_EMPRESA_LISTA;
}
