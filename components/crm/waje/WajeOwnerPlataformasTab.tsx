"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search } from "lucide-react";
import {
  CrmResizableDataTable,
  type CrmResizableColumn,
} from "@/components/crm/CrmResizableDataTable";
import { CrmIconButtonGroup } from "@/components/crm/CrmIconButtonGroup";
import { OpsStatusBadge } from "@/components/ops/OpsStatusBadge";
import {
  WajeOwnerPlataformaSideover,
  type PlatformBrandRow,
} from "@/components/crm/waje/WajeOwnerPlataformaSideover";
import { opsApiHeaders } from "@/lib/ops-api-headers-client";

const TABLE_SCROLL_MAX = "min(52vh, 460px)";

export function WajeOwnerPlataformasTab() {
  const [rows, setRows] = useState<PlatformBrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [search, setSearch] = useState("");
  const [sideoverRow, setSideoverRow] = useState<PlatformBrandRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/ops/platform-brands", {
        headers: await opsApiHeaders(),
        credentials: "include",
      });
      const raw = await res.text();
      let json: { data?: PlatformBrandRow[]; error?: string } = {};
      try {
        json = raw ? (JSON.parse(raw) as typeof json) : {};
      } catch {
        throw new Error(
          res.ok
            ? "Resposta inválida do servidor."
            : `Falha ao carregar (${res.status}). Confirme que executou ensure_hub_platform_brands.sql no Supabase.`
        );
      }
      if (!res.ok) throw new Error(json.error ?? `Falha ao carregar (${res.status}).`);
      setRows(json.data ?? []);
    } catch (e) {
      setRows([]);
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = [r.nome, r.slug, r.dominios.join(" "), r.company_name ?? ""].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search]);

  const columns = useMemo<CrmResizableColumn<PlatformBrandRow>[]>(
    () => [
      { id: "nome", label: "Marca", defaultWidth: 160, render: (r) => r.nome },
      { id: "slug", label: "Slug", defaultWidth: 100, render: (r) => r.slug },
      {
        id: "dominios",
        label: "Domínios",
        defaultWidth: 220,
        render: (r) => (r.dominios.length ? r.dominios.join(", ") : "—"),
      },
      {
        id: "tipo",
        label: "Cadastro",
        defaultWidth: 88,
        render: (r) => r.registration_type ?? "—",
      },
      {
        id: "status",
        label: "Status",
        defaultWidth: 88,
        render: (r) => <OpsStatusBadge variant={r.ativo ? "ativo" : "inativo"} />,
      },
      {
        id: "principal",
        label: "Principal",
        defaultWidth: 90,
        render: (r) => (r.is_principal ? "Sim" : "—"),
      },
      {
        id: "acoes",
        label: "Ações",
        defaultWidth: 44,
        minWidth: 44,
        maxWidth: 52,
        align: "center" as const,
        truncate: false as const,
        headerClassName: "px-2",
        cellClassName: "px-2",
        render: (r) => (
          <div
            className="flex justify-center"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <CrmIconButtonGroup
              aria-label="Configurar white-label"
              items={[
                {
                  key: "gerir",
                  variant: "outline",
                  icon: <Pencil size={14} />,
                  title: "Configurar",
                  "aria-label": "Configurar white-label",
                  onClick: () => {
                    setCreateOpen(false);
                    setSideoverRow(r);
                  },
                },
              ]}
            />
          </div>
        ),
      },
    ],
    []
  );

  return (
    <>
      <div className="flex min-h-0 flex-col">
        <div className="shrink-0 border-b border-[#eef5ec] px-4 py-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-[#d4ecd0] bg-white px-3">
              <Search size={14} className="text-[#6b8a76]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar marca, slug ou domínio..."
                className="w-full bg-transparent text-sm text-[#1e3a23] outline-none placeholder:text-[#90a89b]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSideoverRow(null);
                setCreateOpen(true);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#0b1f10] bg-[#0b1f10] px-3 text-xs font-semibold text-[#92ff00]"
            >
              <Plus size={13} />
              Nova marca
            </button>
            <button
              type="button"
              onClick={() => void carregar()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#d4ecd0] bg-white px-3 text-xs font-semibold text-[#1e4a24] disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>

        {erro ? (
          <div className="mx-4 mb-2 rounded-xl border border-[#f8514966] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]">
            {erro}
            <button
              type="button"
              onClick={() => void carregar()}
              className="ml-2 text-xs font-bold underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 p-2">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-sm text-[#6b8a76]">
              Carregando marcas…
            </div>
          ) : (
            <CrmResizableDataTable
              tableId="waje-owner-plataformas"
              variant="waje"
              columns={columns}
              rows={filtrados}
              rowKey={(r) => r.id}
              maxHeight={TABLE_SCROLL_MAX}
              className="border-t-0 text-xs"
              rowCellClassName="px-3 py-2 align-top text-[#0b2210]"
              emptyMessage="Nenhuma plataforma. Execute ensure_hub_platform_brands.sql no Supabase."
              onRowClick={(r) => {
                setCreateOpen(false);
                setSideoverRow(r);
              }}
            />
          )}
        </div>
      </div>

      <WajeOwnerPlataformaSideover
        open={createOpen}
        row={null}
        createMode
        onClose={() => setCreateOpen(false)}
        onCreated={(r) => {
          setRows((prev) => [...prev, r]);
          setCreateOpen(false);
        }}
        onSaved={() => {}}
      />

      <WajeOwnerPlataformaSideover
        open={Boolean(sideoverRow)}
        row={sideoverRow}
        onClose={() => setSideoverRow(null)}
        onSaved={(r) => {
          setRows((prev) => prev.map((x) => (x.id === r.id ? r : x)));
          setSideoverRow(r);
        }}
        onCreated={() => {}}
        onDeactivated={(id) => {
          setRows((prev) => prev.map((x) => (x.id === id ? { ...x, ativo: false } : x)));
          setSideoverRow(null);
        }}
      />
    </>
  );
}
