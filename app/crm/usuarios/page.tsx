"use client";

import { useCallback, useEffect, useState } from "react";
import { UserCog, UserPlus, X } from "lucide-react";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
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

  if (!myRole && loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#0d1117] text-sm text-[#8b949e]">
        Carregando…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-8 text-center">
          <UserCog className="mx-auto mb-4 h-8 w-8 text-[#c9a24a]" />
          <h1 className="text-lg font-bold text-[#e6edf3]">Usuários & Permissões</h1>
          <p className="mt-2 text-sm text-[#8b949e]">
            Apenas administradores (owner/admin) podem gerir a equipa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#0d1117]">
      <CrmStickyPageHeader
        title="Usuários & Permissões"
        description="Convites e papéis da equipa Obra10+"
        actions={
          <button
            type="button"
            onClick={() => setModal(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#c9a24a] px-3 text-xs font-bold text-[#003b26]"
          >
            <UserPlus className="h-4 w-4" />
            Convidar
          </button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {erro && (
          <p className="mb-4 rounded-lg border border-[#f8514966] bg-[#1a0a0a] px-3 py-2 text-sm text-[#ff7b72]">
            {erro}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[#8b949e]">Carregando equipa…</p>
        ) : usuarios.length === 0 ? (
          <p className="text-sm text-[#8b949e]">Nenhum utilizador em `public.users`. Convide o primeiro membro.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#30363d]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#161b22] text-[10px] font-bold uppercase tracking-wide text-[#8b949e]">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Papel</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]">
                {usuarios.map((u) => (
                  <tr key={u.id} className="bg-[#0d1117] text-[#e6edf3]">
                    <td className="px-3 py-2.5 font-medium">{u.name || "—"}</td>
                    <td className="px-3 py-2.5 text-[#8b949e]">{u.email}</td>
                    <td className="px-3 py-2.5">
                      <select
                        value={String(u.role).toLowerCase()}
                        onChange={(e) => void atualizarRole(u.id, e.target.value)}
                        className="rounded-lg border border-[#30363d] bg-[#21262d] px-2 py-1 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[#8b949e]">{u.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center md:p-4">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Fechar" onClick={() => setModal(false)} />
          <div className="relative w-full max-w-md rounded-t-2xl border border-[#30363d] bg-[#161b22] p-4 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#e6edf3]">Convidar utilizador</h2>
              <button type="button" onClick={() => setModal(false)} className="rounded-lg bg-[#21262d] p-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="E-mail *"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full min-h-11 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3]"
              />
              <input
                placeholder="Nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full min-h-11 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3]"
              />
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full min-h-11 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3]"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={salvando || !form.email.trim()}
              onClick={() => void convidar()}
              className="mt-4 w-full min-h-11 rounded-lg bg-[#c9a24a] text-sm font-bold text-[#003b26] disabled:opacity-50"
            >
              {salvando ? "Enviando convite…" : "Enviar convite por e-mail"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
