import { mergeUsoFerramentasComPadraoPreservandoCustom } from "@/lib/hub/agente-ferramentas-registry";
import {
  HUB_INTEGRADORES_CATALOGO,
  type IntegradorCatalogoEntry,
} from "@/lib/hub/integradores-catalogo";

export const GOOGLE_WORKSPACE_INTEGRADOR_IDS = ["gmail", "google_calendar"] as const;

export const GOOGLE_INTEGRADOR_FERRAMENTA_KEYS = [
  "hub_int_gmail_enviar",
  "hub_int_gcal_criar_evento",
  "hub_int_gcal_listar_eventos",
] as const;

export type CatalogoFerramentaIntegradorLite = {
  ferramenta_key: string;
  titulo: string;
  integrador_nome: string;
  politica: string;
  descricao_curta?: string | null;
  requerConexao?: boolean;
};

export function agenteUsaFerramentasGoogle(uso: unknown): boolean {
  const merged = mergeUsoFerramentasComPadraoPreservandoCustom(uso);
  return GOOGLE_INTEGRADOR_FERRAMENTA_KEYS.some((k) => merged[k] === true);
}

const AGENDA_CARGO_RE =
  /agend|agenda|reserv|marca[cç][aã]o|marca[cç]ar|compromiss|calend[aá]rio|meet|reuni[aã]o|hor[aá]rio/i;

export function cargoRecomendaGoogleWorkspace(opts: {
  cargoTitulo?: string | null;
  cargoDescricao?: string | null;
  cargoSlug?: string | null;
  cargoEspecialidade?: string | null;
  nomeAgente?: string | null;
}): boolean {
  const blob = [
    opts.cargoTitulo,
    opts.cargoDescricao,
    opts.cargoSlug,
    opts.cargoEspecialidade,
    opts.nomeAgente,
  ]
    .filter((x) => typeof x === "string" && x.trim())
    .join(" ");
  return AGENDA_CARGO_RE.test(blob);
}

/** Activa Calendar no agente de canal (produção). Respeita `false` explícito no uso. */
export function patchFerramentasGoogleAgendamento(
  uso: Record<string, boolean>
): Record<string, boolean> {
  const next = { ...uso };
  if (uso.hub_int_gcal_criar_evento !== false) next.hub_int_gcal_criar_evento = true;
  if (uso.hub_int_gcal_listar_eventos !== false) next.hub_int_gcal_listar_eventos = true;
  return next;
}

export function agentePrecisaGoogleWorkspace(
  uso: unknown,
  opts: { recomendaCargo?: boolean; modoCanal?: boolean }
): boolean {
  return (
    agenteUsaFerramentasGoogle(uso) ||
    opts.recomendaCargo === true ||
    opts.modoCanal === true
  );
}

/** URL de retorno OAuth no wizard (produção: waje.com.br ou NEXT_PUBLIC_APP_URL). */
export function wizardGoogleOAuthReturnTo(agenteSlug: string): string {
  const base =
    (typeof window !== "undefined" ? window.location.origin : "") ||
    (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") ||
    "https://waje.com.br";
  return `${base.replace(/\/$/, "")}/crm/agentes?novo=1&wizard_google=1&agente=${encodeURIComponent(agenteSlug)}`;
}

export function googleIntegradoresCatalogo(): IntegradorCatalogoEntry[] {
  return HUB_INTEGRADORES_CATALOGO.filter((e) =>
    (GOOGLE_WORKSPACE_INTEGRADOR_IDS as readonly string[]).includes(e.id)
  );
}

export function buildGoogleIntegradorCatalogLite(opts?: { requerConexao?: boolean }): CatalogoFerramentaIntegradorLite[] {
  const lista: CatalogoFerramentaIntegradorLite[] = [];
  for (const entry of googleIntegradoresCatalogo()) {
    for (const f of entry.ferramentas) {
      lista.push({
        ferramenta_key: f.ferramenta_key,
        titulo: f.titulo,
        integrador_nome: entry.nome,
        politica: f.politica,
        descricao_curta: f.descricao_curta ?? null,
        requerConexao: opts?.requerConexao,
      });
    }
  }
  return lista;
}

export const WIZARD_OAUTH_RESUME_KEY = "waje_agente_wizard_oauth_return";

export type WizardOAuthResume = {
  passo: number;
  agenteSlug: string;
};

export function saveWizardOAuthResume(data: WizardOAuthResume): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(WIZARD_OAUTH_RESUME_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Mensagem legível quando o Google devolve access_denied (app em modo Teste). */
export function googleOAuthErroAmigavel(raw: string | null | undefined): string {
  const msg = (raw ?? "").trim();
  if (!msg) {
    return "Não foi possível ligar a conta Google. Tente novamente ou use outro e-mail.";
  }
  if (msg === "access_denied" || /access_denied|403/i.test(msg)) {
    return (
      "O Google recusou o login (403). Se o app ainda está em modo Teste, adicione o e-mail em " +
      "Google Cloud Console → Tela de consentimento OAuth → Usuários de teste. " +
      "Para produção aberta a qualquer cliente, publique o app (verificação Google) em «Publicar app»."
    );
  }
  if (msg === "state_invalido_ou_expirado") {
    return "A sessão OAuth expirou. Volte ao assistente e clique em «Ligar conta Google» de novo.";
  }
  if (/invalid_client/i.test(msg)) {
    return (
      "A chave secreta OAuth no servidor não confere com o Google Cloud (invalid_client). " +
      "Confira GOOGLE_OAUTH_CLIENT_SECRET no .env / Render — use a secret ativa em GCP → Clientes."
    );
  }
  return msg.length > 220 ? `${msg.slice(0, 220)}…` : msg;
}

export function readWizardOAuthResume(): WizardOAuthResume | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(WIZARD_OAUTH_RESUME_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as WizardOAuthResume;
    if (!j?.agenteSlug?.trim() || typeof j.passo !== "number") return null;
    return { passo: j.passo, agenteSlug: j.agenteSlug.trim() };
  } catch {
    return null;
  } finally {
    try {
      sessionStorage.removeItem(WIZARD_OAUTH_RESUME_KEY);
    } catch {
      /* ignore */
    }
  }
}
