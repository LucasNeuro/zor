"use client";

import { useState, type CSSProperties, type MouseEvent } from "react";
import {
  ChevronDown,
  Pencil,
  Play,
  Power,
  RotateCcw,
  Trash2,
  UserRound,
} from "lucide-react";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import { CRM_ACCENT } from "@/lib/crm/crm-button-styles";
import { CrmIconButtonGroup } from "@/components/crm/CrmIconButtonGroup";
import { CICLO_STATUS_COR, cicloTipoMeta, tempoRelativoCiclo } from "@/lib/crm/ciclo-ui";
import { MODO_OPERACAO_LABEL, type ModoOperacaoAgente } from "@/lib/hub/agente-modo-operacao";
import { CrmBotRingAvatar } from "@/components/crm/CrmBotRingAvatar";

export type CicloCardData = {
  id: string;
  agente_slug: string;
  nome: string;
  descricao?: string | null;
  tipo: string;
  cron_expressao?: string | null;
  ativo: boolean;
  ultimo_ciclo?: string | null;
  ultimo_status?: string | null;
  total_execucoes: number;
  total_alertas_gerados: number;
};

export type CicloCardAgente = {
  agente_slug: string;
  nome?: string;
  cargo?: string;
  avatar_url?: string | null;
  modo_operacao?: ModoOperacaoAgente | string | null;
  ativo?: boolean;
};

type Props = {
  ciclo: CicloCardData;
  agente?: CicloCardAgente | null;
  selecionado?: boolean;
  executando?: boolean;
  alternando?: boolean;
  excluindo?: boolean;
  limpando?: boolean;
  proximaExecucao?: string;
  onOpen: () => void;
  onExecutar: () => void;
  onEditar: () => void;
  onLimparAgendamento: (e: MouseEvent) => void;
  onToggleAtivo: () => void;
  onExcluir: (e: MouseEvent) => void;
};

function cicloCardShell(selecionado: boolean, ativo: boolean): CSSProperties {
  return {
    background: selecionado
      ? "linear-gradient(165deg, #ffffff 0%, #f2fbf0 100%)"
      : "linear-gradient(165deg, #ffffff 0%, #fafdfa 100%)",
    borderRadius: 18,
    border: selecionado ? "1.5px solid rgba(146, 255, 0, 0.55)" : "1px solid rgba(18, 56, 43, 0.14)",
    boxShadow: selecionado
      ? "0 0 0 1px rgba(146, 255, 0, 0.12), 0 16px 40px rgba(15, 56, 39, 0.12)"
      : "0 8px 24px rgba(15, 56, 39, 0.07)",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    cursor: "pointer",
    transition: "border-color 160ms ease, box-shadow 160ms ease",
    minWidth: 0,
    opacity: ativo ? 1 : 0.9,
    overflow: "hidden",
  };
}

export function CicloCard({
  ciclo,
  agente,
  selecionado = false,
  executando = false,
  alternando = false,
  excluindo = false,
  limpando = false,
  proximaExecucao = "—",
  onOpen,
  onExecutar,
  onEditar,
  onLimparAgendamento,
  onToggleAtivo,
  onExcluir,
}: Props) {
  const [agenteAberto, setAgenteAberto] = useState(false);
  const meta = cicloTipoMeta(ciclo.tipo);
  const TipoIcon = meta.Icon;
  const ativo = ciclo.ativo !== false;
  const st = ciclo.ultimo_status || "nunca_executado";
  const stCor = CICLO_STATUS_COR[st] || "#6b8a76";
  const execProgress =
    ciclo.total_execucoes > 0
      ? Math.min(0.92, 0.18 + Math.min(ciclo.total_execucoes, 9) * 0.08)
      : null;
  const busy = executando || alternando || excluindo || limpando;
  const gatilho = ciclo.tipo === "gatilho";

  const modoLabel =
    agente?.modo_operacao && agente.modo_operacao in MODO_OPERACAO_LABEL
      ? MODO_OPERACAO_LABEL[agente.modo_operacao as ModoOperacaoAgente]
      : agente?.modo_operacao
        ? String(agente.modo_operacao)
        : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      style={cicloCardShell(selecionado, ativo)}
    >
      <div style={{ padding: "14px 14px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `${meta.cor}18`,
              border: `1px solid ${meta.cor}44`,
              boxShadow: `0 4px 14px ${meta.cor}22`,
            }}
          >
            <TipoIcon size={22} strokeWidth={2.25} color={meta.cor} aria-hidden />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <p
                style={{
                  color: BRAND_TEXT_DARK,
                  fontWeight: 800,
                  fontSize: 15,
                  margin: 0,
                  lineHeight: 1.25,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {ciclo.nome}
              </p>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 0.6,
                  color: ativo ? BRAND_TEXT_DARK : "#6b8a76",
                  background: ativo ? "rgba(146, 255, 0, 0.18)" : "rgba(18, 56, 43, 0.06)",
                  border: `1px solid ${ativo ? "rgba(146, 255, 0, 0.45)" : "rgba(18, 56, 43, 0.12)"}`,
                  borderRadius: 999,
                  padding: "4px 8px",
                }}
              >
                {ativo ? "ATIVO" : "INATIVO"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: `${meta.cor}14`,
                  color: meta.cor,
                  border: `1px solid ${meta.cor}33`,
                }}
              >
                {meta.label}
              </span>
              <span style={{ fontSize: 11, color: "#6b8a76" }}>
                {ciclo.total_execucoes} exec.
                {ciclo.total_alertas_gerados > 0 ? (
                  <span style={{ color: CRM_ACCENT }}> · {ciclo.total_alertas_gerados} alertas</span>
                ) : null}
              </span>
            </div>
          </div>
        </div>

        <p
          style={{
            fontSize: 12,
            color: "#5d7a67",
            margin: 0,
            lineHeight: 1.45,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {ciclo.descricao?.trim() || meta.descricaoCurta}
        </p>

        <p style={{ fontSize: 11, color: "#6b8a76", margin: 0, lineHeight: 1.5 }}>
          Última: {tempoRelativoCiclo(ciclo.ultimo_ciclo ?? undefined)} · Próx.: {proximaExecucao}
        </p>
        <p style={{ fontSize: 11, margin: 0 }}>
          <span style={{ color: stCor, fontWeight: 700 }}>{st.replace(/_/g, " ")}</span>
        </p>
      </div>

      <div
        style={{ borderTop: "1px solid rgba(18, 56, 43, 0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setAgenteAberto((v) => !v)}
          aria-expanded={agenteAberto}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "10px 14px",
            border: "none",
            background: agenteAberto ? "rgba(146, 255, 0, 0.06)" : "rgba(18, 56, 43, 0.03)",
            cursor: "pointer",
            color: BRAND_TEXT_DARK,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <UserRound size={14} strokeWidth={2.25} color="#5d7a67" aria-hidden />
            Agente do ciclo
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2.25}
            color="#5d7a67"
            aria-hidden
            style={{
              transform: agenteAberto ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        </button>
        {agenteAberto ? (
          <div
            style={{
              padding: "0 14px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <CrmBotRingAvatar
              pixelSize={40}
              accent={BRAND_GREEN_BRIGHT}
              avatarSeed={ciclo.agente_slug}
              avatarNome={agente?.nome}
              imageUrl={agente?.avatar_url}
              progress={execProgress}
              pulse={!ciclo.ultimo_ciclo}
              dim={agente?.ativo === false}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: BRAND_TEXT_DARK }}>
                {agente?.nome?.trim() || ciclo.agente_slug}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 10,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: "#6b8a76",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ciclo.agente_slug}
              </p>
              {agente?.cargo ? (
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#5d7a67" }}>{agente.cargo}</p>
              ) : null}
              {modoLabel ? (
                <p style={{ margin: "4px 0 0", fontSize: 10, fontWeight: 700, color: CRM_ACCENT }}>{modoLabel}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          padding: "10px 14px 12px",
          borderTop: "1px solid rgba(18, 56, 43, 0.1)",
          display: "flex",
          justifyContent: "flex-end",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <CrmIconButtonGroup
          aria-label="Ações do ciclo"
          items={[
            {
              key: "executar",
              variant: "green",
              icon: <Play size={15} strokeWidth={2.5} aria-hidden />,
              onClick: onExecutar,
              disabled: executando || !ativo || gatilho,
              loading: executando,
              title: gatilho ? "Gatilho — dispara por mensagem no canal" : ativo ? "Executar agora" : "Ative o ciclo",
              "aria-label": "Executar ciclo",
            },
            {
              key: "editar",
              variant: "primary",
              icon: <Pencil size={15} strokeWidth={2.5} aria-hidden />,
              onClick: () => onEditar(),
              disabled: busy,
              title: "Editar ciclo",
              "aria-label": "Editar ciclo",
            },
            {
              key: "limpar",
              variant: "outline",
              icon: <RotateCcw size={15} strokeWidth={2.5} aria-hidden />,
              onClick: onLimparAgendamento,
              disabled: limpando || excluindo,
              loading: limpando,
              title: "Limpar cron e intervalo",
              "aria-label": "Limpar agendamento",
            },
            {
              key: "toggle",
              variant: "primary",
              icon: <Power size={15} strokeWidth={2.5} aria-hidden />,
              onClick: () => onToggleAtivo(),
              disabled: alternando || excluindo,
              loading: alternando,
              title: ativo ? "Desativar" : "Ativar",
              "aria-label": ativo ? "Desativar ciclo" : "Ativar ciclo",
            },
            {
              key: "excluir",
              variant: "danger",
              icon: <Trash2 size={15} strokeWidth={2.5} aria-hidden />,
              onClick: onExcluir,
              disabled: excluindo || alternando,
              loading: excluindo,
              title: "Excluir ciclo",
              "aria-label": "Excluir ciclo",
            },
          ]}
        />
      </div>
    </div>
  );
}
