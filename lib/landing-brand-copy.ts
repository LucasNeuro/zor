export function landingChatIntro(brandNome: string): string {
  return `Olá! Sou um assistente virtual da ${brandNome}. Posso qualificar leads, responder no WhatsApp e encaminhar para sua equipe quando precisar.`;
}

export function landingChatSuggestions(brandNome: string): string[] {
  return [
    `Como a ${brandNome} transforma meu atendimento no WhatsApp?`,
    "A equipe pode assumir quando quiser?",
    "Funciona para várias empresas?",
  ];
}

export function miniBotIntro(brandNome: string): string {
  return `Olá! 👋 Sou o assistente da ${brandNome}. Em poucos passos entendo seu cenário e registro seu interesse para nossa equipe retornar.`;
}

export function miniBotSuccessMessage(brandNome: string): string {
  return `Obrigado! ✅ Registramos seu interesse. Em breve alguém da ${brandNome} fala com você.`;
}

export function miniBotTeaserCopy(brandNome: string): string {
  return `Responda 3 perguntas rápidas e deixe seu contato — a equipe ${brandNome} retorna em breve.`;
}
