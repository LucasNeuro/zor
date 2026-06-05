"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Trash2, User } from "lucide-react";
import { AgenteSideoverEntityCard, AgenteSideoverInfoGrid } from "@/components/crm/AgenteSideoverCards";
import { CrmTelefoneCell } from "@/components/crm/CrmTelefoneCell";
import { CrmSideoverFold } from "@/components/crm/CrmSideoverFold";
import {
  CadastroPremiumSideover,
  CadastroSideoverPanel,
  CadastroTipoBadge,
} from "@/components/crm/cadastro/CadastroPremiumSideover";
import { crmApiHeadersWithActor } from "@/lib/internal-api-headers-client";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";
import {
  formatarCnpjMascara,
  formatarCpfMascara,
  normalizarDocumento,
} from "@/lib/crm/documento-brasil";
import { labelAreaAtuacao, AREA_ATUACAO_SELECT_OPTIONS } from "@/lib/crm/areas-atuacao";
import {
  buscarEnderecoPorCep,
  cepValidoParaBusca,
  formatarCepMascara,
} from "@/lib/crm/viacep";

export type ContactoLista = {
  id: string;
  codigo: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  tipo_pessoa: string | null;
  cidade: string | null;
  estado: string | null;
  area_atuacao: string | null;
};

type PessoaDetalhe = ContactoLista & {
  documento?: string | null;
  empresa?: string | null;
  tipo?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  origem?: string | null;
  criado_em?: string | null;
  dados_extras?: Record<string, unknown>;
};

type Actor = { id?: string; email?: string; name?: string };

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #dcebd8",
  background: "#ffffff",
  color: "#0b2210",
  fontSize: 13,
  boxSizing: "border-box",
};

const LABEL: React.CSSProperties = {
  color: "#5d7a67",
  fontSize: 11,
  fontWeight: 600,
  display: "block",
  marginBottom: 4,
};

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

function mercadosDeExtras(dados?: Record<string, unknown>): string[] {
  const raw = dados?.mercados;
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => labelMercadoPrefixo(String(m))).filter(Boolean);
}

type Props = {
  pessoaId: string | null;
  mode: "view" | "edit" | null;
  actor: Actor;
  onClose: () => void;
  onDeleted: () => void;
  onSaved: () => void;
  onStartEdit: () => void;
  onBackToView: () => void;
};

export function CadastroContactoSideover({
  pessoaId,
  mode,
  actor,
  onClose,
  onDeleted,
  onSaved,
  onStartEdit,
  onBackToView,
}: Props) {
  const open = Boolean(pessoaId && mode);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [erro, setErro] = useState("");
  const [pessoa, setPessoa] = useState<PessoaDetalhe | null>(null);
  const [form, setForm] = useState<Partial<PessoaDetalhe>>({});
  const [secIdentidade, setSecIdentidade] = useState(true);
  const [secContacto, setSecContacto] = useState(true);
  const [secEndereco, setSecEndereco] = useState(true);
  const [secCrm, setSecCrm] = useState(true);

  const carregar = useCallback(async () => {
    if (!pessoaId) return;
    setLoading(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/pessoas/${encodeURIComponent(pessoaId)}`, {
        credentials: "include",
        headers: await crmApiHeadersWithActor(actor),
      });
      const data = (await res.json().catch(() => ({}))) as { data?: PessoaDetalhe; error?: string };
      if (!res.ok) {
        setErro(data.error || `Não foi possível carregar o contato (${res.status}).`);
        return;
      }
      setPessoa(data.data ?? null);
      setForm(data.data ?? {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede.";
      setErro(msg);
    } finally {
      setLoading(false);
    }
  }, [pessoaId, actor.id, actor.email, actor.name]);

  useEffect(() => {
    if (!open) {
      setPessoa(null);
      setForm({});
      setConfirmExcluir(false);
      setErro("");
      return;
    }
    void carregar();
  }, [open, carregar]);

  async function salvar() {
    if (!pessoaId) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/pessoas/${encodeURIComponent(pessoaId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(await crmApiHeadersWithActor(actor)),
        },
        body: JSON.stringify({
          nome: form.nome,
          telefone: form.telefone,
          email: form.email,
          documento: form.documento ? normalizarDocumento(String(form.documento)) : undefined,
          empresa: form.empresa,
          area_atuacao: form.area_atuacao,
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
    if (!pessoaId) return;
    setExcluindo(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/pessoas/${encodeURIComponent(pessoaId)}`, {
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

  const docFmt =
    pessoa?.documento && pessoa.tipo_pessoa === "PJ"
      ? formatarCnpjMascara(pessoa.documento)
      : pessoa?.documento
        ? formatarCpfMascara(pessoa.documento)
        : "—";

  const mercados = mercadosDeExtras(pessoa?.dados_extras);
  const opencnpj = pessoa?.dados_extras?.opencnpj as Record<string, unknown> | undefined;
  const situacaoCnpj =
    opencnpj && typeof opencnpj.situacao_cadastral === "string"
      ? opencnpj.situacao_cadastral
      : null;

  const footer =
    mode === "view" ? (
      <>
        <button
          type="button"
          onClick={onStartEdit}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #dcebd8",
            background: "#eef7eb",
            color: "#0b2210",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <Pencil size={16} /> Editar
        </button>
        {!confirmExcluir ? (
          <button
            type="button"
            onClick={() => setConfirmExcluir(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #f8514966",
              background: "transparent",
              color: "#f85149",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            <Trash2 size={16} /> Excluir
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirmExcluir(false)}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #dcebd8",
                background: "transparent",
                color: "#5d7a67",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void excluir()}
              disabled={excluindo}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "#da3633",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {excluindo ? "Excluindo…" : "Confirmar exclusão"}
            </button>
          </>
        )}
      </>
    ) : (
      <>
        <button
          type="button"
          onClick={onBackToView}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #dcebd8",
            background: "transparent",
            color: "#5d7a67",
            cursor: "pointer",
          }}
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#238636",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {salvando ? "Salvando…" : "Guardar alterações"}
        </button>
      </>
    );

  return (
    <CadastroPremiumSideover
      open={open}
      onClose={onClose}
      kindLabel={mode === "edit" ? "EDITAR CONTACTO" : "CONTACTO"}
      title={pessoa?.nome || (loading ? "Carregando…" : "—")}
      subtitle={pessoa?.codigo || undefined}
      Icon={User}
      badge={
        pessoa?.tipo_pessoa ? (
          <CadastroTipoBadge label={pessoa.tipo_pessoa === "PJ" ? "Pessoa jurídica" : "Pessoa física"} />
        ) : null
      }
      footer={footer}
    >
      {loading && <p style={{ color: "#5d7a67", fontSize: 13 }}>Carregando dados do contato…</p>}
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

      {mode === "view" && pessoa && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AgenteSideoverEntityCard
            accent="#c9a24a"
            Icon={User}
            avatarCaption={pessoa.codigo || "Cadastro"}
            footer={
              <AgenteSideoverInfoGrid
                rows={[
                  {
                    label: "Telefone",
                    value: pessoa.telefone ? (
                      <CrmTelefoneCell telefone={pessoa.telefone} />
                    ) : (
                      "—"
                    ),
                  },
                  { label: "E-mail", value: pessoa.email || "—" },
                  {
                    label: "Local",
                    value: [pessoa.cidade, pessoa.estado].filter(Boolean).join(" / ") || "—",
                  },
                ]}
              />
            }
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0b2210", lineHeight: 1.35 }}>
              {pessoa.nome}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
              {labelAreaAtuacao(pessoa.area_atuacao || "") || "Área não informada"}
              {pessoa.origem ? ` · origem ${pessoa.origem}` : ""}
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
                  { label: "Código", value: pessoa.codigo || "—" },
                  { label: "Tipo", value: pessoa.tipo_pessoa || "—" },
                  { label: "Documento", value: docFmt },
                  ...(pessoa.tipo_pessoa === "PJ"
                    ? [{ label: "Nome fantasia", value: pessoa.empresa || "—" }]
                    : []),
                  ...(situacaoCnpj ? [{ label: "Situação CNPJ", value: situacaoCnpj }] : []),
                ]}
              />
            </CrmSideoverFold>

            <CrmSideoverFold title="Contato" open={secContacto} onToggle={() => setSecContacto((o) => !o)}>
              <AgenteSideoverInfoGrid
                rows={[
                  {
                    label: "Telefone",
                    value: pessoa.telefone ? (
                      <CrmTelefoneCell telefone={pessoa.telefone} />
                    ) : (
                      "—"
                    ),
                  },
                  { label: "E-mail", value: pessoa.email || "—" },
                  { label: "Área", value: labelAreaAtuacao(pessoa.area_atuacao || "") || "—" },
                ]}
              />
            </CrmSideoverFold>

            <CrmSideoverFold title="Endereço" open={secEndereco} onToggle={() => setSecEndereco((o) => !o)}>
              <AgenteSideoverInfoGrid
                rows={[
                  { label: "CEP", value: pessoa.cep || "—" },
                  { label: "Logradouro", value: pessoa.logradouro || "—" },
                  { label: "Número", value: pessoa.numero || "—" },
                  { label: "Complemento", value: pessoa.complemento || "—" },
                  { label: "Bairro", value: pessoa.bairro || "—" },
                  {
                    label: "Cidade / UF",
                    value: [pessoa.cidade, pessoa.estado].filter(Boolean).join(" / ") || "—",
                  },
                ]}
              />
            </CrmSideoverFold>

            <CrmSideoverFold title="CRM e metadados" open={secCrm} onToggle={() => setSecCrm((o) => !o)}>
              <AgenteSideoverInfoGrid
                rows={[
                  { label: "Origem", value: pessoa.origem || "—" },
                  { label: "Criado em", value: formatarData(pessoa.criado_em) },
                  {
                    label: "Mercados",
                    value: mercados.length ? mercados.join(", ") : "—",
                  },
                ]}
              />
            </CrmSideoverFold>
          </CadastroSideoverPanel>

          {confirmExcluir && (
            <p style={{ fontSize: 12, color: "#f85149", margin: 0 }}>
              A exclusão será registada em auditoria
              {actor.email ? ` (${actor.email})` : ""}.
            </p>
          )}
        </div>
      )}

      {mode === "edit" && !loading && pessoa && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={LABEL}>Nome</label>
            <input
              style={INPUT}
              value={form.nome || ""}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
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
          <div>
            <label style={LABEL}>Área de atuação</label>
            <select
              style={INPUT}
              value={form.area_atuacao || ""}
              onChange={(e) => setForm((f) => ({ ...f, area_atuacao: e.target.value }))}
            >
              <option value="">—</option>
              {AREA_ATUACAO_SELECT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={LABEL}>CEP</label>
            <input
              style={INPUT}
              value={form.cep || ""}
              onChange={(e) => setForm((f) => ({ ...f, cep: formatarCepMascara(e.target.value) }))}
              onBlur={async () => {
                if (!cepValidoParaBusca(String(form.cep || ""))) return;
                const end = await buscarEnderecoPorCep(String(form.cep));
                if (end.ok) {
                  setForm((f) => ({
                    ...f,
                    logradouro: end.endereco.logradouro || f.logradouro,
                    bairro: end.endereco.bairro || f.bairro,
                    cidade: end.endereco.cidade || f.cidade,
                    estado: end.endereco.estado || f.estado,
                  }));
                }
              }}
            />
          </div>
          <div>
            <label style={LABEL}>Logradouro</label>
            <input
              style={INPUT}
              value={form.logradouro || ""}
              onChange={(e) => setForm((f) => ({ ...f, logradouro: e.target.value }))}
            />
          </div>
          <div>
            <label style={LABEL}>Número</label>
            <input
              style={INPUT}
              value={form.numero || ""}
              onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
              maxLength={20}
            />
          </div>
          <div>
            <label style={LABEL}>Complemento</label>
            <input
              style={INPUT}
              value={form.complemento || ""}
              onChange={(e) => setForm((f) => ({ ...f, complemento: e.target.value }))}
              maxLength={80}
            />
          </div>
          <div>
            <label style={LABEL}>Bairro</label>
            <input
              style={INPUT}
              value={form.bairro || ""}
              onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
            />
          </div>
          <div>
            <label style={LABEL}>Cidade</label>
            <input
              style={INPUT}
              value={form.cidade || ""}
              onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
            />
          </div>
          <div>
            <label style={LABEL}>UF</label>
            <input
              style={INPUT}
              maxLength={2}
              value={form.estado || ""}
              onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value.toUpperCase() }))}
            />
          </div>
        </div>
      )}
    </CadastroPremiumSideover>
  );
}

/** Botões de ação na linha da tabela */
export function CadastroRowActions({
  onView,
  onEdit,
}: {
  onView: () => void;
  onEdit: () => void;
}) {
  const btn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid #dcebd8",
    background: "#eef7eb",
    color: "#c9a24a",
    cursor: "pointer",
    marginLeft: 4,
  };
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      <button type="button" title="Ver detalhes" style={btn} onClick={onView}>
        <Eye size={15} />
      </button>
      <button type="button" title="Editar" style={btn} onClick={onEdit}>
        <Pencil size={15} />
      </button>
    </span>
  );
}
