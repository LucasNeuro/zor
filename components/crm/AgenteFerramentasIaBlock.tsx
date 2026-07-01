"use client";

import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Brain,
  BriefcaseBusiness,
  Cloud,
  Cpu,
  Database,
  Eye,
  FileCode2,
  Globe,
  LayoutDashboard,
  ListOrdered,
  PieChart,
  Sparkles,
  StickyNote,
  Search,
  UserPen,
  UserRound,
  Users,
  ClipboardPenLine,
  Wrench,
} from "lucide-react";
import { IntegradorFerramentaMarcaIcon } from "@/components/crm/IntegradorFerramentaMarcaIcon";
import type { HubAgenteFerramentaId, HubFerramentaCategoria } from "@/lib/hub/agente-ferramentas-registry";
import {
  HUB_AGENTE_FERRAMENTAS_CATALOGO,
  HUB_FERRAMENTA_SECAO_LABEL,
  mergeUsoFerramentasComPadraoPreservandoCustom,
} from "@/lib/hub/agente-ferramentas-registry";
import {
  FERRAMENTAS_CRM_MOVED_TO_INTEGRADOR,
  HUB_INT_CRM_ATALHOS_CANAL,
  HUB_INT_CRM_OPERAR,
  chavesFerramentasBancoCrmWaje,
  isCrmEntidadeToolKey,
} from "@/lib/hub/crm-integrador-constants";
import { MEM0_BUSCAR_KEY, MEM0_SUPER_MEMORIA_KEY } from "@/lib/hub/mem0-constants";
import { MISTRAL_PERCEPCAO_KEY } from "@/lib/hub/mistral-integracao-constants";
import type { CatalogoFerramentaIntegradorLite } from "@/lib/hub/integrador-catalogo-ui";
export type { CatalogoFerramentaIntegradorLite } from "@/lib/hub/integrador-catalogo-ui";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

export type FerramentasIaTheme = "light" | "dark";

function ferramentasThemeTokens(theme: FerramentasIaTheme) {
  if (theme === "dark") {
    return {
      shellBg: "rgba(6, 13, 8, 0.72)",
      shellBorder: RF_BORDER_STRONG,
      panelBg: "rgba(11, 31, 16, 0.95)",
      rowBg: "rgba(6, 13, 8, 0.85)",
      rowBorder: RF_BORDER,
      rowBorderActive: "rgba(63, 152, 72, 0.45)",
      rowBgActive: "rgba(146, 255, 0, 0.08)",
      iconBg: "rgba(11, 31, 16, 0.9)",
      iconBgActive: "rgba(146, 255, 0, 0.14)",
      title: RF_TEXT_PRIMARY,
      body: RF_TEXT_SECONDARY,
      muted: RF_TEXT_MUTED,
      section: RF_TEXT_MUTED,
      heading: RF_TEXT_MUTED,
      toggleOff: "#2d4a38",
      listItem: RF_TEXT_SECONDARY,
      syncBoxBg: "rgba(6, 13, 8, 0.85)",
      syncBoxBorder: RF_BORDER,
      sectionTitle: "Funções do agente",
    };
  }
  return {
    shellBg: "#f8fcf6",
    shellBorder: "#dcebd8",
    panelBg: undefined as string | undefined,
    rowBg: "#ffffff",
    rowBorder: "#dcebd8",
    rowBorderActive: "#388bfd44",
    rowBgActive: "rgba(56,139,253,0.06)",
    iconBg: "#eef7eb",
    iconBgActive: "rgba(56,139,253,0.18)",
    title: "#0b2210",
    body: "#5d7a67",
    muted: "#6e7781",
    section: "#aebccf",
    heading: "#5d7a67",
    toggleOff: "#eef7eb",
    listItem: "#5d7a67",
    syncBoxBg: "#ffffff",
    syncBoxBorder: "#dcebd8",
    sectionTitle: "Funções do agente",
  };
}

const ORDEM_SECOES_CANAL: HubFerramentaCategoria[] = ["cliente", "analise", "registos"];
const ORDEM_SECOES_INTERNO: HubFerramentaCategoria[] = ["empresa", "analise"];

const ICONE_SECAO: Record<HubFerramentaCategoria, LucideIcon> = {
  cliente: Users,
  analise: PieChart,
  registos: ClipboardPenLine,
  empresa: Database,
};

const ICONE_FERRAMENTA: Record<HubAgenteFerramentaId, LucideIcon> = {
  hub_lead_resumo: UserRound,
  hub_lead_memorias: Brain,
  hub_lead_lookup_por_telefone: Search,
  hub_metricas_escritorio: BarChart3,
  hub_dados_empresa: Database,
  hub_operacao_empresa: BriefcaseBusiness,
  hub_raciocinio_avancado: Sparkles,
  hub_relatorio_html_simples: FileCode2,
  hub_superagente_dados: Database,
  hub_superagente_artefato: LayoutDashboard,
  hub_mistral_percepcao: Eye,
  hub_registar_nota_lead: StickyNote,
  hub_whatsapp_menu: ListOrdered,
  hub_atualizar_lead: UserPen,
  hub_criar_negocio: BriefcaseBusiness,
};

function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled,
  labelledBy,
  offBg = "#eef7eb",
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  labelledBy?: string;
  offBg?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      style={{
        width: 46,
        height: 26,
        borderRadius: 999,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "linear-gradient(180deg, #3fb950 0%, #2ea043 100%)" : offBg,
        boxShadow: checked ? "inset 0 1px 0 rgba(255,255,255,0.12)" : "inset 0 1px 0 rgba(0,0,0,0.2)",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.18s ease, opacity 0.15s",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#f0f6fc",
          boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          transition: "left 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </button>
  );
}

export type CatalogoFerramentaCustomLite = {
  ferramenta_key: string;
  titulo: string;
  builtin_impl: string;
  smart_provider: string;
  ativo: boolean;
  /** Texto curto para cards (admin); cai na descrição se vazio. */
  descricao_curta?: string | null;
};

export type CatalogoFerramentaExternaLite = {
  ferramenta_key: string;
  titulo: string;
  metodo_http: string;
  politica: string;
  ativo: boolean;
  descricao_curta?: string | null;
};

export type AgenteFerramentasIaBlockProps = {
  motorHabilitado: boolean;
  onMotorChange: (v: boolean) => void;
  mistralSyncHabilitado: boolean;
  onMistralSyncChange: (v: boolean) => void;
  usoFerramentas: Record<string, boolean>;
  onUsoChange: (id: string, ativo: boolean) => void;
  customCatalog?: CatalogoFerramentaCustomLite[];
  externaCatalog?: CatalogoFerramentaExternaLite[];
  integradorCatalog?: CatalogoFerramentaIntegradorLite[];
  mistralAgentId?: string | null;
  mistralSyncEm?: string | null;
  mistralSyncErro?: string | null;
  destacarWhatsApp?: boolean;
  /** Agente interno (jobs_internos) — mostra pacote empresa e oculta ferramentas de canal. */
  modoInterno?: boolean;
  modoCompacto?: boolean;
  theme?: FerramentasIaTheme;
};

export function AgenteFerramentasIaBlock({
  motorHabilitado,
  onMotorChange,
  mistralSyncHabilitado,
  onMistralSyncChange,
  usoFerramentas,
  onUsoChange,
  mistralAgentId,
  mistralSyncEm,
  mistralSyncErro,
  destacarWhatsApp,
  modoInterno,
  modoCompacto,
  customCatalog = [],
  externaCatalog = [],
  integradorCatalog = [],
  theme = "light",
}: AgenteFerramentasIaBlockProps) {
  const t = ferramentasThemeTokens(theme);
  const uso = mergeUsoFerramentasComPadraoPreservandoCustom(usoFerramentas);
  const nAtivas = Object.entries(uso).filter(([, on]) => on === true).length;
  const customActivos = customCatalog.filter((c) => c.ativo);
  const externaActivos = externaCatalog.filter((c) => c.ativo);
  const integradorActivos = integradorCatalog.filter((tool) => {
    if (tool.ferramenta_key === MEM0_SUPER_MEMORIA_KEY || tool.ferramenta_key === MEM0_BUSCAR_KEY) {
      return false;
    }
    if (tool.ferramenta_key === HUB_INT_CRM_OPERAR) return false;
    if (isCrmEntidadeToolKey(tool.ferramenta_key)) return Boolean(modoInterno);
    if ((HUB_INT_CRM_ATALHOS_CANAL as readonly string[]).includes(tool.ferramenta_key)) {
      return !modoInterno;
    }
    return true;
  });
  const nSlots =
    HUB_AGENTE_FERRAMENTAS_CATALOGO.length +
    customActivos.length +
    externaActivos.length +
    integradorActivos.length;
  const integradorCrmWaje = integradorActivos.filter((tool) => tool.integrador_id === "waje_crm");
  const integradorOutros = integradorActivos.filter((tool) => tool.integrador_id !== "waje_crm");
  const motorSemTools = motorHabilitado && nAtivas === 0;

  function activarPacoteWhatsApp() {
    onMotorChange(true);
    for (const t of HUB_AGENTE_FERRAMENTAS_CATALOGO) {
      if (t.recomendadoWhatsApp) onUsoChange(t.id, true);
    }
  }

  function activarTodasFerramentasBancoCrm() {
    onMotorChange(true);
    for (const key of chavesFerramentasBancoCrmWaje(Boolean(modoInterno))) {
      onUsoChange(key, true);
    }
  }

  function desactivarTodasFerramentasBancoCrm() {
    for (const key of chavesFerramentasBancoCrmWaje(Boolean(modoInterno))) {
      onUsoChange(key, false);
    }
  }

  function renderIntegradorRow(tool: CatalogoFerramentaIntegradorLite) {
    const ligado = uso[tool.ferramenta_key] === true;
    const labelId = `tool-label-${tool.ferramenta_key}`;
    const escrita = tool.politica === "escrita";
    const toggleDisabled = tool.emBreve === true;
    return (
      <div
        key={tool.ferramenta_key}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid",
          borderColor: ligado ? "rgba(146,255,0,0.35)" : t.rowBorder,
          background: ligado ? "rgba(146,255,0,0.07)" : t.rowBg,
          opacity: toggleDisabled ? 0.72 : 1,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: ligado ? "rgba(146,255,0,0.16)" : t.iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <IntegradorFerramentaMarcaIcon
            ferramentaKey={tool.ferramenta_key}
            integradorId={tool.integrador_id}
            integradorNome={tool.integrador_nome}
            size={22}
            ligado={ligado}
            mutedColor={t.body}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span id={labelId} style={{ color: t.title, fontSize: 13, fontWeight: 700 }}>
              {tool.titulo}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.06,
                color: tool.emBreve ? "#d4a72c" : tool.requerConexao ? "#c9a24a" : RF_ACCENT,
                border: `1px solid ${
                  tool.emBreve
                    ? "rgba(212,167,44,0.45)"
                    : tool.requerConexao
                      ? "rgba(201,162,74,0.45)"
                      : "rgba(146,255,0,0.35)"
                }`,
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              {tool.emBreve
                ? "EM BREVE"
                : tool.requerConexao
                  ? tool.integrador_id === "mem0"
                    ? "CONFIGURAR MEMÓRIA"
                    : "REQUER LIGAÇÃO"
                  : tool.integrador_nome}
            </span>
          </div>
          <span
            style={{ display: "block", color: t.listItem, fontSize: 12, lineHeight: 1.45, marginTop: 4 }}
          >
            {tool.descricao_curta ||
              (escrita ? "Altera dados na aplicação externa." : "Consulta a aplicação externa.")}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            flexShrink: 0,
            paddingTop: 4,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: ligado ? "#3fb950" : t.muted }}>
            {ligado ? "ACTIVO" : "INACTIVO"}
          </span>
          <ToggleSwitch
            checked={ligado}
            onCheckedChange={(v) => handleUsoChange(tool.ferramenta_key, v)}
            disabled={toggleDisabled}
            labelledBy={labelId}
            offBg={t.toggleOff}
          />
        </div>
      </div>
    );
  }

  function handleUsoChange(id: string, ativo: boolean) {
    onUsoChange(id, ativo);
  }

  const ordemSecoes = modoInterno ? ORDEM_SECOES_INTERNO : ORDEM_SECOES_CANAL;
  const sectionTitle = modoInterno ? "Funções do funcionário IA" : t.sectionTitle;

  const rowBase: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 12,
    border: `1px solid ${t.rowBorder}`,
    background: t.rowBg,
  };

  return (
    <div
      style={{
        marginTop: modoCompacto ? 0 : 12,
        padding: modoCompacto ? 0 : 14,
        borderRadius: 12,
        border: modoCompacto ? undefined : `1px solid ${t.shellBorder}`,
        background: modoCompacto ? undefined : t.shellBg,
      }}
    >
      {!modoCompacto ? (
        <p style={{ color: t.heading, fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>
          {sectionTitle}
        </p>
      ) : null}

      {motorSemTools ? (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(248,187,92,0.35)",
            background: "rgba(248,187,92,0.08)",
            color: "#e6c06a",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          O motor está ligado mas <strong>nenhuma função está activa</strong>. Active pelo menos uma opção abaixo
          {destacarWhatsApp ? " ou use o atalho recomendado." : "."}
        </div>
      ) : null}

      {modoInterno ? (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(56,139,253,0.35)",
            background: "rgba(56,139,253,0.08)",
            color: t.body,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: t.title }}>Funcionário IA (superagente):</strong> active ou desactive cada
          função abaixo — o motor <strong style={{ color: t.title }}>obedece exactamente</strong> aos toggles
          guardados ao salvar. Use <strong style={{ color: t.title }}>Activar todas (base de dados)</strong> para
          ligar o pacote CRM + financeiro de uma vez.
        </div>
      ) : null}

      {destacarWhatsApp ? (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={activarPacoteWhatsApp}
            style={{
              cursor: "pointer",
              borderRadius: 8,
              border: "1px solid #388bfd66",
              background: "#388bfd22",
              color: "#79c0ff",
              fontSize: 12,
              fontWeight: 700,
              padding: "8px 12px",
            }}
          >
            Activar pacote recomendado (WhatsApp)
          </button>
        </div>
      ) : null}

      <div style={{ ...rowBase, marginBottom: 10, borderColor: motorHabilitado ? t.rowBorderActive : t.rowBorder }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: motorHabilitado ? t.iconBgActive : t.iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: motorHabilitado ? "#86efac" : t.body,
          }}
        >
          <Cpu size={20} strokeWidth={2} aria-hidden />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span id="label-motor-hub" style={{ color: t.title, fontSize: 13, fontWeight: 700 }}>
            Funções durante a conversa
          </span>
          <span style={{ display: "block", color: t.body, fontWeight: 400, fontSize: 12, marginTop: 2 }}>
            <strong style={{ color: motorSemTools ? "#f85149" : t.body }}>{nAtivas}</strong> de {nSlots} activas
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: motorHabilitado ? "#3fb950" : t.muted }}>
            {motorHabilitado ? "ACTIVO" : "INACTIVO"}
          </span>
          <ToggleSwitch
            checked={motorHabilitado}
            onCheckedChange={onMotorChange}
            labelledBy="label-motor-hub"
            offBg={t.toggleOff}
          />
        </div>
      </div>

      <div style={{ ...rowBase, marginBottom: 16, borderColor: mistralSyncHabilitado ? "#a371f755" : t.rowBorder }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: mistralSyncHabilitado ? "rgba(163,113,247,0.12)" : t.iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: mistralSyncHabilitado ? "#d2a8ff" : t.body,
          }}
        >
          <Cloud size={20} strokeWidth={2} aria-hidden />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span id="label-mistral-sync" style={{ color: t.title, fontSize: 13, fontWeight: 700 }}>
            Sincronizar ao guardar
          </span>
          <span style={{ display: "block", color: t.body, fontWeight: 400, fontSize: 12, marginTop: 2 }}>
            Mantém o agente actualizado com as alterações desta ficha.
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: mistralSyncHabilitado ? "#a371f7" : t.muted }}>
            {mistralSyncHabilitado ? "ACTIVO" : "INACTIVO"}
          </span>
          <ToggleSwitch
            checked={mistralSyncHabilitado}
            onCheckedChange={onMistralSyncChange}
            labelledBy="label-mistral-sync"
            offBg={t.toggleOff}
          />
        </div>
      </div>

      <p style={{ color: t.heading, fontSize: 11, fontWeight: 700, margin: "0 0 10px", letterSpacing: 0.04 }}>
        Capacidades
      </p>

      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {ordemSecoes.map((cat) => {
              const tools = HUB_AGENTE_FERRAMENTAS_CATALOGO.filter(
                (t) =>
                  t.categoria === cat &&
                  t.id !== MISTRAL_PERCEPCAO_KEY &&
                  !(FERRAMENTAS_CRM_MOVED_TO_INTEGRADOR as readonly string[]).includes(t.id)
              );
              if (!tools.length) return null;
              const SecIcon = ICONE_SECAO[cat];
              return (
                <div key={cat}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <SecIcon size={14} strokeWidth={2.25} style={{ color: t.body }} aria-hidden />
                    <p
                      style={{
                        color: t.section,
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 0.04,
                        textTransform: "uppercase",
                        margin: 0,
                      }}
                    >
                      {HUB_FERRAMENTA_SECAO_LABEL[cat]}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {tools.map((tool) => {
                      const ligado = uso[tool.id] === true;
                      const ToolIcon = ICONE_FERRAMENTA[tool.id];
                      const labelId = `tool-label-${tool.id}`;
                      return (
                        <div
                          key={tool.id}
                          style={{
                            ...rowBase,
                            borderColor: ligado ? t.rowBorderActive : t.rowBorder,
                            background: ligado ? t.rowBgActive : t.rowBg,
                            alignItems: "flex-start",
                          }}
                        >
                          <div
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 10,
                              background: ligado ? t.iconBgActive : t.iconBg,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              color: ligado ? "#86efac" : t.body,
                              marginTop: 2,
                            }}
                          >
                            <ToolIcon size={21} strokeWidth={2} aria-hidden />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                              <span id={labelId} style={{ color: t.title, fontSize: 13, fontWeight: 700 }}>
                                {tool.titulo}
                              </span>
                              {tool.recomendadoWhatsApp && destacarWhatsApp ? (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    letterSpacing: 0.06,
                                    color: "#79c0ff",
                                    border: "1px solid rgba(121,192,255,0.35)",
                                    borderRadius: 4,
                                    padding: "2px 6px",
                                  }}
                                >
                                  WHATSAPP
                                </span>
                              ) : null}
                            </div>
                            <span
                              style={{
                                display: "block",
                                color: t.listItem,
                                fontSize: 12,
                                lineHeight: 1.45,
                                marginTop: 4,
                              }}
                            >
                              {tool.descricao}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              gap: 4,
                              flexShrink: 0,
                              paddingTop: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: ligado ? "#3fb950" : t.muted,
                              }}
                            >
                              {ligado ? "ACTIVO" : "INACTIVO"}
                            </span>
                            <ToggleSwitch
                              checked={ligado}
                              onCheckedChange={(v) => handleUsoChange(tool.id, v)}
                              labelledBy={labelId}
                              offBg={t.toggleOff}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {customActivos.length > 0 ? (
            <>
              <p
                style={{
                  color: t.heading,
                  fontSize: 11,
                  fontWeight: 700,
                  margin: "18px 0 10px",
                  letterSpacing: 0.04,
                }}
              >
                FUNÇÕES CUSTOM DO ESCRITÓRIO
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {customActivos.map((tool) => {
                  const ligado = uso[tool.ferramenta_key] === true;
                  const labelId = `tool-label-${tool.ferramenta_key}`;
                  const curta = tool.descricao_curta != null ? String(tool.descricao_curta).trim() : "";
                  return (
                    <div
                      key={tool.ferramenta_key}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid",
                        borderColor: ligado ? "rgba(201,162,74,0.35)" : t.rowBorder,
                        background: ligado ? "rgba(201,162,74,0.07)" : t.rowBg,
                      }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          background: ligado ? "rgba(201,162,74,0.2)" : t.iconBg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          color: ligado ? "#c9a24a" : "#5d7a67",
                          marginTop: 2,
                        }}
                      >
                        <Wrench size={21} strokeWidth={2} aria-hidden />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                          <span id={labelId} style={{ color: t.title, fontSize: 13, fontWeight: 700 }}>
                            {tool.titulo}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              letterSpacing: 0.06,
                              color: "#c9a24a",
                              border: "1px solid rgba(201,162,74,0.35)",
                              borderRadius: 4,
                              padding: "2px 6px",
                            }}
                          >
                            CUSTOM
                          </span>
                          {tool.smart_provider !== "none" ? (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: "#79c0ff",
                                border: "1px solid rgba(121,192,255,0.35)",
                                borderRadius: 4,
                                padding: "2px 6px",
                              }}
                            >
                              SMART {tool.smart_provider.toUpperCase()}
                            </span>
                          ) : null}
                        </div>
                        <span
                          style={{ display: "block", color: t.listItem, fontSize: 12, lineHeight: 1.45, marginTop: 4 }}
                        >
                          {curta ? (
                            curta
                          ) : (
                            <>
                              Base: <strong style={{ color: "#aebccf" }}>{tool.builtin_impl}</strong>
                              {tool.smart_provider !== "none" ? (
                                <>
                                  {" "}
                                  · smart <strong style={{ color: "#aebccf" }}>{tool.smart_provider}</strong>
                                </>
                              ) : null}
                            </>
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 4,
                          flexShrink: 0,
                          paddingTop: 4,
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 700, color: ligado ? "#3fb950" : t.muted }}>
                          {ligado ? "ACTIVO" : "INACTIVO"}
                        </span>
                        <ToggleSwitch
                          checked={ligado}
                          onCheckedChange={(v) => onUsoChange(tool.ferramenta_key, v)}
                          labelledBy={labelId}
                          offBg={t.toggleOff}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {externaActivos.length > 0 ? (
            <>
              <p
                style={{
                  color: t.heading,
                  fontSize: 11,
                  fontWeight: 700,
                  margin: "18px 0 10px",
                  letterSpacing: 0.04,
                }}
              >
                FUNÇÕES EXTERNAS (HTTP)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {externaActivos.map((tool) => {
                  const ligado = uso[tool.ferramenta_key] === true;
                  const labelId = `tool-label-${tool.ferramenta_key}`;
                  const curta = tool.descricao_curta != null ? String(tool.descricao_curta).trim() : "";
                  const escrita = tool.politica === "escrita";
                  return (
                    <div
                      key={tool.ferramenta_key}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: "1px solid",
                        borderColor: ligado ? "rgba(196,181,253,0.35)" : t.rowBorder,
                        background: ligado ? "rgba(91,63,168,0.1)" : t.rowBg,
                      }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          background: ligado ? "rgba(91,63,168,0.22)" : t.iconBg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          color: ligado ? "#c4b5fd" : "#5d7a67",
                          marginTop: 2,
                        }}
                      >
                        <Globe size={21} strokeWidth={2} aria-hidden />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                          <span id={labelId} style={{ color: t.title, fontSize: 13, fontWeight: 700 }}>
                            {tool.titulo}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              letterSpacing: 0.06,
                              color: "#c4b5fd",
                              border: "1px solid rgba(196,181,253,0.35)",
                              borderRadius: 4,
                              padding: "2px 6px",
                            }}
                          >
                            EXTERNA
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: escrita ? "#f85149" : "#3fb950",
                              border: `1px solid ${escrita ? "rgba(248,81,73,0.35)" : "rgba(63,185,80,0.3)"}`,
                              borderRadius: 4,
                              padding: "2px 6px",
                            }}
                          >
                            {tool.metodo_http}
                          </span>
                        </div>
                        <span
                          style={{ display: "block", color: t.listItem, fontSize: 12, lineHeight: 1.45, marginTop: 4 }}
                        >
                          {curta || (escrita ? "Pode alterar dados via API externa." : "Consulta API externa (só leitura).")}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 4,
                          flexShrink: 0,
                          paddingTop: 4,
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 700, color: ligado ? "#3fb950" : t.muted }}>
                          {ligado ? "ACTIVO" : "INACTIVO"}
                        </span>
                        <ToggleSwitch
                          checked={ligado}
                          onCheckedChange={(v) => onUsoChange(tool.ferramenta_key, v)}
                          labelledBy={labelId}
                          offBg={t.toggleOff}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {integradorCrmWaje.length > 0 ? (
            <>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  margin: "18px 0 10px",
                }}
              >
                <p
                  style={{
                    color: t.heading,
                    fontSize: 11,
                    fontWeight: 700,
                    margin: 0,
                    letterSpacing: 0.04,
                  }}
                >
                  BASE DE DADOS CRM (SUPABASE)
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    onClick={activarTodasFerramentasBancoCrm}
                    style={{
                      cursor: "pointer",
                      borderRadius: 8,
                      border: "1px solid rgba(146,255,0,0.35)",
                      background: "rgba(146,255,0,0.12)",
                      color: theme === "dark" ? RF_ACCENT : "#2d6a3e",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "6px 10px",
                    }}
                  >
                    Activar todas
                  </button>
                  <button
                    type="button"
                    onClick={desactivarTodasFerramentasBancoCrm}
                    style={{
                      cursor: "pointer",
                      borderRadius: 8,
                      border: `1px solid ${t.rowBorder}`,
                      background: t.rowBg,
                      color: t.body,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "6px 10px",
                    }}
                  >
                    Desactivar todas
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {integradorCrmWaje.map((tool) => renderIntegradorRow(tool))}
              </div>
            </>
          ) : null}

          {integradorOutros.length > 0 ? (
            <>
              <p
                style={{
                  color: t.heading,
                  fontSize: 11,
                  fontWeight: 700,
                  margin: "18px 0 10px",
                  letterSpacing: 0.04,
                }}
              >
                {(() => {
                  const soRequer = integradorOutros.every((tool) => tool.requerConexao);
                  const algumRequer = integradorOutros.some((tool) => tool.requerConexao);
                  if (soRequer) return "INTEGRAÇÕES (LIGAR CONTAS ACIMA)";
                  if (algumRequer) return "INTEGRAÇÕES";
                  return "INTEGRAÇÕES LIGADAS";
                })()}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {integradorOutros.map((tool) => renderIntegradorRow(tool))}
              </div>
            </>
          ) : null}
      </>

      {mistralAgentId || mistralSyncEm || mistralSyncErro ? (
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${t.syncBoxBorder}`,
            background: t.syncBoxBg,
          }}
        >
          <p style={{ color: t.heading, fontSize: 11, fontWeight: 700, margin: "0 0 6px" }}>
            Sincronização
          </p>
          {mistralAgentId ? (
            <p style={{ color: t.body, fontSize: 11, margin: 0 }}>
              Agente sincronizado
            </p>
          ) : null}
          {mistralSyncEm ? (
            <p style={{ color: t.body, fontSize: 11, margin: "4px 0 0" }}>
              Última sync: {new Date(mistralSyncEm).toLocaleString()}
            </p>
          ) : null}
          {mistralSyncErro ? (
            <p style={{ color: "#f85149", fontSize: 11, margin: "6px 0 0", lineHeight: 1.45 }}>
              {mistralSyncErro}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
