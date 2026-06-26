/** Mensagem amigável quando o Postgres/Supabase não tem colunas da migração de gatilho. */
export function mensagemErroFollowupDb(error: { message?: string; code?: string } | null): string {
  const msg = String(error?.message ?? "").trim();
  const code = String(error?.code ?? "");

  const colunaGatilho =
    /gatilho_|atraso_dias|disparo_hora_dia|execucao_modo|horarios_disparo/i.test(msg) ||
    code === "42703" ||
    code === "PGRST204";

  if (colunaGatilho) {
    return (
      "O banco ainda não tem as colunas de gatilho do follow-up. " +
      "No Supabase → SQL Editor, execute o ficheiro " +
      "`supabase/migrations/20260721120000_hub_followup_gatilho.sql` e " +
      "`supabase/migrations/20260726090000_hub_followup_janela_horaria.sql`, depois tente guardar de novo."
    );
  }

  return msg || "Erro ao gravar follow-up.";
}
