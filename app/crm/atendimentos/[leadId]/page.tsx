"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AtendimentoWorkspace360 } from "@/components/crm/atendimento/AtendimentoWorkspace360";
import {
  estagiosAtendimentoFromPipeline,
  ESTAGIOS_ATENDIMENTO_FALLBACK,
} from "@/lib/crm/atendimento-shared";
import {
  patchCrmLeadsListCache,
  useCrmLeadsList,
  type CrmLeadRow,
} from "@/hooks/useCrmLeadsQueries";
import { useCrmPipelines } from "@/hooks/useCrmDataQueries";
import dynamic from "next/dynamic";

const NegocioDetailSideover = dynamic(
  () =>
    import("@/components/crm/negocios/NegocioDetailSideover").then((m) => ({
      default: m.NegocioDetailSideover,
    })),
  { ssr: false }
);

function AtendimentoDetalheContent() {
  const params = useParams();
  const queryClient = useQueryClient();
  const leadId = String(params.leadId ?? "");

  const leadsQuery = useCrmLeadsList();
  const pipelinesQuery = useCrmPipelines("atendimento");
  const [selectedNegocioId, setSelectedNegocioId] = useState<string | null>(null);

  const initialLead = useMemo(
    () => leadsQuery.data?.find((l) => l.id === leadId) ?? null,
    [leadsQuery.data, leadId]
  );

  const estagios = useMemo(() => {
    const pipe = pipelinesQuery.data?.[0];
    return pipe ? estagiosAtendimentoFromPipeline(pipe.estagios) : ESTAGIOS_ATENDIMENTO_FALLBACK;
  }, [pipelinesQuery.data]);

  const patchLead = useCallback(
    (updated: CrmLeadRow) => {
      patchCrmLeadsListCache(queryClient, (prev) =>
        prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
      );
    },
    [queryClient]
  );

  if (!initialLead && leadsQuery.isPending) {
    return (
      <p className="py-12 text-center text-sm text-[#6b8a76]">A carregar atendimento…</p>
    );
  }

  return (
    <>
      <AtendimentoWorkspace360
        leadId={leadId}
        estagios={estagios}
        initialLead={initialLead}
        onLeadUpdated={patchLead}
        onNegocioCreated={(lead, negocioId) => {
          patchLead(lead);
          setSelectedNegocioId(negocioId);
        }}
        onOpenNegocio={(negocioId) => setSelectedNegocioId(negocioId)}
      />

      <NegocioDetailSideover
        open={!!selectedNegocioId}
        negocioId={selectedNegocioId}
        onClose={() => setSelectedNegocioId(null)}
      />
    </>
  );
}

export default function AtendimentoDetalhePage() {
  return (
    <Suspense
      fallback={
        <p className="py-12 text-center text-sm text-[#6b8a76]">A carregar atendimento…</p>
      }
    >
      <AtendimentoDetalheContent />
    </Suspense>
  );
}
