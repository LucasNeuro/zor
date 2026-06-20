"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Save, Trash2 } from "lucide-react";
import { CrmRetrofitSideoverShell } from "@/components/crm/CrmRetrofitSideoverShell";
import { RF_ACCENT, rfBodyOnDarkStyle } from "@/lib/crm/crm-retrofit-dark-theme";
import { opsApiHeaders } from "@/lib/ops-api-headers-client";

export type LeadInteresseRow = {
  id: string;
  criado_em: string;
  nome: string;
  email: string;
  telefone: string | null;
  empresa: string | null;
  mensagem: string | null;
  interesse_principal: string | null;
  tamanho_equipe: string | null;
  prazo_inicio: string | null;
  origem: string;
  pagina_url: string | null;
  respostas: unknown;
};

type Props = {
  open: boolean;
  lead: LeadInteresseRow | null;
  onClose: () => void;
  onUpdated: (row: LeadInteresseRow) => void;
  onDeleted?: (id: string) => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a9a7e]">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-[rgba(146,255,0,0.2)] bg-[#0b1f10] px-3 py-2 text-sm text-[#e8f5e9] outline-none focus:border-[#92ff00]";

export function WajeOwnerLeadSideover({ open, lead, onClose, onUpdated, onDeleted }: Props) {
  const [form, setForm] = useState<Partial<LeadInteresseRow>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (lead) setForm({ ...lead });
    else setForm({});
    setErro("");
  }, [lead]);

  async function salvar() {
    if (!lead) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/ops/landing-interesse/${encodeURIComponent(lead.id)}`, {
        method: "PATCH",
        headers: { ...(await opsApiHeaders()), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as { error?: string; data?: LeadInteresseRow };
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar.");
      onUpdated({ ...lead, ...form, ...(json.data ?? {}) } as LeadInteresseRow);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!lead || !confirm("Apagar este lead permanentemente?")) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/ops/landing-interesse/${encodeURIComponent(lead.id)}`, {
        method: "DELETE",
        headers: await opsApiHeaders(),
        credentials: "include",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha ao apagar.");
      onDeleted?.(lead.id);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao apagar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      kindLabel="Landing"
      title={lead?.nome ?? "Lead"}
      subtitle={lead?.empresa ?? lead?.email}
      icon={Mail}
      footer={
        lead ? (
          <div className="flex w-full flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void apagar()}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold text-[#f87171]"
              style={{ borderColor: "rgba(248,113,113,0.35)" }}
            >
              <Trash2 size={14} />
              Apagar
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
      {!lead ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="animate-spin" style={{ color: RF_ACCENT }} size={22} />
        </div>
      ) : (
        <div className="space-y-4" style={rfBodyOnDarkStyle()}>
          {erro ? <p className="text-sm text-[#f87171]">{erro}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome">
              <input className={inputCls} value={form.nome ?? ""} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </Field>
            <Field label="E-mail">
              <input className={inputCls} type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Telefone">
              <input className={inputCls} value={form.telefone ?? ""} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            </Field>
            <Field label="Empresa">
              <input className={inputCls} value={form.empresa ?? ""} onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} />
            </Field>
            <Field label="Interesse principal">
              <input className={inputCls} value={form.interesse_principal ?? ""} onChange={(e) => setForm((f) => ({ ...f, interesse_principal: e.target.value }))} />
            </Field>
            <Field label="Tamanho equipe">
              <input className={inputCls} value={form.tamanho_equipe ?? ""} onChange={(e) => setForm((f) => ({ ...f, tamanho_equipe: e.target.value }))} />
            </Field>
            <Field label="Prazo início">
              <input className={inputCls} value={form.prazo_inicio ?? ""} onChange={(e) => setForm((f) => ({ ...f, prazo_inicio: e.target.value }))} />
            </Field>
            <Field label="Origem">
              <input className={inputCls} value={form.origem ?? ""} onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value }))} />
            </Field>
          </div>
          <Field label="Mensagem">
            <textarea className={`${inputCls} min-h-[88px]`} value={form.mensagem ?? ""} onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))} />
          </Field>
          <Field label="URL página">
            <input className={inputCls} value={form.pagina_url ?? ""} onChange={(e) => setForm((f) => ({ ...f, pagina_url: e.target.value }))} />
          </Field>
          <Field label="Respostas (JSON)">
            <textarea
              className={`${inputCls} min-h-[100px] font-mono text-xs`}
              value={typeof form.respostas === "string" ? form.respostas : JSON.stringify(form.respostas ?? [], null, 2)}
              onChange={(e) => {
                try {
                  setForm((f) => ({ ...f, respostas: JSON.parse(e.target.value) }));
                } catch {
                  setForm((f) => ({ ...f, respostas: e.target.value }));
                }
              }}
            />
          </Field>
        </div>
      )}
    </CrmRetrofitSideoverShell>
  );
}
