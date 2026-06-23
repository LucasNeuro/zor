"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Bell,
  ChevronRight,
  GripVertical,
  Loader2,
  Play,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { CrmIntegracaoSideoverShell } from "@/components/crm/AgenteUazapiBlock";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { hubApiHeaders } from "@/lib/internal-api-headers-client";
import { CRM_ACCENT, crmBtnPrimary, crmBtnPrimaryLg, crmBtnSecondary } from "@/lib/crm/crm-button-styles";
import { BRAND_TEXT_DARK } from "@/lib/brand";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfInputStyle,
  rfLabelStyle,
  rfInnerPanelStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import type { HubAgenteFollowupConfig, HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import {
  atrasoTotalMinutos,
  formatarAtrasoPasso,
} from "@/lib/hub/followup-types";

type Props = {
  agenteSlug: string;
  agenteNome?: string;
  layout?: "card" | "embedded";
};

function normalizarPasso(p: HubAgenteFollowupPasso): HubAgenteFollowupPasso {
  return {
    ...p,
    atraso_minutos: Number.isFinite(p.atraso_minutos) ? p.atraso_minutos : 0,
  };
}

function clampMinutos(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(59, Math.max(0, v));
}

function clampHoras(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(8760, Math.max(0, v));
}

export function AgenteFollowupBlock({ agenteSlug, agenteNome, layout = "card" }: Props) {
  const isCard = layout === "card";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<HubAgenteFollowupConfig | null>(null);
  const [passos, setPassos] = useState<HubAgenteFollowupPasso[]>([]);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [dragPassoId, setDragPassoId] = useState<string | null>(null);
  const [dragOverPassoId, setDragOverPassoId] = useState<string | null>(null);
  const [dragOverImagemId, setDragOverImagemId] = useState<string | null>(null);

  const base = `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/followup`;

  const passosOrdenados = useMemo(
    () => [...passos].sort((a, b) => a.ordem - b.ordem),
    [passos]
  );

  const btnPrimaryDark = (disabled: boolean): CSSProperties => ({
    ...crmBtnPrimaryLg(disabled),
    width: "100%",
    justifyContent: "center",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  });

  const btnSecondaryDark = (disabled: boolean): CSSProperties => ({
    ...crmBtnSecondary(disabled),
    width: "100%",
    justifyContent: "center",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(6, 13, 8, 0.55)",
    border: `1px solid ${RF_BORDER_STRONG}`,
    color: RF_TEXT_PRIMARY,
  });

  const carregar = useCallback(async () => {
    if (!agenteSlug.trim()) return;
    setLoading(true);
    setErro("");
    try {
      const res = await fetch(base, { headers: await hubApiHeaders() });
      const data = (await res.json()) as {
        error?: string;
        config?: HubAgenteFollowupConfig;
        passos?: HubAgenteFollowupPasso[];
      };
      if (!res.ok) throw new Error(data.error || "Falha ao carregar");
      setConfig(data.config ?? null);
      setPassos(
        Array.isArray(data.passos) ? data.passos.map((p) => normalizarPasso(p as HubAgenteFollowupPasso)) : []
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar follow-up");
    } finally {
      setLoading(false);
    }
  }, [base, agenteSlug]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (sideoverOpen) void carregar();
  }, [sideoverOpen, carregar]);

  async function salvarConfig(patch: Partial<{ ativo: boolean; arquivar_apos_dias: number }>) {
    setSaving(true);
    setErro("");
    setOkMsg("");
    try {
      const res = await fetch(base, {
        method: "PATCH",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as {
        error?: string;
        config?: HubAgenteFollowupConfig;
        passos?: HubAgenteFollowupPasso[];
        leads_reativados?: number;
      };
      if (!res.ok) throw new Error(data.error || "Falha ao guardar");
      if (data.config) setConfig(data.config);
      if (data.passos) setPassos(data.passos.map(normalizarPasso));
      const reativados = data.leads_reativados ?? 0;
      setOkMsg(
        reativados > 0
          ? `Follow-up activo — ${reativados} lead(s) reactivado(s).`
          : "Configuração guardada."
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao guardar");
    } finally {
      setSaving(false);
    }
  }

  async function salvarPasso(passo: HubAgenteFollowupPasso) {
    if (atrasoTotalMinutos(passo) < 1) {
      setErro("Defina pelo menos 1 minuto de atraso (horas e/ou minutos).");
      return;
    }
    setSaving(true);
    setErro("");
    try {
      const res = await fetch(`${base}/passos/${encodeURIComponent(passo.id)}`, {
        method: "PATCH",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          ordem: passo.ordem,
          atraso_horas: passo.atraso_horas,
          atraso_minutos: passo.atraso_minutos ?? 0,
          tipo_conteudo: passo.tipo_conteudo,
          texto_template: passo.texto_template,
          imagem_url: passo.imagem_url,
          legenda_imagem: passo.legenda_imagem,
          ativo: passo.ativo,
        }),
      });
      const data = (await res.json()) as { error?: string; passo?: HubAgenteFollowupPasso };
      if (!res.ok) throw new Error(data.error || "Falha ao guardar passo");
      if (data.passo) {
        setPassos((prev) => prev.map((p) => (p.id === data.passo!.id ? data.passo! : p)));
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao guardar passo");
    } finally {
      setSaving(false);
    }
  }

  async function persistirOrdem(reordered: HubAgenteFollowupPasso[]) {
    setSaving(true);
    setErro("");
    try {
      const res = await fetch(`${base}/passos/reorder`, {
        method: "POST",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ ordem_ids: reordered.map((p) => p.id) }),
      });
      const data = (await res.json()) as { error?: string; passos?: HubAgenteFollowupPasso[] };
      if (!res.ok) throw new Error(data.error || "Falha ao reordenar");
      if (data.passos) setPassos(data.passos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao reordenar");
      void carregar();
    } finally {
      setSaving(false);
    }
  }

  function reorderLocal(fromId: string, toId: string) {
    if (fromId === toId) return;
    const sorted = [...passosOrdenados];
    const fromIdx = sorted.findIndex((p) => p.id === fromId);
    const toIdx = sorted.findIndex((p) => p.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    const reordered = sorted.map((p, i) => ({ ...p, ordem: i + 1 }));
    setPassos(reordered);
    void persistirOrdem(reordered);
  }

  async function adicionarPasso() {
    const maxOrdem = passos.reduce((m, p) => Math.max(m, p.ordem), 0);
    const ultimo = passos.find((p) => p.ordem === maxOrdem);
    const totalMin = ultimo ? atrasoTotalMinutos(ultimo) * 2 : 120;
    const atraso_horas = Math.min(8760, Math.floor(totalMin / 60));
    const atraso_minutos = totalMin % 60;
    setSaving(true);
    try {
      const res = await fetch(`${base}/passos`, {
        method: "POST",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          ordem: maxOrdem + 1,
          atraso_horas,
          atraso_minutos,
          tipo_conteudo: "texto",
          texto_template: "Olá {nome}, ainda posso ajudar?",
        }),
      });
      const data = (await res.json()) as { error?: string; passo?: HubAgenteFollowupPasso };
      if (!res.ok) throw new Error(data.error || "Falha ao criar passo");
      if (data.passo) setPassos((prev) => [...prev, data.passo!].sort((a, b) => a.ordem - b.ordem));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar passo");
    } finally {
      setSaving(false);
    }
  }

  async function excluirPasso(id: string) {
    if (!confirm("Excluir este lembrete?")) return;
    setSaving(true);
    try {
      const res = await fetch(`${base}/passos/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: await hubApiHeaders(),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Falha ao excluir");
      const restantes = passosOrdenados.filter((p) => p.id !== id).map((p, i) => ({ ...p, ordem: i + 1 }));
      setPassos(restantes);
      if (restantes.length > 0) await persistirOrdem(restantes);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImagem(passoId: string, file: File) {
    setUploadingId(passoId);
    setErro("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${base}/upload`, {
        method: "POST",
        headers: await hubApiHeaders(),
        body: fd,
      });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Upload falhou");
      const passo = passos.find((p) => p.id === passoId);
      if (passo) {
        const atualizado = {
          ...passo,
          imagem_url: data.url,
          tipo_conteudo:
            passo.tipo_conteudo === "texto" ? ("texto_imagem" as const) : passo.tipo_conteudo,
        };
        await salvarPasso(atualizado);
        setOkMsg("Imagem enviada para o bucket agent-followup.");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploadingId(null);
    }
  }

  async function testarAgora() {
    setTesting(true);
    setErro("");
    setOkMsg("");
    try {
      const res = await fetch(`${base}/test`, {
        method: "POST",
        headers: await hubApiHeaders(),
      });
      const data = (await res.json()) as {
        error?: string;
        resultado?: {
          enviados: number;
          arquivados: number;
          leads_elegiveis: number;
          erros: string[];
          acoes: string[];
        };
      };
      if (!res.ok) throw new Error(data.error || "Falha ao testar");
      const r = data.resultado;
      if (r?.erros?.length) setErro(r.erros.slice(0, 3).join(" · "));
      setOkMsg(
        r
          ? `Teste: ${r.leads_elegiveis ?? 0} lead(s) elegível(eis), ${r.enviados} enviado(s), ${r.arquivados} arquivado(s).`
          : "Teste concluído."
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao testar");
    } finally {
      setTesting(false);
    }
  }

  function atualizarPassoLocal(id: string, patch: Partial<HubAgenteFollowupPasso>) {
    setPassos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  const ativo = config?.ativo === true;
  const passosAtivos = passos.filter((p) => p.ativo).length;

  const badge = ativo
    ? { rotulo: "ACTIVO", bg: "rgba(63,185,80,0.14)", fg: "#3fb950" }
    : { rotulo: "INACTIVO", bg: "#eef0f2", fg: "#64748b" };

  const painelConteudo = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: 12,
          borderRadius: 12,
          border: `1px solid ${ativo ? "rgba(63, 185, 80, 0.38)" : RF_BORDER_STRONG}`,
          background: ativo ? "rgba(63, 185, 80, 0.08)" : "rgba(6, 13, 8, 0.45)",
        }}
      >
        <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 0, alignItems: "flex-start" }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: ativo ? "rgba(63, 185, 80, 0.16)" : "rgba(146, 255, 0, 0.1)",
              border: `1px solid ${ativo ? "rgba(63, 185, 80, 0.35)" : "rgba(146, 255, 0, 0.22)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <Bell size={20} color={ativo ? "#86efac" : RF_ACCENT} aria-hidden />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <span id="followup-ativo-label" style={{ fontSize: 13, fontWeight: 700, color: RF_TEXT_PRIMARY }}>
                Follow-up automático
              </span>
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
            </div>
            <span
              style={{
                display: "block",
                marginTop: 4,
                fontSize: 11,
                lineHeight: 1.45,
                color: RF_TEXT_SECONDARY,
              }}
            >
              Cron envia lembretes quando o cliente fica sem responder — mensagens fixas por passo.
            </span>
          </div>
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
              color: ativo ? "#3fb950" : RF_TEXT_MUTED,
            }}
          >
            {ativo ? "ACTIVO" : "INACTIVO"}
          </span>
          <CrmToggleSwitch
            checked={ativo}
            disabled={loading || saving || !config}
            variant="dark"
            labelledBy="followup-ativo-label"
            onCheckedChange={(v) => void salvarConfig({ ativo: v })}
          />
        </div>
      </div>

      <div style={rfInnerPanelStyle()}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: RF_ACCENT }}>
            Alcance automático
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: RF_TEXT_SECONDARY, lineHeight: 1.45 }}>
            Com follow-up <strong style={{ color: RF_TEXT_PRIMARY }}>ACTIVO</strong>, o cron percorre{" "}
            <strong style={{ color: RF_TEXT_PRIMARY }}>todos os leads</strong> deste agente com WhatsApp —
            excepto arquivados, ganhos, perdidos ou com atendimento humano. Mensagens fixas, sem IA.
            Use <code style={{ color: RF_ACCENT }}>{"{nome}"}</code> no texto.
          </p>
        </div>
      </div>

      <div style={rfInnerPanelStyle()}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: RF_ACCENT }}>
            Regra de arquivamento
          </p>
        </div>
        <div style={{ padding: "12px 14px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 160px" }}>
            <span style={rfLabelStyle()}>Arquivar lead após (dias)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={config?.arquivar_apos_dias ?? 7}
              onChange={(e) =>
                setConfig((c) =>
                  c ? { ...c, arquivar_apos_dias: Number.parseInt(e.target.value, 10) || 7 } : c
                )
              }
              style={rfInputStyle()}
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void salvarConfig({ arquivar_apos_dias: config?.arquivar_apos_dias ?? 7 })}
            style={{ ...btnSecondaryDark(saving), width: "auto", padding: "9px 14px" }}
          >
            Guardar regra
          </button>
        </div>
      </div>

      {passosAtivos > 0 && (
        <div
          style={{
            borderRadius: 10,
            border: `1px solid ${RF_BORDER}`,
            padding: 10,
            background: "rgba(6,13,8,0.35)",
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: RF_ACCENT }}>
            Cadência
          </p>
          {passosOrdenados
            .filter((p) => p.ativo)
            .map((p) => (
              <div
                key={`prev-${p.id}`}
                style={{
                  display: "flex",
                  gap: 8,
                  fontSize: 11,
                  color: RF_TEXT_SECONDARY,
                  marginBottom: 4,
                }}
              >
                <span style={{ fontWeight: 800, color: RF_ACCENT, minWidth: 72 }}>
                  +{formatarAtrasoPasso(p)}
                </span>
                <span style={{ flex: 1 }}>
                  {p.imagem_url ? "🖼 " : ""}
                  {(p.texto_template || "—").slice(0, 70)}
                </span>
              </div>
            ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: RF_ACCENT }}>
          Passos ({passosOrdenados.length})
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={() => void adicionarPasso()}
          style={{
            ...btnSecondaryDark(saving),
            width: "auto",
            padding: "6px 10px",
            fontSize: 11,
          }}
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {passosOrdenados.map((passo) => (
          <div
            key={passo.id}
            draggable={!saving}
            onDragStart={() => setDragPassoId(passo.id)}
            onDragEnd={() => {
              setDragPassoId(null);
              setDragOverPassoId(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverPassoId(passo.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragPassoId) reorderLocal(dragPassoId, passo.id);
              setDragOverPassoId(null);
            }}
            style={{
              border: `1px solid ${dragOverPassoId === passo.id ? RF_ACCENT : RF_BORDER}`,
              borderRadius: 12,
              padding: 12,
              background: "rgba(6,13,8,0.45)",
              opacity: dragPassoId === passo.id ? 0.55 : 1,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span style={{ cursor: "grab", color: RF_TEXT_MUTED }} title="Arrastar">
                <GripVertical size={18} />
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: RF_ACCENT,
                  background: "rgba(146,255,0,0.14)",
                  padding: "4px 10px",
                  borderRadius: 999,
                }}
              >
                Passo {passo.ordem}
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginLeft: "auto",
                }}
              >
                <span
                  id={`followup-passo-ativo-${passo.id}`}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: passo.ativo ? "#3fb950" : RF_TEXT_MUTED,
                  }}
                >
                  {passo.ativo ? "ACTIVO" : "INACTIVO"}
                </span>
                <CrmToggleSwitch
                  checked={passo.ativo}
                  disabled={saving}
                  variant="dark"
                  labelledBy={`followup-passo-ativo-${passo.id}`}
                  onCheckedChange={(v) => {
                    atualizarPassoLocal(passo.id, { ativo: v });
                    void salvarPasso({ ...passo, ativo: v });
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => void excluirPasso(passo.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#f85149",
                  cursor: "pointer",
                  padding: 4,
                }}
                aria-label="Excluir"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                gap: 10,
              }}
            >
              <label>
                <span style={rfLabelStyle()}>Horas</span>
                <input
                  type="number"
                  min={0}
                  max={8760}
                  value={passo.atraso_horas}
                  onChange={(e) =>
                    atualizarPassoLocal(passo.id, {
                      atraso_horas: clampHoras(Number.parseInt(e.target.value, 10) || 0),
                    })
                  }
                  style={rfInputStyle()}
                />
              </label>
              <label>
                <span style={rfLabelStyle()}>Minutos</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={passo.atraso_minutos ?? 0}
                  onChange={(e) =>
                    atualizarPassoLocal(passo.id, {
                      atraso_minutos: clampMinutos(Number.parseInt(e.target.value, 10) || 0),
                    })
                  }
                  style={rfInputStyle()}
                />
              </label>
              <label>
                <span style={rfLabelStyle()}>Conteúdo</span>
                <select
                  value={passo.tipo_conteudo}
                  onChange={(e) =>
                    atualizarPassoLocal(passo.id, {
                      tipo_conteudo: e.target.value as HubAgenteFollowupPasso["tipo_conteudo"],
                    })
                  }
                  style={rfInputStyle()}
                >
                  <option value="texto">Só texto</option>
                  <option value="imagem">Só imagem</option>
                  <option value="texto_imagem">Imagem + legenda</option>
                </select>
              </label>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 10, color: RF_TEXT_MUTED, lineHeight: 1.4 }}>
              Envia após{" "}
              <strong style={{ color: RF_ACCENT }}>{formatarAtrasoPasso(passo)}</strong> sem resposta
              do cliente (desde a última mensagem recebida).
              {atrasoTotalMinutos(passo) < 60 ? (
                <> Ideal para testes em produção.</>
              ) : null}
            </p>

            <label style={{ display: "block", marginTop: 10 }}>
              <span style={rfLabelStyle()}>Mensagem</span>
              <textarea
                rows={2}
                value={passo.texto_template || ""}
                onChange={(e) => atualizarPassoLocal(passo.id, { texto_template: e.target.value })}
                style={{ ...rfInputStyle(), resize: "vertical" }}
              />
            </label>

            {(passo.tipo_conteudo === "imagem" || passo.tipo_conteudo === "texto_imagem") && (
              <div style={{ marginTop: 10 }}>
                <span style={rfLabelStyle()}>Imagem (bucket agent-followup)</span>
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverImagemId(passo.id);
                  }}
                  onDragLeave={() =>
                    setDragOverImagemId((id) => (id === passo.id ? null : id))
                  }
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverImagemId(null);
                    const f = e.dataTransfer.files?.[0];
                    if (f && f.type.startsWith("image/")) void uploadImagem(passo.id, f);
                  }}
                  style={{
                    display: "block",
                    marginTop: 6,
                    padding: "16px 12px",
                    borderRadius: 10,
                    border: `2px dashed ${dragOverImagemId === passo.id ? RF_ACCENT : RF_BORDER_STRONG}`,
                    background:
                      dragOverImagemId === passo.id
                        ? "rgba(146,255,0,0.08)"
                        : "rgba(6,13,8,0.35)",
                    cursor: uploadingId === passo.id ? "wait" : "pointer",
                    textAlign: "center",
                  }}
                >
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    hidden
                    disabled={uploadingId === passo.id}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadImagem(passo.id, f);
                      e.target.value = "";
                    }}
                    id={`followup-img-${passo.id}`}
                  />
                  <label
                    htmlFor={`followup-img-${passo.id}`}
                    style={{
                      cursor: "inherit",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Upload size={22} color={RF_ACCENT} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: RF_TEXT_PRIMARY }}>
                      {uploadingId === passo.id ? "A enviar…" : "Clique ou arraste a imagem"}
                    </span>
                  </label>
                </label>

                {passo.imagem_url ? (
                  <div
                    style={{
                      marginTop: 10,
                      border: `1px solid ${RF_BORDER}`,
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "rgba(6,13,8,0.35)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "52px 1fr auto 36px",
                        gap: 8,
                        alignItems: "center",
                        padding: "8px 10px",
                      }}
                    >
                      <img
                        src={passo.imagem_url}
                        alt=""
                        style={{
                          width: 44,
                          height: 44,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: `1px solid ${RF_BORDER}`,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 12,
                            fontWeight: 700,
                            color: RF_TEXT_PRIMARY,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Imagem do passo {passo.ordem}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 10, color: RF_TEXT_MUTED }}>
                          Enviada · URL pública para WhatsApp
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          atualizarPassoLocal(passo.id, { imagem_url: null });
                          void salvarPasso({ ...passo, imagem_url: null });
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: RF_TEXT_MUTED,
                          cursor: "pointer",
                          padding: 4,
                        }}
                        aria-label="Remover imagem"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => void salvarPasso(passo)}
              style={{
                ...btnPrimaryDark(saving),
                marginTop: 10,
                width: "auto",
                padding: "8px 14px",
                fontSize: 12,
              }}
            >
              Guardar passo
            </button>
          </div>
        ))}
      </div>

      {okMsg ? <p style={{ margin: 0, fontSize: 12, color: RF_ACCENT }}>{okMsg}</p> : null}
      {erro ? <p style={{ margin: 0, fontSize: 12, color: "#f85149" }}>{erro}</p> : null}
    </div>
  );

  const sideoverFooter = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        type="button"
        disabled={testing || saving || !ativo}
        style={btnPrimaryDark(testing || !ativo)}
        onClick={() => void testarAgora()}
      >
        {testing ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
        Testar envio agora
      </button>
      {isCard ? (
        <button type="button" style={btnSecondaryDark(false)} onClick={() => setSideoverOpen(false)}>
          Fechar
        </button>
      ) : null}
    </div>
  );

  if (!agenteSlug.trim()) return null;

  if (!isCard) {
    return (
      <CrmIntegracaoSideoverShell
        embedded
        open
        onClose={() => {}}
        title={agenteNome?.trim() || agenteSlug}
        subtitle="Cadência de lembretes WhatsApp"
        footer={sideoverFooter}
        theme="dark"
        sectionLabel="Follow-up"
        loading={loading}
      >
        {painelConteudo}
      </CrmIntegracaoSideoverShell>
    );
  }

  return (
    <>
      <div
        style={{
          marginBottom: 18,
          borderRadius: 14,
          border: "1px solid #dcebd8",
          background: "#ffffff",
          boxShadow: "0 4px 16px rgba(11, 31, 16, 0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 3,
            background: `linear-gradient(90deg, ${CRM_ACCENT}, #128c7e, #c9a24a)`,
            opacity: 0.95,
          }}
          aria-hidden
        />
        <div style={{ padding: "14px 16px 16px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 12, minWidth: 0, alignItems: "center" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(146,255,0,0.14)",
                  border: "1px solid rgba(146,255,0,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bell size={20} color={CRM_ACCENT} aria-hidden />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: BRAND_TEXT_DARK, fontSize: 14, fontWeight: 800 }}>
                  Follow-up automático WhatsApp
                </p>
                <p style={{ margin: "4px 0 0", color: "#5d7a67", fontSize: 12, lineHeight: 1.45 }}>
                  Lembretes após silêncio do cliente ·{" "}
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 800,
                      background: badge.bg,
                      color: badge.fg,
                    }}
                  >
                    {loading ? "…" : badge.rotulo}
                  </span>
                  {!loading && ativo ? (
                    <span style={{ marginLeft: 6, fontSize: 11, color: "#5d7a67" }}>
                      · {passosAtivos} passo(s)
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSideoverOpen(true)}
              style={{
                ...crmBtnPrimaryLg(false),
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                flex: "none",
                padding: "9px 14px",
              }}
            >
              Configurar passos
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <CrmIntegracaoSideoverShell
        open={sideoverOpen}
        onClose={() => setSideoverOpen(false)}
        title={agenteNome?.trim() || agenteSlug}
        subtitle="Mensagens fixas por passo — texto e imagem no bucket agent-followup"
        footer={sideoverFooter}
        theme="dark"
        sectionLabel="Follow-up WhatsApp"
        loading={loading}
      >
        {painelConteudo}
      </CrmIntegracaoSideoverShell>
    </>
  );
}
