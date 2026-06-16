"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, ChevronRight, Plus } from "lucide-react";
import {
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
} from "@/components/crm/CrmSideoverActionGroup";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_LIGHT_BORDER,
  RF_LIGHT_BORDER_STRONG,
  RF_LIGHT_PANEL,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_PRIMARY,
  RF_LIGHT_TEXT_SECONDARY,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfSubheadingStyle,
  type CrmSideoverTheme,
} from "@/lib/crm/crm-retrofit-dark-theme";

export type LeadNegocioListItem = {
  id: string;
  codigo: string | null;
  titulo: string;
  prefixo_mercado: string;
  status: string;
  etapa: string;
  valor_estimado: number | null;
  valor_fechado: number | null;
  data_previsao_fechamento: string | null;
  data_entrada?: string | null;
  data_entrega?: string | null;
  criado_em: string;
  atualizado_em: string;
};

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  ganho: "Ganho",
  perdido: "Perdido",
};

const STATUS_COLOR: Record<string, string> = {
  aberto: RF_ACCENT,
  ganho: "#3fb950",
  perdido: "#f85149",
};

function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

type Props = {
  leadId: string;
  theme?: CrmSideoverTheme;
  onOpenNegocio?: (negocioId: string) => void;
  onCreateNegocio?: () => void;
};

export function LeadNegociosListPanel({
  leadId,
  theme = "light",
  onOpenNegocio,
  onCreateNegocio,
}: Props) {
  const isLight = theme === "light";
  const muted = isLight ? RF_LIGHT_TEXT_MUTED : RF_TEXT_MUTED;
  const primary = isLight ? RF_LIGHT_TEXT_PRIMARY : RF_TEXT_PRIMARY;
  const secondary = isLight ? RF_LIGHT_TEXT_SECONDARY : RF_TEXT_SECONDARY;
  const border = isLight ? RF_LIGHT_BORDER : RF_BORDER;
  const borderStrong = isLight ? RF_LIGHT_BORDER_STRONG : RF_BORDER_STRONG;
  const panelBg = isLight ? RF_LIGHT_PANEL : "rgba(6, 13, 8, 0.55)";
  const [negocios, setNegocios] = useState<LeadNegocioListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setErro("");
    try {
      const res = await fetch(
        `/api/crm/negocios?lead_id=${encodeURIComponent(leadId)}`,
        { headers: internalApiHeaders() }
      );
      const json = (await res.json().catch(() => ({}))) as {
        data?: LeadNegocioListItem[];
        error?: string;
      };
      if (!res.ok) {
        setErro(json.error || "Não foi possível carregar os negócios.");
        setNegocios([]);
        return;
      }
      setNegocios(json.data ?? []);
    } catch {
      setErro("Erro de rede ao carregar negócios.");
      setNegocios([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abertos = negocios.filter((n) => n.status === "aberto");
  const historico = negocios.filter((n) => n.status !== "aberto");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p style={rfSubheadingStyle()}>Negócios do lead</p>
          <p className="m-0 mt-1 text-xs" style={{ color: muted }}>
            Abertos e histórico vinculados a este lead
          </p>
        </div>
        {onCreateNegocio ? (
          <CrmSideoverActionGroup theme={theme}>
            <CrmSideoverActionBtn onClick={onCreateNegocio} title="Criar negócio" theme={theme}>
              <Plus size={14} />
              Novo
            </CrmSideoverActionBtn>
          </CrmSideoverActionGroup>
        ) : null}
      </div>

      {erro ? (
        <p className="text-xs text-[#f85149]" role="alert">
          {erro}
        </p>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-xs" style={{ color: muted }}>
          A carregar negócios…
        </p>
      ) : negocios.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-10 text-center"
          style={{
            borderColor: borderStrong,
            background: isLight ? RF_LIGHT_PANEL : "rgba(6, 13, 8, 0.45)",
          }}
        >
          <Briefcase size={28} style={{ color: muted }} />
          <p className="m-0 text-sm font-semibold" style={{ color: primary }}>
            Nenhum negócio vinculado
          </p>
          <p className="m-0 max-w-xs text-xs leading-relaxed" style={{ color: muted }}>
            Negócios criados a partir deste lead aparecem aqui — abertos e encerrados.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {abertos.length ? (
            <NegocioSection
              title="Em aberto"
              items={abertos}
              onOpenNegocio={onOpenNegocio}
              theme={theme}
              colors={{ muted, primary, secondary, borderStrong, panelBg }}
            />
          ) : null}
          {historico.length ? (
            <NegocioSection
              title="Histórico"
              items={historico}
              onOpenNegocio={onOpenNegocio}
              theme={theme}
              colors={{ muted, primary, secondary, borderStrong, panelBg }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function NegocioSection({
  title,
  items,
  onOpenNegocio,
  colors,
}: {
  title: string;
  items: LeadNegocioListItem[];
  onOpenNegocio?: (negocioId: string) => void;
  theme?: CrmSideoverTheme;
  colors: {
    muted: string;
    primary: string;
    secondary: string;
    borderStrong: string;
    panelBg: string;
  };
}) {
  return (
    <section>
      <p
        className="mb-2 text-[11px] font-bold uppercase tracking-wide"
        style={{ color: colors.secondary }}
      >
        {title} ({items.length})
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((negocio) => (
          <li key={negocio.id}>
            <NegocioCard negocio={negocio} onOpenNegocio={onOpenNegocio} colors={colors} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function NegocioCard({
  negocio,
  onOpenNegocio,
  colors,
}: {
  negocio: LeadNegocioListItem;
  onOpenNegocio?: (negocioId: string) => void;
  colors: {
    muted: string;
    primary: string;
    borderStrong: string;
    panelBg: string;
  };
}) {
  const valor =
    negocio.status === "ganho" && negocio.valor_fechado != null
      ? negocio.valor_fechado
      : negocio.valor_estimado;
  const statusLabel = STATUS_LABEL[negocio.status] ?? negocio.status;
  const statusColor = STATUS_COLOR[negocio.status] ?? RF_TEXT_MUTED;
  const clickable = !!onOpenNegocio;

  return (
    <button
      type="button"
      onClick={() => onOpenNegocio?.(negocio.id)}
      disabled={!clickable}
      className="w-full rounded-xl border px-4 py-3 text-left transition disabled:cursor-default"
      style={{
        borderColor: colors.borderStrong,
        background: colors.panelBg,
        opacity: clickable ? 1 : 0.92,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {negocio.codigo ? (
              <span
                className="text-[10px] font-bold uppercase tracking-wide"
                style={{ color: RF_ACCENT }}
              >
                {negocio.codigo}
              </span>
            ) : null}
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{
                color: statusColor,
                background: `${statusColor}18`,
                border: `1px solid ${statusColor}44`,
              }}
            >
              {statusLabel}
            </span>
          </div>
          <p
            className="m-0 mt-1 truncate text-sm font-semibold"
            style={{ color: colors.primary }}
          >
            {negocio.titulo}
          </p>
          <div
            className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]"
            style={{ color: colors.muted }}
          >
            <span>Etapa: {negocio.etapa.replace(/_/g, " ")}</span>
            <span>{formatarMoeda(valor)}</span>
            {negocio.data_entrada ? (
              <span>Entrada: {formatarData(negocio.data_entrada)}</span>
            ) : null}
            {negocio.data_entrega || negocio.data_previsao_fechamento ? (
              <span>
                Entrega: {formatarData(negocio.data_entrega ?? negocio.data_previsao_fechamento)}
              </span>
            ) : null}
          </div>
        </div>
        {clickable ? (
          <ChevronRight size={16} className="mt-1 shrink-0" style={{ color: colors.muted }} />
        ) : null}
      </div>
    </button>
  );
}
