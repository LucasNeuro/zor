export type WajeMiniBotOption = {
  id: string;
  label: string;
};

export type WajeMiniBotQuestion = {
  id: string;
  pergunta: string;
  opcoes: WajeMiniBotOption[];
};

export type WajeMiniBotResposta = {
  pergunta: string;
  resposta: string;
  resposta_id: string;
};

export const WAJE_MINI_BOT_INTRO =
  "Olá! 👋 Sou o assistente da Waje. Em poucos passos entendo seu cenário e registro seu interesse para nossa equipe retornar.";

export const WAJE_MINI_BOT_PERGUNTAS: WajeMiniBotQuestion[] = [
  {
    id: "interesse_principal",
    pergunta: "O que você quer estruturar primeiro?",
    opcoes: [
      { id: "whatsapp_ia", label: "Atendimento WhatsApp com IA" },
      { id: "crm", label: "CRM e funil de vendas" },
      { id: "email_ia", label: "Canal e-mail com IA" },
      { id: "tudo", label: "Tudo integrado (WhatsApp + CRM + IA)" },
    ],
  },
  {
    id: "tamanho_equipe",
    pergunta: "Qual o tamanho da sua operação hoje?",
    opcoes: [
      { id: "solo", label: "Só eu / autônomo" },
      { id: "pequena", label: "2 a 5 pessoas" },
      { id: "media", label: "6 a 20 pessoas" },
      { id: "grande", label: "Mais de 20 pessoas" },
    ],
  },
  {
    id: "prazo_inicio",
    pergunta: "Quando pretende começar?",
    opcoes: [
      { id: "mes", label: "Este mês" },
      { id: "trimestre", label: "Nos próximos 3 meses" },
      { id: "explorando", label: "Só conhecendo por enquanto" },
    ],
  },
];

export function labelOpcao(perguntaId: string, opcaoId: string): string {
  const q = WAJE_MINI_BOT_PERGUNTAS.find((p) => p.id === perguntaId);
  const o = q?.opcoes.find((x) => x.id === opcaoId);
  return o?.label ?? opcaoId;
}
