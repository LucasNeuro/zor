"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Trash2, UserCog } from "lucide-react";
import { CrmRetrofitSideoverShell } from "@/components/crm/CrmRetrofitSideoverShell";
import { RF_ACCENT, rfBodyOnDarkStyle } from "@/lib/crm/crm-retrofit-dark-theme";
import { WajeOwnerStatusBadge } from "@/components/crm/waje/WajeOwnerUi";
import type { TenantRow } from "@/components/crm/waje/WajeOwnerTenantSideover";
import { opsApiHeaders } from "@/lib/ops-api-headers-client";

export type UsuarioRow = {
  id: string;
  auth_id: string | null;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  status: string;
  tenant_id: string | null;
  tenant_nome: string | null;
  owner: boolean;
  access_role_id: string | null;
  document_type: string | null;
  document: string | null;
  billing_legal_name: string | null;
  criado_em: string | null;
};

type Props = {
  open: boolean;
  usuario: UsuarioRow | null;
  tenants: TenantRow[];
  onClose: () => void;
  onUpdated: (row: UsuarioRow) => void;
  onDeleted?: (id: string) => void;
};

const ROLES = ["owner", "admin", "commercial", "vendedor", "atendente", "parceiro"];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a9a7e]">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-[rgba(146,255,0,0.2)] bg-[#0b1f10] px-3 py-2 text-sm text-[#e8f5e9] outline-none focus:border-[#92ff00]";

export function WajeOwnerUsuarioSideover({
  open,
  usuario,
  tenants,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const [form, setForm] = useState<Partial<UsuarioRow>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (usuario) setForm({ ...usuario });
    else setForm({});
    setErro("");
  }, [usuario]);

  async function salvar() {
    if (!usuario) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/ops/users/${encodeURIComponent(usuario.id)}`, {
        method: "PATCH",
        headers: { ...(await opsApiHeaders()), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          status: form.status,
          tenant_id: form.tenant_id,
          owner: form.owner,
          document_type: form.document_type,
          document: form.document,
          billing_legal_name: form.billing_legal_name,
        }),
      });
      const json = (await res.json()) as { error?: string; data?: UsuarioRow };
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar.");
      const tenant_nome =
        tenants.find((t) => t.id === form.tenant_id)?.nome ?? form.tenant_nome ?? null;
      onUpdated({ ...usuario, ...form, tenant_nome } as UsuarioRow);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function desativar() {
    if (!usuario || !confirm("Desativar este utilizador?")) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/ops/users/${encodeURIComponent(usuario.id)}`, {
        method: "DELETE",
        headers: await opsApiHeaders(),
        credentials: "include",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao desativar.");
      onDeleted?.(usuario.id);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao desativar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      kindLabel="Plataforma"
      title={usuario?.name ?? "Utilizador"}
      subtitle={usuario?.email}
      icon={UserCog}
      footer={
        usuario ? (
          <div className="flex w-full flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void desativar()}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold text-[#f87171]"
              style={{ borderColor: "rgba(248,113,113,0.35)" }}
            >
              <Trash2 size={14} />
              Desativar
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-xs font-bold" style={{ borderColor: "rgba(146,255,0,0.25)", color: "#b8d4bc" }}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={() => void salvar()}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-60"
              style={{ background: RF_ACCENT, color: "#0b1f10" }}
            >
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar
            </button>
          </div>
        ) : null
      }
    >
      {!usuario ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="animate-spin" style={{ color: RF_ACCENT }} size={22} />
        </div>
      ) : (
        <div className="space-y-4" style={rfBodyOnDarkStyle()}>
          <div className="flex flex-wrap gap-2">
            <WajeOwnerStatusBadge
              variant={form.status === "ativo" || form.status === "Ativo" ? "ativo" : "inativo"}
            />
            {form.owner ? <WajeOwnerStatusBadge variant="ativo" label="Plataforma" /> : null}
          </div>
          {erro ? <p className="text-sm text-[#f87171]">{erro}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome">
              <input className={inputCls} value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="E-mail">
              <input className={inputCls} type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Telefone">
              <input className={inputCls} value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label="Papel (role)">
              <select className={inputCls} value={form.role ?? "owner"} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={form.status ?? "ativo"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="arquivado">Arquivado</option>
              </select>
            </Field>
            <Field label="Tenant">
              <select
                className={inputCls}
                value={form.tenant_id ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, tenant_id: e.target.value || null }))}
              >
                <option value="">— Sem tenant —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </Field>
            <Field label="Tipo documento">
              <select className={inputCls} value={form.document_type ?? ""} onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value || null }))}>
                <option value="">—</option>
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
              </select>
            </Field>
            <Field label="Documento">
              <input className={inputCls} value={form.document ?? ""} onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))} />
            </Field>
            <Field label="Razão social faturamento">
              <input className={inputCls} value={form.billing_legal_name ?? ""} onChange={(e) => setForm((f) => ({ ...f, billing_legal_name: e.target.value }))} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-[#b8d4bc]">
            <input
              type="checkbox"
              checked={Boolean(form.owner)}
              onChange={(e) => setForm((f) => ({ ...f, owner: e.target.checked }))}
            />
            Equipe plataforma Waje (owner=true — acesso /crm/waje)
          </label>
        </div>
      )}
    </CrmRetrofitSideoverShell>
  );
}
