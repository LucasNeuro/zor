"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { TipoConta } from "@/lib/crm/finance-contas";

type Props = {
  open: boolean;
  onClose: () => void;
  onCriado: () => void;
  tipoInicial?: TipoConta;
};

export function FinanceiroNovoLancamentoModal({
  open,
  onClose,
  onCriado,
  tipoInicial = "pagar",
}: Props) {
  const [tipo, setTipo] = useState<TipoConta>(tipoInicial);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (open) setTipo(tipoInicial);
  }, [open, tipoInicial]);

  if (!open) return null;

  async function salvar() {
    setErro("");
    setSalvando(true);
    try {
      const res = await fetch("/api/crm/financeiro/contas", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          tipo,
          descricao: descricao.trim(),
          valor,
          vencimento: vencimento || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error || "Não foi possível salvar o lançamento.");
        return;
      }
      setDescricao("");
      setValor("");
      setVencimento("");
      onCriado();
      onClose();
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[#dcebd8] bg-[#ffffff] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="novo-lancamento-titulo"
      >
        <div className="flex items-center justify-between border-b border-[#dcebd8] px-4 py-3">
          <h2 id="novo-lancamento-titulo" className="text-sm font-bold text-[#0b2210]">
            Novo lançamento
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef7eb] text-[#0b2210]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <div className="inline-flex w-full rounded-lg bg-[#eef7eb] p-0.5">
            {(["pagar", "receber"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`min-h-11 flex-1 rounded-md text-xs font-bold capitalize ${
                  tipo === t ? "bg-[#dcebd8] text-[#c9a24a]" : "text-[#5d7a67]"
                }`}
              >
                {t === "pagar" ? "A pagar" : "A receber"}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5d7a67]">
              Descrição *
            </label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Fornecedor XYZ, parcela 2/3"
              className="w-full min-h-11 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 py-2 text-sm text-[#0b2210] outline-none focus:border-[#c9a24a]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5d7a67]">
                Valor (R$) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0"
                className="w-full min-h-11 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 py-2 text-sm text-[#0b2210] outline-none focus:border-[#c9a24a]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#5d7a67]">
                Vencimento
              </label>
              <input
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                className="w-full min-h-11 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 py-2 text-sm text-[#0b2210] outline-none focus:border-[#c9a24a]"
              />
            </div>
          </div>

          {erro && <p className="text-xs text-[#f85149]">{erro}</p>}
        </div>

        <div
          className="flex gap-2 border-t border-[#dcebd8] p-4"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-lg border border-[#dcebd8] bg-[#eef7eb] text-sm font-semibold text-[#5d7a67]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando || !descricao.trim() || !valor}
            onClick={() => void salvar()}
            className="min-h-11 flex-1 rounded-lg bg-[#c9a24a] text-sm font-bold text-[#003b26] disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Criar lançamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
