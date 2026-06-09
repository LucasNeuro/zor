"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { AgenteSideoverEntityCard, AgenteSideoverInfoGrid } from "@/components/crm/AgenteSideoverCards";
import { CrmTelefoneCell } from "@/components/crm/CrmTelefoneCell";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { CrmSideoverFold } from "@/components/crm/CrmSideoverFold";
import { CadastroClienteAtendimentosTab } from "@/components/crm/cadastro/CadastroClienteAtendimentosTab";
import { CadastroClienteComprasTab } from "@/components/crm/cadastro/CadastroClienteComprasTab";
import {
  CadastroClienteSideoverTabs,
  type CadastroClienteTabId,
} from "@/components/crm/cadastro/CadastroClienteSideoverTabs";
import { CadastroClienteTimelineTab } from "@/components/crm/cadastro/CadastroClienteTimelineTab";
import { CadastroSideoverFooterActions } from "@/components/crm/cadastro/CadastroSideoverFooterActions";
import {
  CadastroPremiumSideover,
  CadastroSideoverPanel,
  CadastroTipoBadge,
} from "@/components/crm/cadastro/CadastroPremiumSideover";
import { useClienteCrmResumo } from "@/components/crm/cadastro/useClienteCrmResumo";
import { crmApiHeadersWithActor } from "@/lib/internal-api-headers-client";
import { formatarCnpjMascara, normalizarDocumento } from "@/lib/crm/documento-brasil";
import { EMPRESA_SEGMENTOS, labelEmpresaSegmento } from "@/lib/crm/empresa-cadastro";
import {
  buscarEnderecoPorCep,
  cepValidoParaBusca,
  formatarCepMascara,
} from "@/lib/crm/viacep";
import {
  RF_ACCENT,
  RF_BORDER_STRONG,
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

export type EmpresaLista = {
  id: string;
  codigo: string | null;
  razao_social: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  segmento: string | null;
  prefixo_mercado: string | null;
};

type EmpresaDetalhe = EmpresaLista & {
  nome_fantasia?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  ativo?: boolean | null;
  criado_em?: string | null;
};

type Actor = { id?: string; email?: string; name?: string };

const INPUT: React.CSSProperties = { ...RF_INPUT_STYLE, padding: "10px 12px", fontSize: 13 };
const LABEL: React.CSSProperties = { ...RF_LABEL_STYLE, fontSize: 11, fontWeight: 600, marginBottom: 4 };

function formatarData(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  empresaId: string | null;
  mode: "view" | "edit" | null;
  actor: Actor;
  onClose: () => void;
  onDeleted: () => void;
  onSaved: () => void;
  onBackToView: () => void;
  onStartEdit: () => void;
};

export function CadastroEmpresaSideover({
  empresaId,
  mode,
  actor,
  onClose,
  onDeleted,
  onSaved,
  onBackToView,
  onStartEdit,
}: Props) {
  const open = Boolean(empresaId && mode);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [erro, setErro] = useState("");
  const [empresa, setEmpresa] = useState<EmpresaDetalhe | null>(null);
  const [form, setForm] = useState<Partial<EmpresaDetalhe>>({});
  const [secIdentidade, setSecIdentidade] = useState(true);
  const [secContacto, setSecContacto] = useState(true);
  const [secEndereco, setSecEndereco] = useState(true);
  const [tab, setTab] = useState<CadastroClienteTabId>("timeline");

  const { resumo, loading: loadingResumo } = useClienteCrmResumo(
    "empresa",
    empresaId,
    actor,
    open && mode === "view"
  );

  const carregar = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/empresas/${encodeURIComponent(empresaId)}`, {
        credentials: "include",
        headers: await crmApiHeadersWithActor(actor),
      });
      const data = (await res.json().catch(() => ({}))) as { data?: EmpresaDetalhe; error?: string };
      if (!res.ok) {
        setErro(data.error || `Não foi possível carregar a empresa (${res.status}).`);
        return;
      }
      setEmpresa(data.data ?? null);
      setForm(data.data ?? {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede.";
      setErro(msg);
    } finally {
      setLoading(false);
    }
  }, [empresaId, actor.id, actor.email, actor.name]);

  useEffect(() => {
    if (!open) {
      setEmpresa(null);
      setForm({});
      setConfirmExcluir(false);
      setErro("");
      setTab("timeline");
      return;
    }
    if (mode === "view") setTab("timeline");
    void carregar();
  }, [open, mode, carregar]);

  async function salvar() {
    if (!empresaId) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/empresas/${encodeURIComponent(empresaId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(await crmApiHeadersWithActor(actor)),
        },
        body: JSON.stringify({
          razao_social: form.razao_social,
          nome_fantasia: form.nome_fantasia,
          cnpj: form.cnpj ? normalizarDocumento(String(form.cnpj)) : undefined,
          email: form.email,
          telefone: form.telefone,
          segmento: form.segmento,
          prefixo_mercado: form.prefixo_mercado,
          cep: form.cep,
          logradouro: form.logradouro,
          numero: form.numero,
          complemento: form.complemento,
          bairro: form.bairro,
          cidade: form.cidade,
          estado: form.estado,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error || "Falha ao guardar.");
        return;
      }
      onSaved();
      onBackToView();
      void carregar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede.";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!empresaId) return;
    setExcluindo(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/empresas/${encodeURIComponent(empresaId)}`, {
        method: "DELETE",
        credentials: "include",
        headers: await crmApiHeadersWithActor(actor),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error || "Não foi possível excluir.");
        return;
      }
      onDeleted();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede.";
      setErro(msg);
    } finally {
      setExcluindo(false);
      setConfirmExcluir(false);
    }
  }

  const cnpjFmt = empresa?.cnpj ? formatarCnpjMascara(empresa.cnpj) : "—";

  const footer =
    mode === "view" ? (
      <CadastroSideoverFooterActions
        mode="view"
        onEdit={onStartEdit}
        onDelete={() => setConfirmExcluir(true)}
      />
    ) : (
      <CadastroSideoverFooterActions
        mode="edit"
        onBack={onBackToView}
        onSave={() => void salvar()}
        saving={salvando}
      />
    );

  return (
    <>
    <CadastroPremiumSideover
      open={open}
      onClose={onClose}
      kindLabel={mode === "edit" ? "EDITAR EMPRESA" : "EMPRESA"}
      title={empresa?.razao_social || (loading ? "Carregando…" : "—")}
      subtitle={empresa?.codigo || undefined}
      Icon={Building2}
      accent="#3b82f6"
      badge={
        empresa?.ativo === false ? (
          <CadastroTipoBadge label="Inativa" tone="muted" />
        ) : (
          <CadastroTipoBadge label="Ativa" tone="green" />
        )
      }
      footer={footer}
    >
      {loading && <p style={{ color: "#5d7a67", fontSize: 13 }}>Carregando dados da empresa…</p>}
      {erro && (
        <div
          style={{
            color: "#f87171",
            background: "#3a1518",
            border: "1px solid #7f1d1d",
            borderRadius: 8,
            padding: 10,
            fontSize: 13,
            marginBottom: 12,
          }}
          role="alert"
        >
          <p style={{ margin: 0 }}>{erro}</p>
          <button
            type="button"
            onClick={() => void carregar()}
            style={{
              marginTop: 8,
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #7f1d1d",
              background: "transparent",
              color: "#fca5a5",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {mode === "view" && empresa && !loading && (
        <>
          <CadastroClienteSideoverTabs
            tab={tab}
            onTabChange={setTab}
            comprasCount={resumo.negocios.length}
            atendimentosCount={resumo.leads.length}
          />

          {tab === "timeline" ? (
            <CadastroClienteTimelineTab
              events={resumo.timeline_events}
              loading={loadingResumo}
              clienteNome={empresa.razao_social}
            />
          ) : null}

          {tab === "compras" ? (
            <CadastroClienteComprasTab negocios={resumo.negocios} loading={loadingResumo} />
          ) : null}

          {tab === "atendimentos" ? (
            <CadastroClienteAtendimentosTab leads={resumo.leads} loading={loadingResumo} />
          ) : null}

          {tab === "dados" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <AgenteSideoverEntityCard
                accent="#3b82f6"
                Icon={Building2}
                avatarCaption={empresa.codigo || "Empresa"}
                footer={
                  <AgenteSideoverInfoGrid
                    rows={[
                      { label: "CNPJ", value: cnpjFmt },
                      {
                        label: "Telefone",
                        value: empresa.telefone ? (
                          <CrmTelefoneCell telefone={empresa.telefone} />
                        ) : (
                          "—"
                        ),
                      },
                      { label: "E-mail", value: empresa.email || "—" },
                    ]}
                  />
                }
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 800,
                    color: RF_TEXT_PRIMARY,
                    lineHeight: 1.35,
                  }}
                >
                  {empresa.razao_social}
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
                  {empresa.nome_fantasia || "Sem nome fantasia"}
                  {` · ${labelEmpresaSegmento(empresa.segmento)}`}
                </p>
              </AgenteSideoverEntityCard>

              <CadastroSideoverPanel>
                <CrmSideoverFold
                  isFirst
                  title="Identidade"
                  open={secIdentidade}
                  onToggle={() => setSecIdentidade((o) => !o)}
                >
                  <AgenteSideoverInfoGrid
                    rows={[
                      { label: "Código", value: empresa.codigo || "—" },
                      { label: "Razão social", value: empresa.razao_social },
                      { label: "Nome fantasia", value: empresa.nome_fantasia || "—" },
                      { label: "CNPJ", value: cnpjFmt },
                      { label: "Segmento", value: labelEmpresaSegmento(empresa.segmento) },
                      { label: "Criado em", value: formatarData(empresa.criado_em) },
                    ]}
                  />
                </CrmSideoverFold>

                <CrmSideoverFold
                  title="Contato"
                  open={secContacto}
                  onToggle={() => setSecContacto((o) => !o)}
                >
                  <AgenteSideoverInfoGrid
                    rows={[
                      {
                        label: "Telefone",
                        value: empresa.telefone ? (
                          <CrmTelefoneCell telefone={empresa.telefone} />
                        ) : (
                          "—"
                        ),
                      },
                      { label: "E-mail", value: empresa.email || "—" },
                    ]}
                  />
                </CrmSideoverFold>

                <CrmSideoverFold
                  title="Endereço"
                  open={secEndereco}
                  onToggle={() => setSecEndereco((o) => !o)}
                >
                  <AgenteSideoverInfoGrid
                    rows={[
                      { label: "CEP", value: empresa.cep || "—" },
                      { label: "Logradouro", value: empresa.logradouro || "—" },
                      { label: "Número", value: empresa.numero || "—" },
                      { label: "Complemento", value: empresa.complemento || "—" },
                      { label: "Bairro", value: empresa.bairro || "—" },
                      {
                        label: "Cidade / UF",
                        value: [empresa.cidade, empresa.estado].filter(Boolean).join(" / ") || "—",
                      },
                    ]}
                  />
                </CrmSideoverFold>
              </CadastroSideoverPanel>
            </div>
          ) : null}
        </>
      )}

      {mode === "edit" && !loading && empresa && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={LABEL}>Razão social</label>
            <input
              style={INPUT}
              value={form.razao_social || ""}
              onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))}
            />
          </div>
          <div>
            <label style={LABEL}>Nome fantasia</label>
            <input
              style={INPUT}
              value={form.nome_fantasia || ""}
              onChange={(e) => setForm((f) => ({ ...f, nome_fantasia: e.target.value }))}
            />
          </div>
          <div>
            <label style={LABEL}>Segmento</label>
            <select
              style={INPUT}
              value={form.segmento || "cliente"}
              onChange={(e) => setForm((f) => ({ ...f, segmento: e.target.value }))}
            >
              {EMPRESA_SEGMENTOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={LABEL}>Telefone</label>
            <input
              style={INPUT}
              value={form.telefone || ""}
              onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
            />
          </div>
          <div>
            <label style={LABEL}>E-mail</label>
            <input
              style={INPUT}
              type="email"
              value={form.email || ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
        </div>
      )}
    </CadastroPremiumSideover>

    <CrmConfirmDialog
      open={confirmExcluir}
      title="Excluir empresa?"
      variant="destructive"
      confirmLabel="Confirmar exclusão"
      loading={excluindo}
      loadingLabel="Excluindo…"
      onCancel={() => !excluindo && setConfirmExcluir(false)}
      onConfirm={() => void excluir()}
    >
      <p style={{ margin: "0 0 10px" }}>
        A empresa <strong style={{ color: "#0b1f10" }}>«{empresa?.razao_social || empresa?.nome_fantasia || "—"}»</strong> será
        removida permanentemente.
      </p>
      <p style={{ margin: 0, color: "#b3261e", fontWeight: 600 }}>Esta operação não pode ser desfeita.</p>
      <p style={{ margin: "10px 0 0", fontSize: 12 }}>
        A exclusão será registada em auditoria{actor.email ? ` (${actor.email})` : ""}.
      </p>
    </CrmConfirmDialog>
    </>
  );
}
