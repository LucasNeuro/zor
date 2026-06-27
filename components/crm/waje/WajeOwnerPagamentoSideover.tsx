"use client";

import { useState } from "react";
import { Banknote, ExternalLink, Loader2, QrCode } from "lucide-react";
import { CrmRetrofitSideoverShell } from "@/components/crm/CrmRetrofitSideoverShell";
import { RF_ACCENT } from "@/lib/crm/crm-retrofit-dark-theme";
import { rfBodyOnDarkStyle } from "@/lib/crm/crm-retrofit-dark-theme";
import { WajeOwnerStatusBadge } from "@/components/crm/waje/WajeOwnerUi";
import { opsApiHeaders } from "@/lib/ops-api-headers-client";

export type PagamentoRow = {
  id: string;
  tenant_id?: string;
  tenant_nome: string | null;
  competencia: string;
  valor_reais: number;
  valor_centavos?: number;
  status: string;
  vencimento: string | null;
  pago_em: string | null;
  cora_invoice_id?: string | null;
  cora_boleto_url?: string | null;
  cora_pix_emv?: string | null;
  boleto_arquivo_url?: string | null;
  cora_status?: string | null;
  cora_erro?: string | null;
  whatsapp_enviado_em?: string | null;
  whatsapp_telefone?: string | null;
};

type Props = {
  open: boolean;
  pagamento: PagamentoRow | null;
  onClose: () => void;
  onUpdated: (p: PagamentoRow) => void;
};

function formatarData(v: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("pt-BR");
  } catch {
    return v;
  }
}

function formatarMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusVariant(s: string): "pendente" | "pago" | "atrasado" | "inativo" | "neutral" {
  const x = s.toLowerCase();
  if (x === "pago") return "pago";
  if (x === "atrasado") return "atrasado";
  if (x === "cancelado") return "inativo";
  if (x === "pendente") return "pendente";
  return "neutral";
}

export function WajeOwnerPagamentoSideover({ open, pagamento, onClose, onUpdated }: Props) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function patchStatus(status: string) {
    if (!pagamento) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/ops/pagamentos/${pagamento.id}`, {
        method: "PATCH",
        headers: { ...(await opsApiHeaders()), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as { data?: PagamentoRow; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Falha ao atualizar.");
      onUpdated({
        ...pagamento,
        ...json.data,
        tenant_nome: pagamento.tenant_nome,
        valor_reais: json.data.valor_reais ?? pagamento.valor_reais,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const boletoUrl = pagamento?.boleto_arquivo_url ?? pagamento?.cora_boleto_url ?? null;
  const temLegado = Boolean(pagamento?.cora_invoice_id || boletoUrl);

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      kindLabel="Mensalidade"
      title={pagamento?.tenant_nome ?? "Pagamento"}
      subtitle={
        pagamento?.competencia
          ? `Competência ${formatarData(pagamento.competencia)}`
          : undefined
      }
      icon={Banknote}
      footer={
        pagamento ? (
          <div className="flex w-full flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="rounded-xl border px-4 py-2.5 text-xs font-bold disabled:opacity-50"
              style={{ borderColor: "rgba(146,255,0,0.25)", color: "#b8d4bc" }}
            >
              Fechar
            </button>
            {pagamento.status !== "pago" ? (
              <button
                type="button"
                disabled={salvando}
                onClick={() => void patchStatus("pago")}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-50"
                style={{ background: RF_ACCENT, color: "#0b1f10" }}
              >
                {salvando ? <Loader2 size={14} className="animate-spin" /> : null}
                Marcar como pago
              </button>
            ) : null}
          </div>
        ) : null
      }
    >
      {!pagamento ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="animate-spin" style={{ color: RF_ACCENT }} size={22} />
        </div>
      ) : (
        <div className="space-y-5">
          <WajeOwnerStatusBadge variant={statusVariant(pagamento.status)} />

          {erro ? (
            <p className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {erro}
            </p>
          ) : null}

          <dl className="grid gap-3 text-sm">
            {[
              ["Valor", formatarMoeda(pagamento.valor_reais)],
              ["Vencimento", formatarData(pagamento.vencimento)],
              ["Pago em", formatarData(pagamento.pago_em)],
              ...(pagamento.cora_invoice_id
                ? [["Ref. legado (Cora)", pagamento.cora_invoice_id] as const]
                : []),
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
                <dt style={{ color: "#7a9a7e" }}>{k}</dt>
                <dd className="break-all font-medium" style={{ color: "#e8f5e9" }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-2">
            {pagamento.status === "pendente" ? (
              <button
                type="button"
                disabled={salvando}
                onClick={() => void patchStatus("atrasado")}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                style={{ borderColor: "rgba(248,81,73,0.35)", color: "#f85149" }}
              >
                Marcar atrasado
              </button>
            ) : null}
            {pagamento.status !== "cancelado" ? (
              <button
                type="button"
                disabled={salvando}
                onClick={() => void patchStatus("cancelado")}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                style={{ borderColor: "rgba(146,255,0,0.2)", color: "#7a9a7e" }}
              >
                Cancelar
              </button>
            ) : null}
          </div>

          <div
            className="rounded-xl border p-4"
            style={{ borderColor: "rgba(146,255,0,0.12)", background: "rgba(6,13,8,0.5)" }}
          >
            <p className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: RF_ACCENT }}>
              Cobrança bancária
            </p>
            <p className="mb-3 text-xs" style={rfBodyOnDarkStyle()}>
              Emissão via Cora descontinuada. Nova integração de pagamentos em breve — use «Marcar como
              pago» para registar pagamentos manuais.
            </p>
            {boletoUrl ? (
              <a
                href={boletoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold underline"
                style={{ color: RF_ACCENT }}
              >
                <ExternalLink size={13} />
                Abrir boleto PDF{temLegado ? " (legado)" : ""}
              </a>
            ) : null}
            {pagamento.cora_pix_emv ? (
              <p className="mb-2 break-all text-[10px]" style={{ color: "#b8d4bc" }}>
                <QrCode size={12} className="mr-1 inline" />
                Pix copia e cola (legado) disponível no registo
              </p>
            ) : null}
          </div>
        </div>
      )}
    </CrmRetrofitSideoverShell>
  );
}
