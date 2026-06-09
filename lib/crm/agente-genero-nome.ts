export type GeneroAgenteAvatar = "feminino" | "masculino" | "neutro";

/** Primeiro token útil do nome de exibição do agente. */
export function extrairPrimeiroNome(nome: string): string {
  const limpo = nome
    .trim()
    .replace(/\s+ia$/i, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .trim();
  const parte = limpo.split(/\s+/)[0] ?? "";
  return parte.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const FEMININO = new Set([
  "ana", "maria", "mari", "julia", "juliana", "fernanda", "patricia", "carla", "paula",
  "beatriz", "camila", "larissa", "amanda", "gabriela", "mariana", "isabela", "raquel",
  "vanessa", "bruna", "natalia", "leticia", "luana", "renata", "claudia", "sandra",
  "adriana", "carolina", "daniela", "eliane", "helena", "ingrid", "jaqueline", "karen",
  "laura", "lucia", "luiza", "monica", "priscila", "rafaela", "roberta", "silvia",
  "sonia", "tatiana", "vera", "vitoria", "yasmin", "aline", "bianca", "debora", "elisa",
  "flavia", "gisele", "ivone", "joyce", "karina", "lorena", "milena", "nadia", "olivia",
  "regina", "sabrina", "tamires", "valeria", "livia",
]);

const MASCULINO = new Set([
  "joao", "jose", "pedro", "lucas", "carlos", "paulo", "marcos", "felipe", "gabriel",
  "rodrigo", "andre", "ricardo", "fernando", "bruno", "daniel", "eduardo", "guilherme",
  "henrique", "igor", "leonardo", "luciano", "marcelo", "mateus", "matheus", "miguel",
  "rafael", "renato", "roberto", "sergio", "thiago", "tiago", "vinicius", "wagner",
  "alexandre", "antonio", "augusto", "caio", "cesar", "diego", "enzo", "fabio", "gustavo",
  "heitor", "ivan", "julio", "kleber", "leandro", "luan", "murilo", "nelson", "otavio",
  "pablo", "raul", "samuel", "victor", "william", "yuri", "lucas", "shefa", "lucca", "luca",
]);

const NEUTRO_PALAVRAS = new Set([
  "atendimento", "sdr", "suporte", "vendas", "comercial", "marketing", "agente", "bot",
  "assistente", "copiloto", "operacao", "operacoes", "qualificacao", "pos", "posvenda",
  "ia", "ai", "hub", "waje",
]);

/**
 * Heurística PT-BR: primeiro nome → feminino / masculino / neutro (cargos genéricos).
 */
export function inferirGeneroPorNome(nome: string): GeneroAgenteAvatar {
  const token = extrairPrimeiroNome(nome);
  if (!token || token.length < 2) return "neutro";
  if (NEUTRO_PALAVRAS.has(token)) return "neutro";
  if (FEMININO.has(token)) return "feminino";
  if (MASCULINO.has(token)) return "masculino";
  if (token.endsWith("a") && !token.endsWith("ia") && token.length > 3) return "feminino";
  if (token.endsWith("o") || token.endsWith("os") || token.endsWith("or")) return "masculino";
  return "neutro";
}
