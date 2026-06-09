"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Settings2 } from "lucide-react";
import type { IntegracaoStatus } from "@/app/api/crm/integracoes/status/route";
import { CrmIntegracaoSideover } from "@/components/crm/CrmIntegracaoSideover";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { fetchHubIntegracoes, type HubIntegracaoRow } from "@/lib/hub/fetch-hub-integracoes";
import { FERRAMENTAS_LIGHT as L } from "@/lib/hub/ferramentas-catalogo-ui";

type IntegracaoCardStatus = IntegracaoStatus["status"];

const STATUS_LABELS: Record<IntegracaoCardStatus, { label: string; cor: string }> = {
  conectado: { label: "Conectado", cor: L.ok },
  nao_configurado: { label: "Não configurado", cor: "#484f58" },
  erro: { label: "Erro", cor: L.danger },
  em_breve: { label: "Em breve", cor: L.accent },
};

const ICONS: Record<string, string> = {
  whatsapp: "💬",
  windsor: "📈",
  mistral: "✨",
  meta: "📘",
  google_ads: "🔴",
  ga4: "📊",
};

type CardItem = {
  key: string;
  nome: string;
  descricao: string;
  status: IntegracaoCardStatus;
  detail?: string;
  href?: string;
  fonte: "ambiente" | "tenant";
  hubRow?: HubIntegracaoRow;
};

function hubRowStatus(row: HubIntegracaoRow): IntegracaoCardStatus {
  if (row.ativo === false) return "nao_configurado";
  if (row.tipo_auth === "webhook_generico") {
    return row.webhook_url?.trim() ? "conectado" : "nao_configurado";
  }
  if (row.tipo_auth === "bearer") {
    return row.bearer_token?.trim() ? "conectado" : "nao_configurado";
  }
  return row.api_key?.trim() ? "conectado" : "nao_configurado";
}

export function CrmFerramentasIntegracoesPanel() {
  const [statusItems, setStatusItems] = useState<IntegracaoStatus[]>([]);
  const [hubRows, setHubRows] = useState<HubIntegracaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [apiHubDisponivel, setApiHubDisponivel] = useState(true);
  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [focusIntegracaoId, setFocusIntegracaoId] = useState<string | null>(null);
  const [focusHubId, setFocusHubId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const headers = internalApiHeaders();
      const [resStatus, hubList] = await Promise.all([
        fetch("/api/crm/integracoes/status", { headers }),
        fetchHubIntegracoes(headers).catch((e) => {
          if (e instanceof Error && e.message.includes("404")) return [];
          throw e;
        }),
      ]);

      const statusJson = (await resStatus.json().catch(() => ({}))) as { integracoes?: IntegracaoStatus[] };
      if (!resStatus.ok) {
        throw new Error(
          statusJson && typeof statusJson === "object" && "error" in statusJson
            ? String((statusJson as { error?: string }).error)
            : "Falha ao carregar estado das integrações."
        );
      }
      setStatusItems(statusJson.integracoes ?? []);
      setHubRows(hubList);
      setApiHubDisponivel(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar integrações.";
      setErro(msg);
      if (msg.toLowerCase().includes("404") || msg.toLowerCase().includes("não existe")) {
        setApiHubDisponivel(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const cards = useMemo((): CardItem[] => {
    const ambiente: CardItem[] = statusItems.map((s) => ({
      key: `env:${s.id}`,
      nome: s.nome,
      descricao: s.descricao,
      status: s.status,
      detail: s.detail,
      href: s.href,
      fonte: "ambiente",
    }));

    const tenant: CardItem[] = hubRows.map((r) => ({
      key: `hub:${r.id}`,
      nome: r.nome?.trim() || r.integracao_id,
      descricao: `Integração tenant · ${r.tipo_auth}`,
      status: hubRowStatus(r),
      detail: r.integracao_id,
      fonte: "tenant",
      hubRow: r,
    }));

    return [...ambiente, ...tenant];
  }, [statusItems, hubRows]);

  const abrirConfigurar = (card: CardItem) => {
    if (card.fonte === "tenant" && card.hubRow) {
      setFocusHubId(card.hubRow.id);
      setFocusIntegracaoId(card.hubRow.integracao_id);
    } else {
      setFocusHubId(null);
      setFocusIntegracaoId(card.hubRow?.integracao_id ?? card.detail ?? null);
    }
    setSideoverOpen(true);
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="m-0 text-base font-bold" style={{ color: L.text }}>
          Integrações
        </h2>
        <p className="mt-1 m-0 text-sm" style={{ color: L.muted }}>
          Credenciais de ambiente (UAZAPI, Windsor, Mistral) e integrações configuráveis do tenant para ferramentas
          externas.
        </p>
      </div>

      {!apiHubDisponivel ? (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm"
          style={{ background: "#fff8e6", border: `1px solid ${L.accent}55`, color: L.text }}
        >
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: L.accent }} />
          <span>
            API <code>/api/hub/integracoes</code> ainda não disponível. Integrações de ambiente continuam visíveis;
            configure credenciais tenant quando o backend estiver pronto.
          </span>
        </div>
      ) : null}

      {erro ? (
        <div
          className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{ background: "#b3261e12", border: `1px solid ${L.danger}44`, color: L.danger }}
        >
          {erro}
        </div>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm" style={{ color: L.muted }}>
          <Loader2 size={16} className="animate-spin" />
          A carregar…
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const st = STATUS_LABELS[card.status];
            const iconKey = card.hubRow?.integracao_id ?? card.detail ?? "";
            const podeConfigurar = card.fonte === "tenant" || card.status !== "em_breve";
            return (
              <div
                key={card.key}
                className="flex flex-col gap-3 rounded-xl border p-4"
                style={{ background: L.surface, borderColor: L.border }}
              >
                <div className="flex gap-3">
                  <span className="text-2xl">{ICONS[iconKey] ?? "🔌"}</span>
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-bold" style={{ color: L.text }}>
                      {card.nome}
                    </p>
                    <p className="m-0 text-xs" style={{ color: L.muted }}>
                      {card.descricao}
                    </p>
                    {card.fonte === "tenant" ? (
                      <span
                        className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ background: L.accentMuted, color: L.accent }}
                      >
                        Tenant
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.cor }} />
                  <span className="text-xs font-semibold" style={{ color: st.cor }}>
                    {st.label}
                  </span>
                </div>
                {card.detail && card.fonte === "ambiente" ? (
                  <p className="m-0 text-[11px]" style={{ color: L.faint }}>
                    {card.detail}
                  </p>
                ) : null}
                {podeConfigurar ? (
                  <button
                    type="button"
                    onClick={() => abrirConfigurar(card)}
                    className="mt-auto flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold"
                    style={{
                      background: L.accentMuted,
                      color: L.accent,
                      border: `1px solid ${L.border}`,
                      cursor: "pointer",
                    }}
                  >
                    <Settings2 size={14} />
                    {card.fonte === "tenant" && card.status === "conectado" ? "Editar" : "Configurar"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <CrmIntegracaoSideover
        open={sideoverOpen}
        onClose={() => {
          setSideoverOpen(false);
          setFocusIntegracaoId(null);
          setFocusHubId(null);
        }}
        onSaved={() => void carregar()}
        initialIntegracaoId={focusIntegracaoId}
        initialHubId={focusHubId}
      />
    </div>
  );
}
