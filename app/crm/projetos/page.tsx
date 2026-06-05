"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { EmptyState } from "@/components/crm/EmptyState";

type Projeto = {
  id: string;
  codigo: string | null;
  titulo: string;
  status: string;
  negocio_id: string | null;
  obra_id: string | null;
};

function ProjetosPageInner() {
  const searchParams = useSearchParams();
  const negocioIdFilter = searchParams.get("negocio_id") || "";
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [modal, setModal] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [negocioId, setNegocioId] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    const q = negocioIdFilter ? `?negocio_id=${encodeURIComponent(negocioIdFilter)}` : "";
    fetch(`/api/crm/projetos${q}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d: { data?: Projeto[] }) => setProjetos(d.data ?? []));
  }, [negocioIdFilter]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criar() {
    if (!titulo.trim()) return;
    setSalvando(true);
    await fetch("/api/crm/projetos", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ titulo, negocio_id: negocioId || null }),
    });
    setSalvando(false);
    setModal(false);
    setTitulo("");
    setNegocioId("");
    carregar();
  }

  return (
    <div className="min-h-full bg-[#f8fcf6] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-[#0b2210]">Projetos</h1>
          <p className="text-xs text-[#5d7a67]">Negócio → projeto → obra → pedidos</p>
        </div>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#c9a24a] px-3 text-xs font-bold text-[#003b26]"
        >
          <Plus className="h-4 w-4" />
          Novo
        </button>
      </div>

      {projetos.length === 0 ? (
        <EmptyState message="Nenhum projeto cadastrado." />
      ) : (
        <ul className="space-y-2">
          {projetos.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-[#dcebd8] bg-[#ffffff] p-4"
            >
              <p className="font-bold text-[#0b2210]">{p.titulo}</p>
              <p className="text-xs text-[#5d7a67]">
                {p.codigo} · {p.status}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {p.negocio_id && (
                  <Link href={`/crm/negocios/${p.negocio_id}`} className="font-bold text-[#60a5fa]">
                    Negócio
                  </Link>
                )}
                {p.obra_id && (
                  <Link href={`/crm/obras/${p.obra_id}`} className="font-bold text-[#c9a24a]">
                    Obra
                  </Link>
                )}
                <Link href={`/crm/pedidos?obra_id=${p.obra_id || ""}`} className="text-[#5d7a67] hover:text-[#0b2210]">
                  Pedidos
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#dcebd8] bg-[#ffffff] p-4">
            <h2 className="text-sm font-bold text-[#0b2210]">Novo projeto</h2>
            <input
              placeholder="Título *"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-3 w-full min-h-11 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 text-sm text-[#0b2210]"
            />
            <input
              placeholder="ID do negócio (opcional)"
              value={negocioId}
              onChange={(e) => setNegocioId(e.target.value)}
              className="mt-2 w-full min-h-11 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 text-sm text-[#0b2210]"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setModal(false)} className="flex-1 min-h-10 rounded-lg bg-[#eef7eb] text-xs text-[#5d7a67]">
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

export default function ProjetosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#5d7a67]">Carregando projetos…</div>}>
      <ProjetosPageInner />
    </Suspense>
  );
}
