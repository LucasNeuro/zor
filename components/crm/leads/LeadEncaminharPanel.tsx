"use client";

import { useState } from "react";
import {
  CRM_SIDEOVER_INPUT,
  CRM_SIDEOVER_INPUT_STYLE,
  CRM_SIDEOVER_LABEL,
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
  CrmSideoverInlinePanel,
} from "@/components/crm/CrmSideoverActionGroup";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Props = {
  leadId: string;
  leadNome: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export function LeadEncaminharPanel({ leadId, leadNome, onSuccess, onCancel }: Props) {
  const [destinatario, setDestinatario] = useState("");
  const [segmento, setSegmento] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [sugeridoIa, setSugeridoIa] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

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
  }

  return (
    <CrmSideoverInlinePanel title="Encaminhar lead">
      <p className="mb-3 text-xs" style={{ color: "#7a9a7e" }}>
        {leadNome}
      </p>

      <div className="space-y-3">
        <div>
          <label className={CRM_SIDEOVER_LABEL}>Para quem *</label>
          <input
            className={CRM_SIDEOVER_INPUT}
            style={CRM_SIDEOVER_INPUT_STYLE}
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
            placeholder="Responsável, parceiro ou equipe…"
            autoFocus
          />
        </div>
        <div>
          <label className={CRM_SIDEOVER_LABEL}>Segmento</label>
          <input
            className={CRM_SIDEOVER_INPUT}
            style={CRM_SIDEOVER_INPUT_STYLE}
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div>
          <label className={CRM_SIDEOVER_LABEL}>Autorizado por</label>
          <input
            className={CRM_SIDEOVER_INPUT}
            style={CRM_SIDEOVER_INPUT_STYLE}
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            placeholder="Seu nome ou e-mail"
          />
        </div>
        <label className="flex items-center gap-2 text-xs" style={{ color: "#b8d4bc" }}>
          <input
            type="checkbox"
            checked={sugeridoIa}
            onChange={(e) => setSugeridoIa(e.target.checked)}
            className="rounded border-[rgba(63,152,72,0.42)]"
          />
          Sugestão da IA (exige validação humana)
        </label>
      </div>

      {erro ? (
        <p className="mt-3 text-xs text-[#fca5a5]" role="alert">
          {erro}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CrmSideoverActionGroup>
          <CrmSideoverActionBtn onClick={onCancel} title="Cancelar" disabled={salvando}>
            Cancelar
          </CrmSideoverActionBtn>
          <CrmSideoverActionBtn
            onClick={() => void enviar()}
            title="Confirmar encaminhamento"
            active
            disabled={salvando}
          >
            {salvando ? "Enviando…" : "Encaminhar"}
          </CrmSideoverActionBtn>
        </CrmSideoverActionGroup>
      </div>
    </CrmSideoverInlinePanel>
  );
}
