"use client";

import { Bot, Loader2, Power } from "lucide-react";
import { CrmRetrofitSideoverShell } from "@/components/crm/CrmRetrofitSideoverShell";
import { RF_ACCENT, rfBodyOnDarkStyle } from "@/lib/crm/crm-retrofit-dark-theme";
import { WajeOwnerStatusBadge } from "@/components/crm/waje/WajeOwnerUi";
import { opsApiHeaders } from "@/lib/ops-api-headers-client";

export type AgenteRow = {
  agente_slug: string;
  nome: string;
  cargo: string | null;
  ativo: boolean;
  tenant_nome: string | null;
  tenant_slug: string | null;
  tenant_id?: string | null;
  whatsapp_instancia: boolean;
  whatsapp_conectado: boolean;
  whatsapp_status: string | null;
  arquivado_em: string | null;
  criado_em?: string | null;
};

type Props = {
  open: boolean;
  agente: AgenteRow | null;
  onClose: () => void;
  onUpdated: (agente: AgenteRow) => void;
};

export function WajeOwnerAgenteSideover({ open, agente, onClose, onUpdated }: Props) {
  async function alternarAtivo() {
    if (!agente || agente.arquivado_em) return;
    const res = await fetch(`/api/ops/agentes/${encodeURIComponent(agente.agente_slug)}`, {
      method: "PATCH",
      headers: { ...(await opsApiHeaders()), "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ativo: !agente.ativo }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Falha ao atualizar.");
    onUpdated({ ...agente, ativo: !agente.ativo });
  }

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      kindLabel="Plataforma"
      title={agente?.nome ?? "Agente"}
      subtitle={agente?.tenant_nome ?? undefined}
      icon={Bot}
      footer={
        agente && !agente.arquivado_em ? (
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-4 py-2.5 text-xs font-bold"
              style={{ borderColor: "rgba(146,255,0,0.25)", color: "#b8d4bc" }}
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => void alternarAtivo().then(onClose).catch(() => {})}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"
              style={{ background: RF_ACCENT, color: "#0b1f10" }}
            >
              <Power size={14} />
              {agente.ativo ? "Desativar agente" : "Ativar agente"}
            </button>
          </div>
        ) : null
      }
    >
      {!agente ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="animate-spin" style={{ color: RF_ACCENT }} size={22} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {agente.arquivado_em ? (
              <WajeOwnerStatusBadge variant="inativo" label="Arquivado" />
            ) : (
              <WajeOwnerStatusBadge variant={agente.ativo ? "ativo" : "inativo"} />
            )}
            {agente.whatsapp_conectado ? (
              <WajeOwnerStatusBadge variant="ativo" label="WhatsApp conectado" />
            ) : agente.whatsapp_instancia ? (
              <WajeOwnerStatusBadge variant="pendente" label="Instância WA" />
            ) : (
              <WajeOwnerStatusBadge variant="neutral" label="Sem WhatsApp" />
            )}
          </div>
          <dl className="grid gap-3 text-sm">
            {[
              ["Slug", agente.agente_slug],
              ["Cargo", agente.cargo ?? "—"],
              ["Tenant", agente.tenant_nome ?? "—"],
              ["Slug tenant", agente.tenant_slug ?? "—"],
              ["Status WA", agente.whatsapp_status ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
                <dt style={{ color: "#7a9a7e" }}>{k}</dt>
                <dd className="break-all font-medium" style={{ color: "#e8f5e9" }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <p style={rfBodyOnDarkStyle()}>
            Visão global do agente em todos os tenants. Desativar impede respostas automáticas sem remover
            configuração.
          </p>
        </div>
      )}
    </CrmRetrofitSideoverShell>
  );
}
