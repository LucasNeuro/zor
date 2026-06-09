"use client";

import {
  CrmKanbanNotesSection,
  type NotaPreview,
} from "@/components/crm/CrmKanbanNotesSection";

type Props = {
  notas: NotaPreview[];
};

/** Secção colapsável de anotações no rodapé dos cards Kanban (leads e negócios). */
export function LeadNotesCollapsible({ notas }: Props) {
  return <CrmKanbanNotesSection notas={notas} />;
}
