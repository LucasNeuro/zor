"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { EmptyState } from "@/components/crm/EmptyState";

type Pedido = {
  id: string;
  codigo: string | null;
  descricao: string;
  status: string;
  obra_id: string | null;
  valor_estimado: number | null;
};

const STATUS_OPTS = ["rascunho", "cotando", "aprovado", "entregue", "cancelado"];

function PedidosPageInner() {
  const searchParams = useSearchParams();
  const obraIdParam = searchParams.get("obra_id") || "";
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [modal, setModal] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [obraId, setObraId] = useState(obraIdParam);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    const q = obraIdParam ? `?obra_id=${encodeURIComponent(obraIdParam)}` : "";
    fetch(`/api/crm/pedidos${q}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d: { data?: Pedido[] }) => setPedidos(d.data ?? []));
  }, [obraIdParam]);

  useEffect(() => {
    setObraId(obraIdParam);
    carregar();
  }, [carregar, obraIdParam]);

  async function criar() {
    if (!descricao.trim()) return;
    setSalvando(true);
    await fetch("/api/crm/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ descricao, obra_id: obraId || null }),
    });
    setSalvando(false);
    setModal(false);
    setDescricao("");
    carregar();
  }

  async function mudarStatus(id: string, status: string) {
    await fetch(`/api/crm/pedidos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ status }),
    });
    carregar();
  }

  return (
    <div className="min-h-full bg-[#0d1117] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#e6edf3]">Pedidos de material</h1>
          <p className="text-xs text-[#8b949e]">Criar e acompanhar pedidos por obra</p>
        </div>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#c9a24a] px-3 text-xs font-bold text-[#003b26]"
        >
          <Plus className="h-4 w-4" />
          Novo pedido
        </button>
      </div>

      {pedidos.length === 0 ? (
        <EmptyState message="Nenhum pedido. Crie o primeiro pedido acima." />
      ) : (
        <ul className="space-y-2">
          {pedidos.map((p) => (
            <li key={p.id} className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
              <p className="font-bold text-[#e6edf3]">{p.descricao}</p>
              <p className="text-xs text-[#8b949e]">{p.codigo}</p>
              {p.obra_id && (
                <Link href={`/crm/obras/${p.obra_id}`} className="mt-1 inline-block text-xs font-bold text-[#c9a24a]">
                  Ver obra
                </Link>
              )}
              <select
                value={p.status}
                onChange={(e) => void mudarStatus(p.id, e.target.value)}
                className="mt-2 block min-h-9 rounded-lg border border-[#30363d] bg-[#21262d] px-2 text-xs text-[#e6edf3]"
              >
                {STATUS_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#30363d] bg-[#161b22] p-4">
            <h2 className="text-sm font-bold">Novo pedido</h2>
            <textarea
              placeholder="Descrição *"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="mt-3 w-full min-h-20 rounded-lg border border-[#30363d] bg-[#21262d] p-3 text-sm text-[#e6edf3]"
            />
            <input
              placeholder="ID da obra (opcional)"
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              className="mt-2 w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3]"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setModal(false)} className="flex-1 min-h-10 rounded-lg bg-[#21262d] text-xs">
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => void criar()}
                className="flex-1 min-h-10 rounded-lg bg-[#c9a24a] text-xs font-bold text-[#003b26]"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PedidosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#8b949e]">Carregando pedidos…</div>}>
      <PedidosPageInner />
    </Suspense>
  );
}
