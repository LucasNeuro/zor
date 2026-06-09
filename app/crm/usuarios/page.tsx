"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CrmResizableDataTable, type CrmResizableColumn } from "@/components/crm/CrmResizableDataTable";
import { UserCog, UserPlus, X } from "lucide-react";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { isCrmAdminRole } from "@/lib/crm-nav-groups";
import { supabase } from "@/lib/supabase/client";

type Usuario = {
  id: string;
  auth_id: string | null;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
};

const ROLES = ["owner", "admin", "vendedor", "atendente", "parceiro"] as const;

export default function UsuariosPage() {
  const [myRole, setMyRole] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "vendedor" });

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const row = await supabase.from("users").select("role").eq("auth_id", user.id).maybeSingle();
      setMyRole(row.data?.role != null ? String(row.data.role) : "");
    });
  }, []);

  const isAdmin = isCrmAdminRole(myRole);

  const carregar = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/usuarios", { headers: await crmApiHeaders() });
      const json = (await res.json()) as { data?: Usuario[]; error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao carregar equipa");
        setUsuarios([]);
      } else {
        setUsuarios(json.data ?? []);
      }
    } catch {
      setErro("Erro de rede");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (myRole) void carregar();
  }, [myRole, carregar]);

  async function convidar() {
    if (!form.email.trim()) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha no convite");
        return;
      }
      setModal(false);
      setForm({ email: "", name: "", role: "vendedor" });
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function atualizarRole(id: string, role: string) {
    const res = await fetch(`/api/crm/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
      body: JSON.stringify({ role }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setErro(json.error || "Falha ao atualizar papel");
      return;
    }
    await carregar();
  }

  const colunasUsuarios = useMemo((): CrmResizableColumn<Usuario>[] => {
    return [
      {
        id: "nome",
        label: "Nome",
        defaultWidth: 200,
        minWidth: 120,
        render: (u) => <span className="text-sm font-semibold text-[#0b2210]">{u.name || "—"}</span>,
      },
      {
        id: "email",
        label: "E-mail",
        defaultWidth: 240,
        minWidth: 160,
        render: (u) => <span className="text-sm text-[#5a7a62]">{u.email}</span>,
      },
      {
        id: "papel",
        label: "Papel",
        defaultWidth: 140,
        minWidth: 110,
        truncate: false,
        render: (u) => (
          <select
            value={String(u.role).toLowerCase()}
            onChange={(e) => void atualizarRole(u.id, e.target.value)}
            className="max-w-full rounded-lg px-2 py-1 text-xs font-medium"
            style={{ background: "#f0f9ee", border: "1px solid #d4ecd0", color: "#1e4a24" }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ),
      },
      {
        id: "status",
        label: "Status",
        defaultWidth: 120,
        minWidth: 90,
        truncate: false,
        render: (u) => (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{
              background: u.status === "ativo" ? "rgba(146,255,0,0.12)" : "rgba(0,0,0,0.05)",
              color: u.status === "ativo" ? "#1e4a24" : "#6b8a76",
              border: u.status === "ativo" ? "1px solid rgba(146,255,0,0.3)" : "1px solid #ddd",
            }}
          >
            {u.status}
          </span>
        ),
      },
    ];
  }, []);

  if (!myRole && loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#92ff00] border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{ background: "#fff", border: "1px solid #dcebd8", boxShadow: "0 4px 16px rgba(11,31,16,0.06)" }}
        >
          <UserCog className="mx-auto mb-4 h-10 w-10" style={{ color: "#3f9848" }} />
          <h1 className="text-base font-bold" style={{ color: "#0b2210" }}>Acesso restrito</h1>
          <p className="mt-2 text-sm" style={{ color: "#6b8a76" }}>
            Apenas administradores (owner/admin) podem gerir a equipa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col" style={{ background: "#f8fcf6" }}>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">

        {/* Toolbar */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#96a89e" }}>
            {usuarios.length} {usuarios.length === 1 ? "membro" : "membros"}
          </p>
          <button
            type="button"
            onClick={() => setModal(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors"
            style={{ background: "#0b1f10", color: "#92ff00" }}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Convidar membro
          </button>
        </div>

        {erro && (
          <p className="mb-4 rounded-xl px-3 py-2 text-sm" style={{ background: "#fff2f1", color: "#c0392b", border: "1px solid #f0c0bd" }}>
            {erro}
          </p>
        )}

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#92ff00] border-t-transparent" />
          </div>
        ) : usuarios.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: "#fff", border: "1px solid #dcebd8" }}
          >
            <p className="text-sm" style={{ color: "#6b8a76" }}>Nenhum membro cadastrado. Convide o primeiro.</p>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-2xl"
            style={{ background: "#fff", border: "1px solid #dcebd8", boxShadow: "0 2px 8px rgba(11,31,16,0.04)" }}
          >
            <CrmResizableDataTable
              tableId="crm-usuarios"
              columns={colunasUsuarios}
              rows={usuarios}
              rowKey={(u) => u.id}
              maxHeight="none"
              className="border-t-0"
              getRowStyle={(_, i) => ({ borderTop: i > 0 ? "1px solid #eef5ec" : "none" })}
            />
          </div>
        )}
      </div>

      {/* Invite modal */}
      {modal && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center md:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            style={{ background: "rgba(11,31,16,0.3)" }}
            aria-label="Fechar"
            onClick={() => setModal(false)}
          />
          <div
            className="relative w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl"
            style={{ background: "#fff", border: "1px solid #dcebd8", boxShadow: "0 20px 60px rgba(11,31,16,0.18)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold" style={{ color: "#0b2210" }}>Convidar membro</h2>
              <button
                type="button"
                onClick={() => setModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[#f0f9ee]"
                style={{ color: "#6b8a76", border: "none", background: "transparent", cursor: "pointer" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="E-mail *"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full min-h-11 rounded-xl border px-3 text-sm outline-none transition focus:ring-2 focus:ring-[#92ff00]/30"
                style={{ border: "1px solid #d4ecd0", color: "#0b2210" }}
              />
              <input
                placeholder="Nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full min-h-11 rounded-xl border px-3 text-sm outline-none transition focus:ring-2 focus:ring-[#92ff00]/30"
                style={{ border: "1px solid #d4ecd0", color: "#0b2210" }}
              />
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full min-h-11 rounded-xl border px-3 text-sm"
                style={{ border: "1px solid #d4ecd0", color: "#0b2210" }}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <button
              type="button"
              disabled={salvando || !form.email.trim()}
              onClick={() => void convidar()}
              className="mt-4 w-full min-h-11 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: "#0b1f10", color: "#92ff00" }}
            >
              {salvando ? "Enviando…" : "Enviar convite"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
