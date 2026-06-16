import { describe, expect, it, vi } from "vitest";
import {
  executeFlowEngine,
  extrairNomeDaMensagemFluxo,
  normMenuChoiceText,
  resolveMenuChoiceId,
  type FlowEngineDefinition,
} from "./flow-engine";
import { buildBlocoContextoFluxoParaLlm } from "./simulacao-canal-flow";

const MENU_CHOICES = [
  { id: "m2_50_100", label: "De 50 a 100 m2" },
  { id: "m2_100_200", label: "De 100 a 200 m2" },
  { id: "m2_acima_200", label: "Acima de 200 m2" },
];

describe("resolveMenuChoiceId", () => {
  it("mapeia resposta numérica 1..n para o id da opção", () => {
    expect(resolveMenuChoiceId("1", null, MENU_CHOICES)).toBe("m2_50_100");
    expect(resolveMenuChoiceId("2", null, MENU_CHOICES)).toBe("m2_100_200");
    expect(resolveMenuChoiceId("3", null, MENU_CHOICES)).toBe("m2_acima_200");
  });

  it("aceita texto livre igual ou parecido com o rótulo", () => {
    expect(resolveMenuChoiceId("De 50 a 100 m2", null, MENU_CHOICES)).toBe("m2_50_100");
    expect(resolveMenuChoiceId("De 50 a 100 m²", null, MENU_CHOICES)).toBe("m2_50_100");
    expect(resolveMenuChoiceId("de 50 a 100 m2", null, MENU_CHOICES)).toBe("m2_50_100");
  });

  it("aceita id direto e formato label|id", () => {
    expect(resolveMenuChoiceId("m2_100_200", null, MENU_CHOICES)).toBe("m2_100_200");
    expect(resolveMenuChoiceId("De 100 a 200 m2|m2_100_200", null, MENU_CHOICES)).toBe(
      "m2_100_200"
    );
  });

  it("usa aliases globais quando o id pertence ao menu atual", () => {
    const global = (msg: string) => (msg === "Até 50" ? "arq_m2_ate50" : null);
    const choices = [
      { id: "arq_m2_ate50", label: "Até 50 m²" },
      { id: "arq_m2_51_250", label: "51-250 m²" },
    ];
    expect(resolveMenuChoiceId("Até 50", null, choices, global)).toBe("arq_m2_ate50");
  });
});

describe("normMenuChoiceText", () => {
  it("normaliza m² e pontuação", () => {
    expect(normMenuChoiceText("De 50 a 100 m²")).toBe("de 50 a 100 m2");
  });
});

describe("extrairNomeDaMensagemFluxo", () => {
  it("extrai nome de mensagem rica com intenção", () => {
    expect(extrairNomeDaMensagemFluxo("Sou Lucas, quero comprar apartamento")).toBe("Lucas");
    expect(extrairNomeDaMensagemFluxo("Meu nome é Ana Silva")).toBe("Ana Silva");
  });

  it("aceita nome curto puro", () => {
    expect(extrairNomeDaMensagemFluxo("Pedro")).toBe("Pedro");
  });
});

describe("resolveMenuChoiceId rich message", () => {
  it("resolve intenção em segmento após vírgula", () => {
    const choices = [
      { id: "triagem_arq", label: "Projeto arquitetura / design" },
      { id: "triagem_imob", label: "Comprar, vender ou alugar imóvel" },
    ];
    expect(
      resolveMenuChoiceId("Sou Lucas, quero comprar apartamento", null, choices)
    ).toBe("triagem_imob");
  });
});

describe("buildBlocoContextoFluxoParaLlm menu dedup", () => {
  const definition: FlowEngineDefinition = {
    start_step: "triagem_inicial_menu",
    steps: {
      triagem_inicial_menu: {
        id: "triagem_inicial_menu",
        type: "menu",
        text: "Como posso te ajudar?",
        choices: [
          { id: "triagem_arq", label: "Projeto arquitetura" },
          { id: "triagem_imob", label: "Comprar imóvel" },
        ],
      },
    },
  };

  it("pede intro curta sem lista numerada quando UAZAPI enhance ON", () => {
    const bloco = buildBlocoContextoFluxoParaLlm(
      definition,
      { step: "triagem_inicial_menu", answers: {}, active: true, complete: false },
      undefined,
      true
    );
    expect(bloco).toContain("NÃO liste opções numeradas");
    expect(bloco).not.toContain("1. Projeto arquitetura");
  });

  it("mantém lista numerada quando UAZAPI enhance OFF", () => {
    const bloco = buildBlocoContextoFluxoParaLlm(
      definition,
      { step: "triagem_inicial_menu", answers: {}, active: true, complete: false },
      undefined,
      false
    );
    expect(bloco).toContain("lista numerada");
    expect(bloco).toContain("1. Projeto arquitetura");
  });
});

describe("buildBlocoContextoFluxoParaLlm inicio_nome", () => {
  const definition: FlowEngineDefinition = {
    start_step: "inicio_nome",
    steps: {
      inicio_nome: {
        id: "inicio_nome",
        type: "ask_text",
        prompt: "Qual é o seu nome?",
        answer_key: "nome",
        next_step: "menu",
      },
    },
  };

  it("reforça pedir somente o nome quando ainda faltar", () => {
    const bloco = buildBlocoContextoFluxoParaLlm(definition, {
      step: "inicio_nome",
      answers: {},
      active: true,
      complete: false,
    });
    expect(bloco).toContain("somente");
    expect(bloco).toContain("como posso ajudar");
  });
});

describe("executeFlowEngine stateOnly", () => {
  const definition: FlowEngineDefinition = {
    start_step: "saudacao",
    steps: {
      saudacao: {
        id: "saudacao",
        type: "send_text",
        text: "Olá fixo",
        next_step: "pergunta",
      },
      pergunta: {
        id: "pergunta",
        type: "ask_text",
        prompt: "Qual seu nome?",
        answer_key: "nome",
        next_step: "concluido",
      },
      concluido: { id: "concluido", type: "complete", text: "Obrigado fixo" },
    },
  };

  it("não envia texto fixo e retorna skipIa=false", async () => {
    const sendText = vi.fn().mockResolvedValue(undefined);
    const persistState = vi.fn().mockResolvedValue(undefined);

    const result = await executeFlowEngine(
      definition,
      { step: null, answers: {}, mensagem: "oi", tipoMidia: "texto" },
      {
        sendText,
        sendMenu: vi.fn().mockResolvedValue({ ok: true }),
        resolveChoiceId: () => null,
        persistState,
        stateOnly: true,
      }
    );

    expect(result).toEqual({ handled: true, skipIa: false, step: "pergunta" });
    expect(sendText).not.toHaveBeenCalled();
  });
});

describe("executeFlowEngine menu", () => {
  const definition: FlowEngineDefinition = {
    start_step: "arq_tamanho",
    steps: {
      arq_tamanho: {
        id: "arq_tamanho",
        type: "menu",
        text: "Qual o tamanho?",
        answer_key: "arq_tamanho",
        choices: MENU_CHOICES.map((c) => ({ ...c, next_step: "arq_prazo" })),
      },
      arq_prazo: {
        id: "arq_prazo",
        type: "ask_text",
        prompt: "Cidade?",
        answer_key: "cidade",
        next_step: "concluido",
      },
      concluido: { id: "concluido", type: "complete" },
    },
  };

  it("avança com resposta numérica e grava answer_key", async () => {
    const persistState = vi.fn().mockResolvedValue(undefined);
    const sendMenu = vi.fn().mockResolvedValue({ ok: true });

    const result = await executeFlowEngine(
      definition,
      {
        step: "arq_tamanho",
        answers: {},
        mensagem: "2",
        tipoMidia: "texto",
      },
      {
        sendText: vi.fn().mockResolvedValue(undefined),
        sendMenu,
        resolveChoiceId: () => null,
        persistState,
      }
    );

    expect(result).toEqual({ handled: true, skipIa: true, step: "arq_prazo" });
    expect(sendMenu).not.toHaveBeenCalled();
    const persistedToPrazo = persistState.mock.calls.find(
      (call) => call[0]?.step === "arq_prazo" && call[0]?.answers?.arq_tamanho === "m2_100_200"
    );
    expect(persistedToPrazo).toBeTruthy();
  });
});

describe("executeFlowEngine slot-filling", () => {
  const definition: FlowEngineDefinition = {
    start_step: "inicio_nome",
    steps: {
      inicio_nome: {
        id: "inicio_nome",
        type: "ask_text",
        prompt: "Qual é o seu nome?",
        answer_key: "nome",
        next_step: "triagem_inicial_menu",
        min_length: 2,
      },
      triagem_inicial_menu: {
        id: "triagem_inicial_menu",
        type: "menu",
        text: "Como posso te ajudar?",
        answer_key: "intencao_inicial",
        choices: [
          { id: "triagem_arq", label: "Projeto arquitetura / design", next_step: "concluido" },
          { id: "triagem_imob", label: "Comprar, vender ou alugar imóvel", next_step: "concluido" },
        ],
      },
      concluido: { id: "concluido", type: "complete" },
    },
  };

  it("captura nome e intenção na mesma mensagem (stateOnly)", async () => {
    const persistState = vi.fn().mockResolvedValue(undefined);
    const onNameCaptured = vi.fn().mockResolvedValue(undefined);

    const result = await executeFlowEngine(
      definition,
      {
        step: "inicio_nome",
        answers: {},
        mensagem: "Sou Lucas, quero comprar apartamento",
        tipoMidia: "texto",
      },
      {
        sendText: vi.fn().mockResolvedValue(undefined),
        sendMenu: vi.fn().mockResolvedValue({ ok: true }),
        resolveChoiceId: () => null,
        persistState,
        onNameCaptured,
        stateOnly: true,
      }
    );

    expect(onNameCaptured).toHaveBeenCalledWith("Lucas");
    expect(result).toEqual({ handled: true, skipIa: false, step: "concluido" });
    const persistedComplete = persistState.mock.calls.find((call) => call[0]?.step === "concluido");
    expect(persistedComplete?.[0]?.answers?.nome).toBe("Lucas");
    expect(persistedComplete?.[0]?.answers?.intencao_inicial).toBe("triagem_imob");
  });
});
