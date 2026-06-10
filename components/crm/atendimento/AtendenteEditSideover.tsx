"use client";

import { useEffect, useState } from "react";
import { Pencil, UserPlus } from "lucide-react";
import {
  CrmRetrofitSideoverShell,
  crmRetrofitSideoverFooterBtnCancel,
  crmRetrofitSideoverFooterBtnPrimary,
} from "@/components/crm/CrmRetrofitSideoverShell";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import {
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_TEXT_MUTED,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { AtendenteCrm } from "@/lib/crm/atendentes-crm";

type HubAgenteOption = {
  agente_slug: string;
  nome: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** Modo edição — omitir para cadastro novo. */
  atendente?: AtendenteCrm | null;
};

const INPUT: React.CSSProperties = { ...RF_INPUT_STYLE, padding: "10px 12px", borderRadius: 10, fontSize: 13 };
const LABEL: React.CSSProperties = { ...RF_LABEL_STYLE, fontWeight: 600, marginBottom: 4 };

function formatData(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AtendenteEditSideover({ open, onClose, onSaved, atendente }: Props) {
  const editando = Boolean(atendente?.id);
  const [agentes, setAgentes] = useState<HubAgenteOption[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [slug, setSlug] = useState("");
  const [agenteSlug, setAgenteSlug] = useState("");
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!open) return;
    setErro("");
    if (atendente) {
      setNome(atendente.nome);
      setTelefone(atendente.telefone);
      setEmail(atendente.email ?? "");
      setCargo(atendente.cargo ?? "");
      setSlug(atendente.slug ?? "");
      setAgenteSlug(atendente.agente_slug ?? "");
      setAtivo(atendente.ativo);
    } else {
      setNome("");
      setTelefone("");
      setEmail("");
      setCargo("");
      setSlug("");
      setAgenteSlug("");
      setAtivo(true);
    }
    void fetch("/api/hub/agentes?ativo=true", { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((json) => {
        const list = (Array.isArray(json) ? json : json?.agentes ?? []) as HubAgenteOption[];
        setAgentes(list.map((a) => ({ agente_slug: a.agente_slug, nome: a.nome })));
      })
      .catch(() => setAgentes([]));
  }, [open, atendente]);

  async function salvar() {
    setErro("");
    if (!nome.trim() || !telefone.trim()) {
      setErro("Nome e telefone são obrigatórios.");
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim() || null,
        cargo: cargo.trim() || null,
        slug: slug.trim() || null,
        agente_slug: agenteSlug.trim() || null,
        ativo,
      };
      const res = await fetch(
        editando
          ? `/api/crm/atendentes/${encodeURIComponent(atendente!.id)}`
          : "/api/crm/atendentes",
        {
          method: editando ? "PATCH" : "POST",
          credentials: "include",
          headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(typeof json.error === "string" ? json.error : "Não foi possível salvar.");
        return;
      }
      onSaved?.();
      onClose();
    } catch {
      setErro("Erro de rede ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!atendente?.id) return;
    if (!window.confirm(`Desativar ${atendente.nome}? Pode reativar depois na edição.`)) return;
    setErro("");
    setExcluindo(true);
    try {
      const res = await fetch(`/api/crm/atendentes/${encodeURIComponent(atendente.id)}`, {
        method: "DELETE",
        credentials: "include",
        headers: internalApiHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(typeof json.error === "string" ? json.error : "Não foi possível desativar.");
        return;
      }
      onSaved?.();
      onClose();
    } catch {
      setErro("Erro de rede ao desativar.");
    } finally {
      setExcluindo(false);
    }
  }

  const busy = salvando || excluindo;

  return (
    <CrmRetrofitSideoverShell
      open={open}
      onClose={onClose}
      kindLabel="OPERAÇÃO"
      title={editando ? atendente!.nome : "Novo atendente"}
      subtitle={
        editando
          ? [atendente!.telefone, atendente!.slug ? `@${atendente!.slug}` : null]
              .filter(Boolean)
              .join(" · ")
          : "Cadastro para transferência em grupo WhatsApp"
      }
      icon={editando ? Pencil : UserPlus}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {editando ? (
            <button
              type="button"
              onClick={() => void excluir()}
              disabled={busy || !atendente!.ativo}
              className="rounded-xl border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-400 disabled:opacity-40"
            >
              {excluindo ? "Desativando…" : "Desativar"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {crmRetrofitSideoverFooterBtnCancel(onClose, busy)}
            {crmRetrofitSideoverFooterBtnPrimary(
              salvando ? "Salvando…" : editando ? "Salvar alterações" : "Salvar atendente",
              () => void salvar(),
              busy
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 p-1">
        {!editando ? (
          <p className="text-xs leading-relaxed" style={{ color: RF_TEXT_MUTED }}>
            Vendedores e atendentes humanos usados na transferência de conversas. Tudo fica registrado no CRM.
          </p>
        ) : null}
        {erro ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block" style={LABEL}>
              Nome *
            </label>
            <input className="w-full" style={INPUT} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className="block" style={LABEL}>
              WhatsApp *
            </label>
            <input className="w-full" style={INPUT} value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>
          <div>
            <label className="block" style={LABEL}>
              Slug
            </label>
            <input
              className="w-full"
              style={INPUT}
              placeholder="identificador-url"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div>
            <label className="block" style={LABEL}>
              E-mail
            </label>
            <input className="w-full" style={INPUT} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block" style={LABEL}>
              Cargo
            </label>
            <input className="w-full" style={INPUT} value={cargo} onChange={(e) => setCargo(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block" style={LABEL}>
              Agente IA associado
            </label>
            <select className="w-full" style={INPUT} value={agenteSlug} onChange={(e) => setAgenteSlug(e.target.value)}>
              <option value="">Nenhum (opcional)</option>
              {agentes.map((a) => (
                <option key={a.agente_slug} value={a.agente_slug}>
                  {a.nome} ({a.agente_slug})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <CrmToggleSwitch checked={ativo} onChange={setAtivo} aria-label="Atendente ativo" />
            <span className="text-sm" style={{ color: RF_TEXT_MUTED }}>
              {ativo ? "Ativo na equipe" : "Inativo (não aparece nas transferências)"}
            </span>
          </div>
        </div>

        {editando && atendente ? (
          <div
            className="mt-2 rounded-xl border border-white/[0.08] p-3 text-[11px]"
            style={{ color: RF_TEXT_MUTED }}
          >
            <p>
              <span className="font-semibold text-[#7a9a7e]">ID:</span> {atendente.id}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-[#7a9a7e]">Criado:</span> {formatData(atendente.criado_em)}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-[#7a9a7e]">Atualizado:</span>{" "}
              {formatData(atendente.atualizado_em)}
            </p>
            {Object.keys(atendente.metadata ?? {}).length > 0 ? (
              <p className="mt-1 break-all">
                <span className="font-semibold text-[#7a9a7e]">Metadata:</span>{" "}
                {JSON.stringify(atendente.metadata)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </CrmRetrofitSideoverShell>
  );
}

export type { AtendenteCrm };
