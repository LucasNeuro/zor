import type { SupabaseClient } from "@supabase/supabase-js";
import { actorFromRequestHeaders, type ActorCrm } from "@/lib/crm/registrar-auditoria-crm";

/** Resolve actor from CRM headers, including lookup via `x-caller-auth-id`. */
export async function resolveActorFromRequest(
  supabase: SupabaseClient,
  headers: Headers
): Promise<ActorCrm> {
  const fromHeaders = actorFromRequestHeaders(headers);
  const authId = headers.get("x-caller-auth-id")?.trim();

  if (authId) {
    const { data: user } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("auth_id", authId)
      .maybeSingle();

    if (user) {
      return {
        id: fromHeaders.id || (user.id != null ? String(user.id) : null),
        email:
          fromHeaders.email ||
          (typeof user.email === "string" ? user.email : null),
        nome:
          fromHeaders.nome ||
          (typeof user.name === "string" ? user.name : null),
      };
    }
  }

  return fromHeaders;
}

/** Slugs de demo/dev que não representam um operador real — ignorar no badge até assumir. */
export const LEGACY_HUMANO_PLACEHOLDERS = new Set(["wendel"]);

export function isLegacyHumanoPlaceholder(value: string | null | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return Boolean(v && LEGACY_HUMANO_PLACEHOLDERS.has(v));
}

/** Valor efetivo para UI: placeholders legados contam como sem humano. */
export function effectiveHumanoResponsavel(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v || isLegacyHumanoPlaceholder(v)) return null;
  return v;
}

/** Friendly label for UI badges (capitalizes slug-like values). */
export function formatHumanoDisplayName(slugOrName: string): string {
  const raw = slugOrName.trim();
  if (!raw) return "Operador";
  return raw
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Value stored in `hub_leads_crm.humano_responsavel` and `feito_por`. */
export function humanoResponsavelFromActor(actor: ActorCrm): string {
  const nome = actor.nome?.trim();
  if (nome) return nome.slice(0, 80);
  const email = actor.email?.trim();
  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local) return formatHumanoDisplayName(local).slice(0, 80);
  }
  const id = actor.id?.trim();
  if (id) return id.slice(0, 80);
  return "Operador";
}

/** Slug identifier for `agente_id` in fila (lowercase, hyphenated). */
export function slugFromActor(actor: ActorCrm): string {
  const nome = actor.nome?.trim();
  if (nome) {
    const slug = nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug) return slug.slice(0, 80);
  }
  const email = actor.email?.trim();
  if (email) return email.split("@")[0]?.slice(0, 80) || "operador";
  return "operador";
}
