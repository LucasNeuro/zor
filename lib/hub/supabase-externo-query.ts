import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_EXTERNO_TABELAS_BLOQUEADAS } from "@/lib/hub/supabase-externo-constants";

export type SupabaseExternoCredenciais = {
  project_url: string;
  api_key: string;
};

const MAX_LIMITE = 50;
const NOME_TABELA_RE = /^[a-z][a-z0-9_]{0,62}$/i;

export function normalizarSupabaseProjectUrl(raw: string): string | null {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return null;
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    if (!u.hostname.includes("supabase")) return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export function validarNomeTabelaExterna(nome: string): boolean {
  const n = nome.trim();
  if (!NOME_TABELA_RE.test(n)) return false;
  if (SUPABASE_EXTERNO_TABELAS_BLOQUEADAS.has(n.toLowerCase())) return false;
  return true;
}

export function clienteSupabaseExterno(cred: SupabaseExternoCredenciais): SupabaseClient {
  return createClient(cred.project_url, cred.api_key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function testarConexaoSupabaseExterno(cred: SupabaseExternoCredenciais): Promise<{
  ok: boolean;
  detalhe?: string;
}> {
  const base = normalizarSupabaseProjectUrl(cred.project_url);
  const key = cred.api_key?.trim();
  if (!base || !key) {
    return { ok: false, detalhe: "URL do projecto e chave API são obrigatórios." };
  }

  try {
    const res = await fetch(`${base}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, detalhe: "Chave API recusada (401/403). Use a service_role ou anon com RLS adequado." };
    }
    if (!res.ok && res.status !== 404) {
      return { ok: false, detalhe: `Supabase respondeu HTTP ${res.status}.` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro_rede";
    return { ok: false, detalhe: msg };
  }
}

export type SupabaseExternoConsultaArgs = {
  tabela: string;
  colunas?: string[];
  limite?: number;
  filtro_coluna?: string;
  filtro_texto?: string;
};

export async function consultarSupabaseExterno(
  cred: SupabaseExternoCredenciais,
  args: SupabaseExternoConsultaArgs
): Promise<string> {
  const tabela = args.tabela?.trim();
  if (!tabela || !validarNomeTabelaExterna(tabela)) {
    return JSON.stringify({
      ok: false,
      erro: "tabela_invalida",
      detalhe: "Informe o nome de uma tabela ou view pública (letras, números e _).",
    });
  }

  const limite = Math.min(
    MAX_LIMITE,
    Math.max(1, typeof args.limite === "number" && Number.isFinite(args.limite) ? args.limite : 25)
  );

  const colunas =
    Array.isArray(args.colunas) && args.colunas.length
      ? args.colunas
          .map((c) => String(c).trim())
          .filter((c) => /^[a-z_][a-z0-9_]*$/i.test(c))
          .join(",")
      : "*";

  const base = normalizarSupabaseProjectUrl(cred.project_url);
  const key = cred.api_key?.trim();
  if (!base || !key) {
    return JSON.stringify({ ok: false, erro: "supabase_externo_nao_configurado" });
  }

  const client = clienteSupabaseExterno({ project_url: base, api_key: key });
  let q = client.from(tabela).select(colunas).limit(limite);

  const filtroCol = args.filtro_coluna?.trim();
  const filtroTxt = args.filtro_texto?.trim();
  if (filtroCol && filtroTxt && /^[a-z_][a-z0-9_]*$/i.test(filtroCol)) {
    q = q.ilike(filtroCol, `%${filtroTxt.replace(/[%_]/g, "")}%`);
  }

  const { data, error } = await q;
  if (error) {
    return JSON.stringify({
      ok: false,
      erro: "supabase_externo_query",
      detalhe: error.message,
      codigo: error.code,
    });
  }

  return JSON.stringify({
    ok: true,
    origem: "supabase_externo",
    tabela,
    total: Array.isArray(data) ? data.length : 0,
    linhas: data ?? [],
    aviso:
      "Dados de base externa — só leitura. Para gravar no CRM Waje use hub_int_crm_operar ou hub_int_crm_atualizar_lead.",
  });
}

export function credenciaisSupabaseExternoDeRow(credObj: Record<string, unknown>): SupabaseExternoCredenciais | null {
  const project_url = normalizarSupabaseProjectUrl(
    typeof credObj.project_url === "string"
      ? credObj.project_url
      : typeof credObj.url === "string"
        ? credObj.url
        : ""
  );
  const api_key =
    typeof credObj.api_key === "string"
      ? credObj.api_key.trim()
      : typeof credObj.service_role_key === "string"
        ? credObj.service_role_key.trim()
        : "";
  if (!project_url || !api_key) return null;
  return { project_url, api_key };
}
