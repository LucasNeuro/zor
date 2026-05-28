"use client";

import { useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Props = {
  open: boolean;
  leadId: string;
  leadNome: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function LeadEncaminharModal({ open, leadId, leadNome, onClose, onSuccess }: Props) {
  const [destinatario, setDestinatario] = useState("");
  const [segmento, setSegmento] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [sugeridoIa, setSugeridoIa] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  if (!open) return null;

  async function enviar() {
    setErro("");
    if (!destinatario.trim()) {
      setErro("Informe para quem foi encaminhado.");
      return;
    }
    setSalvando(true);
    const res = await fetch("/api/crm/encaminhamentos", {
      method: "POST",
      credentials: "include",
      headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: leadId,
        segmento: segmento.trim() || null,
        responsavel_envio: responsavel.trim() || "gestor",
        destinatario_pessoa_id: null,
        sugerido_ia: sugeridoIa,
        validado_humano: !sugeridoIa,
        status: sugeridoIa ? "aguardando_validacao" : "enviado",
        criterio_selecao: destinatario.trim(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro(typeof json?.error === "string" ? json.error : "Não foi possível encaminhar.");
      return;
    }
    onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#30363d] bg-[#161b22] p-5 shadow-xl">
        <h3 className="text-base font-bold text-[#e6edf3]">Encaminhar lead</h3>
        <p className="mt-1 text-sm text-[#8b949e]">{leadNome}</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8b949e]">Para quem *</label>
            <input
              className="w-full rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#e6edf3]"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="Corretor, arquiteto, fornecedor…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8b949e]">Segmento</label>
            <input
              className="w-full rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#e6edf3]"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8b949e]">Autorizado por</label>
            <input
              className="w-full rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#e6edf3]"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Seu nome ou e-mail"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#8b949e]">
            <input type="checkbox" checked={sugeridoIa} onChange={(e) => setSugeridoIa(e.target.checked)} />
            Sugestão da IA (exige validação humana)
          </label>
        </div>

        {erro ? <p className="mt-3 text-sm text-red-400">{erro}</p> : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#30363d] py-2 text-sm text-[#8b949e]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => void enviar()}
            className="flex-1 rounded-lg bg-[#c9a24a] py-2 text-sm font-bold text-[#003b26] disabled:opacity-50"
          >
            {salvando ? "Enviando…" : "Encaminhar"}
          </button>
        </div>
      </div>
    </div>
  );
}
