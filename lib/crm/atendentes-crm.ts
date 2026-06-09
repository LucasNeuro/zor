import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";

export type AtendenteCrm = {
  id: string;
  tenant_id: string;
  nome: string;
  telefone: string;
  slug: string | null;
  email: string | null;
  cargo: string | null;
  agente_slug: string | null;
  ativo: boolean;
  metadata: Record<string, unknown>;
  criado_em: string;
  atualizado_em: string;
};

export function normalizarTelefoneAtendente(raw: string): string {
  return telefoneConversaId(raw);
}

export function slugAtendenteFromNome(nome: string): string | null {
  const slug = nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || null;
}

export function isAtendentesCrmMigrationMissing(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("hub_atendentes_crm") || (m.includes("schema cache") && m.includes("atendentes"));
}
