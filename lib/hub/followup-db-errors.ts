/** Mensagem amigável quando o Postgres/Supabase não tem colunas da migração de gatilho. */
export function mensagemErroFollowupDb(error: { message?: string; code?: string } | null): string {
  const msg = String(error?.message ?? "").trim();
  const code = String(error?.code ?? "");

  const colunaGatilho =
    /gatilho_|atraso_dias|disparo_hora_dia|execucao_modo|horarios_disparo|janela_modo|horario_inicio|horario_fim|max_envios_por_dia|max_envios_total_lead|hub_followup_envio/i.test(msg) ||
    code === "42703" ||
    code === "PGRST204";

  if (colunaGatilho) {
    return (
      "O banco ainda não tem as colunas/tabelas de follow-up. " +
      "No Supabase → SQL Editor, execute os ficheiros em `supabase/migrations/`, " +
      "incluindo `20260727120000_hub_followup_ledger_faixa.sql` e `20260728100000_hub_followup_default_faixa.sql`, depois tente guardar de novo."
    );
  }

  return msg || "Erro ao gravar follow-up.";
}
