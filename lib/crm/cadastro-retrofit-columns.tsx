"use client";

import type { ReactNode } from "react";
import type { CrmResizableColumn } from "@/components/crm/CrmResizableDataTable";
import { CrmTelefoneCell } from "@/components/crm/CrmTelefoneCell";
import {
  crmTableIdBadge,
  crmTableStatusPill,
} from "@/components/crm/CrmRetrofitTablePanel";
import { labelAreaAtuacao } from "@/lib/crm/areas-atuacao";
import type { EmpresaListaRow, PessoaListaRow } from "@/lib/crm/cadastro-list-columns";
import { labelEmpresaSegmento } from "@/lib/crm/empresa-cadastro";
import {
  formatarCnpjMascara,
  formatarCpfMascara,
  normalizarDocumento,
} from "@/lib/crm/documento-brasil";

function wajeText(v: unknown): ReactNode {
  if (v === null || v === undefined || v === "") {
    return <span className="text-[#8aa195]">—</span>;
  }
  return <span className="text-sm text-[#0b2210]">{String(v)}</span>;
}

function wajeData(v: unknown): ReactNode {
  if (!v) return wajeText(null);
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return wajeText(v);
  return wajeText(
    d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}

function wajeDocumento(tipo: unknown, doc: unknown): ReactNode {
  if (!doc) return wajeText(null);
  const d = normalizarDocumento(String(doc));
  if (d.length === 11) return wajeText(formatarCpfMascara(d));
  if (d.length === 14) return wajeText(formatarCnpjMascara(d));
  return wajeText(doc);
}

export function colunasPessoaRetrofit(): CrmResizableColumn<PessoaListaRow>[] {
  return [
    {
      id: "nome",
      label: "Nome",
      defaultWidth: 200,
      minWidth: 140,
      render: (p) => <span className="text-sm font-semibold text-[#0b2210]">{p.nome}</span>,
    },
    {
      id: "codigo",
      label: "Código",
      defaultWidth: 120,
      minWidth: 96,
      render: (p) =>
        p.codigo ? crmTableIdBadge(String(p.codigo), "green") : wajeText(null),
    },
    {
      id: "tipo_pessoa",
      label: "Tipo",
      defaultWidth: 72,
      minWidth: 56,
      render: (p) => {
        const s = String(p.tipo_pessoa ?? "").toUpperCase();
        if (!s) return wajeText(null);
        return crmTableStatusPill(s === "PJ" ? "Emp" : s, true);
      },
    },
    {
      id: "documento",
      label: "CPF/CNPJ",
      defaultWidth: 140,
      minWidth: 120,
      render: (p) => wajeDocumento(p.tipo_pessoa, p.documento),
    },
    {
      id: "telefone",
      label: "Telefone",
      defaultWidth: 160,
      minWidth: 120,
      render: (p) => <CrmTelefoneCell telefone={String(p.telefone ?? "")} />,
    },
    {
      id: "email",
      label: "E-mail",
      defaultWidth: 180,
      minWidth: 140,
      render: (p) => wajeText(p.email),
    },
    {
      id: "origem",
      label: "Origem",
      defaultWidth: 110,
      minWidth: 88,
      render: (p) =>
        p.origem ? crmTableStatusPill(String(p.origem), true) : wajeText(null),
    },
    {
      id: "area_atuacao",
      label: "Área",
      defaultWidth: 120,
      minWidth: 96,
      render: (p) => wajeText(labelAreaAtuacao(String(p.area_atuacao || ""))),
    },
    {
      id: "cidade",
      label: "Cidade",
      defaultWidth: 120,
      minWidth: 96,
      render: (p) => wajeText(p.cidade),
    },
    {
      id: "estado",
      label: "UF",
      defaultWidth: 56,
      minWidth: 48,
      render: (p) => wajeText(p.estado),
    },
    {
      id: "criado_em",
      label: "Criado em",
      defaultWidth: 140,
      minWidth: 120,
      render: (p) => wajeData(p.criado_em),
    },
  ];
}

export function colunasEmpresaRetrofit(): CrmResizableColumn<EmpresaListaRow>[] {
  return [
    {
      id: "razao_social",
      label: "Razão social",
      defaultWidth: 220,
      minWidth: 160,
      render: (e) => (
        <span className="text-sm font-semibold text-[#0b2210]">{e.razao_social}</span>
      ),
    },
    {
      id: "codigo",
      label: "Código",
      defaultWidth: 120,
      minWidth: 96,
      render: (e) =>
        e.codigo ? crmTableIdBadge(String(e.codigo), "green") : wajeText(null),
    },
    {
      id: "nome_fantasia",
      label: "Nome fantasia",
      defaultWidth: 160,
      minWidth: 120,
      render: (e) => wajeText(e.nome_fantasia),
    },
    {
      id: "cnpj",
      label: "CNPJ",
      defaultWidth: 140,
      minWidth: 120,
      render: (e) => {
        const d = e.cnpj ? normalizarDocumento(String(e.cnpj)) : "";
        return d.length === 14 ? wajeText(formatarCnpjMascara(d)) : wajeText(e.cnpj);
      },
    },
    {
      id: "segmento",
      label: "Segmento",
      defaultWidth: 120,
      minWidth: 96,
      render: (e) => wajeText(labelEmpresaSegmento(String(e.segmento || ""))),
    },
    {
      id: "telefone",
      label: "Telefone",
      defaultWidth: 160,
      minWidth: 120,
      render: (e) => <CrmTelefoneCell telefone={String(e.telefone ?? "")} />,
    },
    {
      id: "email",
      label: "E-mail",
      defaultWidth: 180,
      minWidth: 140,
      render: (e) => wajeText(e.email),
    },
    {
      id: "cidade",
      label: "Cidade",
      defaultWidth: 120,
      minWidth: 96,
      render: (e) => wajeText(e.cidade),
    },
    {
      id: "estado",
      label: "UF",
      defaultWidth: 56,
      minWidth: 48,
      render: (e) => wajeText(e.estado),
    },
    {
      id: "ativo",
      label: "Status",
      defaultWidth: 88,
      minWidth: 72,
      render: (e) =>
        crmTableStatusPill(e.ativo === false ? "Inativo" : "Ativo", e.ativo !== false),
    },
    {
      id: "criado_em",
      label: "Criado em",
      defaultWidth: 140,
      minWidth: 120,
      render: (e) => wajeData(e.criado_em),
    },
  ];
}
