"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Phone, Plus, Trash2, UserPlus } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { AtendenteCrm } from "@/lib/crm/atendentes-crm";

type HubAgenteOption = {
  agente_slug: string;
  nome: string;
};

type Props = {
  /** Estilo escuro da página /crm/atendimento */
  variant?: "atendimento" | "sideover";
  compact?: boolean;
};

const INPUT_ATEND =
  "w-full rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2 text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-[#c9a24a]/40 placeholder-zinc-600";

export function AtendentesEquipePanel({ variant = "atendimento", compact = false }: Props) {
  const [atendentes, setAtendentes] = useState<AtendenteCrm[]>([]);
  const [agentes, setAgentes] = useState<HubAgenteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [agenteSlug, setAgenteSlug] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const [resAt, resAg] = await Promise.all([
        fetch("/api/crm/atendentes?ativos=false", { headers: internalApiHeaders() }),
        fetch("/api/hub/agentes?ativo=true", { headers: internalApiHeaders() }),
      ]);
      const jsonAt = await resAt.json().catch(() => ({}));
      const jsonAg = await resAg.json().catch(() => ({}));
      if (!resAt.ok) {
        setErro(typeof jsonAt.error === "string" ? jsonAt.error : "Erro ao carregar equipe.");
        setAtendentes([]);
      } else {
        setAtendentes((jsonAt.atendentes ?? []) as AtendenteCrm[]);
        setAviso(typeof jsonAt.aviso === "string" ? jsonAt.aviso : null);
      }
      if (resAg.ok) {
        const list = (Array.isArray(jsonAg) ? jsonAg : jsonAg?.agentes ?? []) as HubAgenteOption[];
        setAgentes(list.map((a) => ({ agente_slug: a.agente_slug, nome: a.nome })));
      }
    } catch {
      setErro("Erro de rede ao carregar equipe.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criarAtendente() {
    setErro("");
    if (!nome.trim() || !telefone.trim()) {
      setErro("Nome e telefone são obrigatórios.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/crm/atendentes", {
        method: "POST",
        credentials: "include",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone: telefone.trim(),
          email: email.trim() || undefined,
          cargo: cargo.trim() || undefined,
          agente_slug: agenteSlug.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(typeof json.error === "string" ? json.error : "Não foi possível cadastrar.");
        return;
      }
      setNome("");
      setTelefone("");
      setEmail("");
      setCargo("");
      setAgenteSlug("");
      setFormOpen(false);
      await carregar();
    } catch {
      setErro("Erro de rede ao cadastrar.");
    } finally {
      setSalvando(false);
    }
  }

  async function desativar(id: string) {
    setErro("");
    try {
      const res = await fetch(`/api/crm/atendentes/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: internalApiHeaders(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErro(typeof json.error === "string" ? json.error : "Não foi possível desativar.");
        return;
      }
      await carregar();
    } catch {
      setErro("Erro de rede.");
    }
  }

  const isSideover = variant === "sideover";
  const labelCls = isSideover
    ? "text-[10px] font-bold uppercase tracking-wide text-[#7a9a7e]"
    : "text-[10px] font-bold uppercase tracking-wide text-zinc-500";
  const titleCls = isSideover ? "text-sm font-extrabold text-[#e8f5e9]" : "text-sm font-bold text-zinc-100";

  return (
    <div className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className={titleCls}>Equipe de atendimento</h2>
          <p className={`mt-0.5 text-[11px] leading-relaxed ${isSideover ? "text-[#7a9a7e]" : "text-zinc-500"}`}>
            Vendedores e atendentes para transferência em grupo WhatsApp. Tudo fica registrado no CRM.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-[#c9a24a]/35 bg-[#c9a24a]/15 px-2.5 py-1.5 text-[11px] font-bold text-[#c9a24a]"
        >
          <Plus size={14} />
          Novo
        </button>
      </div>

      {aviso ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/90">
          {aviso}
        </p>
      ) : null}
      {erro ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300" role="alert">
          {erro}
        </p>
      ) : null}

      {formOpen ? (
        <div
          className={`space-y-2 rounded-xl border p-3 ${
            isSideover ? "border-[rgba(63,152,72,0.35)] bg-[rgba(6,13,8,0.72)]" : "border-white/[0.08] bg-black/20"
          }`}
        >
          <p className={labelCls}>Cadastrar atendente</p>
          <input className={INPUT_ATEND} placeholder="Nome *" value={nome} onChange={(e) => setNome(e.target.value)} />
          <input
            className={INPUT_ATEND}
            placeholder="WhatsApp (5511…) *"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
          />
          <input
            className={INPUT_ATEND}
            placeholder="E-mail (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={INPUT_ATEND}
            placeholder="Cargo (vendedor, atendente…)"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
          />
          <select
            className={INPUT_ATEND}
            value={agenteSlug}
            onChange={(e) => setAgenteSlug(e.target.value)}
          >
            <option value="">Agente IA associado (opcional)</option>
            {agentes.map((a) => (
              <option key={a.agente_slug} value={a.agente_slug}>
                {a.nome} ({a.agente_slug})
              </option>
            ))}
          </select>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="flex-1 rounded-lg border border-white/10 py-2 text-[11px] font-semibold text-zinc-400"
              disabled={salvando}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void criarAtendente()}
              className="flex-1 rounded-lg bg-[#003b26] py-2 text-[11px] font-bold text-white ring-1 ring-[#c9a24a]/30"
              disabled={salvando}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="py-4 text-center text-xs text-zinc-500">A carregar equipe…</p>
        ) : atendentes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
            <UserPlus size={22} className="mx-auto mb-2 text-zinc-600" />
            <p className="text-xs text-zinc-500">Nenhum atendente cadastrado.</p>
            <p className="mt-1 text-[10px] text-zinc-600">Use Novo para adicionar vendedores ao transferir conversas.</p>
          </div>
        ) : (
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className={`border-b ${isSideover ? "border-[rgba(63,152,72,0.25)]" : "border-white/[0.06]"}`}>
                <th className={`pb-2 pr-2 font-bold ${labelCls}`}>Nome</th>
                <th className={`pb-2 pr-2 font-bold ${labelCls}`}>WhatsApp</th>
                {!compact ? <th className={`pb-2 pr-2 font-bold ${labelCls}`}>Cargo</th> : null}
                {!compact ? <th className={`pb-2 pr-2 font-bold ${labelCls}`}>Agente</th> : null}
                <th className={`pb-2 font-bold ${labelCls}`} />
              </tr>
            </thead>
            <tbody>
              {atendentes.map((a) => (
                <tr
                  key={a.id}
                  className={`border-b ${isSideover ? "border-[rgba(63,152,72,0.12)]" : "border-white/[0.04]"} ${
                    !a.ativo ? "opacity-45" : ""
                  }`}
                >
                  <td className={`py-2.5 pr-2 font-semibold ${isSideover ? "text-[#e8f5e9]" : "text-zinc-200"}`}>
                    {a.nome}
                    {!a.ativo ? (
                      <span className="ml-1 text-[9px] font-normal text-zinc-500">(inativo)</span>
                    ) : null}
                  </td>
                  <td className={`py-2.5 pr-2 tabular-nums ${isSideover ? "text-[#b8d4bc]" : "text-zinc-400"}`}>
                    <span className="inline-flex items-center gap-1">
                      <Phone size={10} className="opacity-60" />
                      {a.telefone}
                    </span>
                  </td>
                  {!compact ? (
                    <td className={`py-2.5 pr-2 ${isSideover ? "text-[#7a9a7e]" : "text-zinc-500"}`}>
                      {a.cargo || "—"}
                    </td>
                  ) : null}
                  {!compact ? (
                    <td className={`py-2.5 pr-2 ${isSideover ? "text-[#7a9a7e]" : "text-zinc-500"}`}>
                      {a.agente_slug ? (
                        <span className="inline-flex items-center gap-1">
                          <Bot size={10} />
                          {a.agente_slug}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                  <td className="py-2.5 text-right">
                    {a.ativo ? (
                      <button
                        type="button"
                        title="Desativar"
                        onClick={() => void desativar(a.id)}
                        className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
