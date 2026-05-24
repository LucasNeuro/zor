"use client";

import type { ReactNode } from "react";
import type { CadastroListaColumn } from "@/lib/crm/cadastro-list-columns";
import { CrmTelefoneCell } from "@/components/crm/CrmTelefoneCell";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";
import type { ParceiroListaRow } from "@/hooks/useCrmListQueries";

export const ESTAGIO_CAPTACAO_LABEL: Record<string, string> = {
  interessado: "Interessado",
  contato_feito: "Contato feito",
  proposta_enviada: "Proposta enviada",
  documentos_pendentes: "Docs pendentes",
  aguardando_treinamento: "Aguard. treino",
  concluido: "Concluído",
};

const STATUS_LABEL: Record<string, string> = {
  captacao: "Captação",
  em_homologacao: "Homologação",
  homologado: "Homologado",
};

function cell(v: unknown, mono = false): ReactNode {
  if (v === null || v === undefined || v === "") return <span className="text-[#484f58]">—</span>;
  const s = String(v);
  if (mono) return <span className="font-mono text-xs text-[#c9a24a]/90">{s}</span>;
  return <span className="text-[#e6edf3]">{s}</span>;
}

function labelEstagio(p: ParceiroListaRow): string {
  if (p.status === "homologado") return "Homologado";
  if (p.status === "em_homologacao") {
    return p.hub_parceiros_homologacao?.estagio
      ? String(p.hub_parceiros_homologacao.estagio)
      : "Em homologação";
  }
  const id = p.hub_parceiros_captacao?.estagio || "interessado";
  return ESTAGIO_CAPTACAO_LABEL[id] || id;
}

function localParceiro(p: ParceiroListaRow): string {
  const parts = [p.cidade, p.estado].filter(Boolean);
  return parts.length ? parts.join("/") : "";
}

export function colunasParceiroLista(): CadastroListaColumn<ParceiroListaRow>[] {
  return [
    {
      id: "codigo",
      label: "Código",
      minWidth: 128,
      mono: true,
      render: (p) => cell(p.codigo, true),
    },
    {
      id: "status",
      label: "Status",
      minWidth: 100,
      render: (p) => cell(STATUS_LABEL[p.status] || p.status),
    },
    {
      id: "estagio",
      label: "Estágio",
      minWidth: 120,
      render: (p) => cell(labelEstagio(p)),
    },
    {
      id: "especialidade",
      label: "Especialidade",
      minWidth: 120,
      render: (p) => cell(p.especialidade),
    },
    {
      id: "local",
      label: "Local",
      minWidth: 100,
      render: (p) => cell(localParceiro(p) || null),
    },
    {
      id: "mercado",
      label: "Mercado",
      minWidth: 100,
      render: (p) =>
        p.mercado ? cell(labelMercadoPrefixo(String(p.mercado)) || p.mercado) : cell(null),
    },
    {
      id: "modulo",
      label: "Módulos",
      minWidth: 120,
      render: (p) => {
        const concluidos =
          p.hub_parceiros_homologacao?.modulos_concluidos ??
          p.hub_parceiros_modulos?.filter((m) => m.status === "concluido").length ??
          p.modulo_atual;
        return (
          <div>
            <span className="text-xs font-semibold text-[#e6edf3]">
              {concluidos}/{8}
            </span>
            <div className="mt-1 flex gap-0.5">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: i < concluidos ? "#003b26" : "#21262d",
                  }}
                />
              ))}
            </div>
          </div>
        );
      },
    },
    {
      id: "comissao",
      label: "Comissão",
      minWidth: 80,
      render: (p) => cell(`${p.comissao_pct}%`),
    },
    {
      id: "leads",
      label: "Leads",
      minWidth: 100,
      render: (p) => (
        <span className="text-xs text-[#8b949e]">
          <span className="text-[#c9a24a]">{p.total_leads_recebidos}</span>
          {" / "}
          <span className="text-[#34d399]">{p.total_leads_convertidos}</span>
        </span>
      ),
    },
    {
      id: "telefone",
      label: "Telefone",
      minWidth: 150,
      render: (p) =>
        p.telefone ? <CrmTelefoneCell telefone={p.telefone} /> : cell(null),
    },
    {
      id: "email",
      label: "E-mail",
      minWidth: 160,
      render: (p) => cell(p.email),
    },
  ];
}
