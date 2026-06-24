import {
  mensagemEhSaudacaoSimples,
  leadJaRecebeuMenuTriagem,
  mensagemPedeMenuOuOpcoes,
} from "@/lib/whatsapp/menu-triagem-uazapi";
import { mensagemJaIndicaIntentTriagem } from "@/lib/whatsapp/menu-intent";

/** Pedido direto (link, reunião, dúvida) — não anexar menu de triagem genérico. */
export function mensagemPedidoConversacionalSemTriagem(mensagem: string): boolean {
  const t = mensagem.trim().toLowerCase();
  if (!t || t.length > 280) return false;
  if (mensagemPedeMenuOuOpcoes(mensagem)) return false;
  return (
    /\b(link|meet\.google|zoom|convite)\b/.test(t) ||
    /\b(reuni[aã]o|agenda|hor[aá]rio)\b/.test(t) ||
    /\b(manda|envia|reenvia|mandar|enviar)\b.{0,36}\b(link|convite|meet)\b/.test(t) ||
    /\b(consegue|pode|quero)\b.{0,28}\b(mandar|enviar|reenviar)\b/.test(t) ||
    /\b(novamente|de novo|outra vez)\b/.test(t) ||
    /\b(pre[cç]o|or[cç]amento|proposta|contrato|demo|demonstra)\b/.test(t)
  );
}

export function fluxoTriagemJaAvancado(flowAnswers?: Record<string, string>): boolean {
  if (!flowAnswers) return false;
  const keys = Object.keys(flowAnswers).filter((k) => String(flowAnswers[k] ?? "").trim());
  if (keys.length >= 2) return true;
  return Boolean(
    flowAnswers.interesse_principal?.trim() ||
      flowAnswers.triagem?.trim() ||
      flowAnswers.fluxo_ativo?.trim()
  );
}

/** Menu UAZAPI automático só no 1º contacto ou quando o cliente pede opções — nunca após cada resposta da IA. */
export function deveAnexarMenuTriagemAutomatico(params: {
  metadata: unknown;
  mensagem: string;
  isNovo?: boolean;
  flowAnswers?: Record<string, string>;
}): boolean {
  if (leadJaRecebeuMenuTriagem(params.metadata)) return false;
  if (mensagemPedidoConversacionalSemTriagem(params.mensagem)) return false;
  if (mensagemJaIndicaIntentTriagem(params.mensagem)) return false;
  if (fluxoTriagemJaAvancado(params.flowAnswers)) return false;
  if (mensagemPedeMenuOuOpcoes(params.mensagem)) return true;
  if (params.isNovo || mensagemEhSaudacaoSimples(params.mensagem)) return true;
  return false;
}
