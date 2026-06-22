export function mensagemJaIndicaIntentTriagem(mensagem: string): boolean {
  const t = mensagem.trim().toLowerCase();
  if (!t || t.length > 200) return false;
  return (
    /\b(fazer|quero|gostaria|preciso|vou)\b.{0,40}\b(pedido|pedir|encomenda)\b/.test(t) ||
    /\bpedido\b.{0,30}\b(delivery|entrega)\b/.test(t) ||
    /\bdelivery\b/.test(t) ||
    /\bretirar\b.{0,24}\bbalc[aã]o\b/.test(t) ||
    /\bbuscar\b.{0,20}\bloja\b/.test(t) ||
    /\bcard[aá]pio\b/.test(t) ||
    /\bhor[aá]rio\b.{0,20}\bfuncionamento\b/.test(t)
  );
}

/** Cliente pede cardápio, menu ou preços — priorizar base de conhecimento, não só fluxo/endereço. */
export function mensagemPedeCardapioOuPreco(mensagem: string): boolean {
  const t = mensagem.trim().toLowerCase();
  if (!t || t.length > 200) return false;
  return (
    /\bcard[aá]pio\b/.test(t) ||
    /\bmenu\b/.test(t) ||
    /\b(cad[eê]|onde est[aá])\s+(o\s+)?card[aá]pio\b/.test(t) ||
    /\bver\s+(o\s+)?(card[aá]pio|menu)\b/.test(t) ||
    /\b(quanto|pre[cç]o|valor|qual)\b.{0,40}\b(prato|marmit|combo|refei|item|lanche|pizza|burger|hamb[uú]rguer)/.test(t) ||
    /\blista\s+de\s+(pratos|comidas|op[cç][oõ]es)\b/.test(t)
  );
}
