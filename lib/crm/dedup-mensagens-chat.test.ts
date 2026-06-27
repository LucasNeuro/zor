import { describe, expect, it } from "vitest";
import { mergeMensagensChatDeduped } from "@/lib/crm/dedup-mensagens-chat";

describe("mergeMensagensChatDeduped", () => {
  it("remove duplicata IA hub + turno no mesmo minuto", () => {
    const ts = "2026-06-27T11:46:00.000Z";
    const merged = mergeMensagensChatDeduped([
      {
        id: "1",
        direcao: "saida",
        conteudo: "Olá Marcelo",
        criado_em: ts,
        fonte: "hub_mensagens",
        agente_id: "dany",
        feito_por_tipo: "ia",
      },
      {
        id: "2",
        direcao: "saida",
        conteudo: "Olá Marcelo",
        criado_em: ts,
        fonte: "hub_fila_mensagens",
        feito_por_tipo: "ia",
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].agente_id).toBe("dany");
  });

  it("mantém lead e IA distintos ordenados", () => {
    const merged = mergeMensagensChatDeduped([
      {
        id: "b",
        direcao: "saida",
        conteudo: "Resposta",
        criado_em: "2026-06-27T18:38:10.000Z",
        fonte: "hub_mensagens",
        agente_id: "dany",
      },
      {
        id: "a",
        direcao: "entrada",
        conteudo: "Ola",
        criado_em: "2026-06-27T18:38:01.000Z",
        fonte: "hub_fila_mensagens",
      },
    ]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("no mesmo instante, entrada vem antes da saída", () => {
    const ts = "2026-06-27T19:19:00.000Z";
    const merged = mergeMensagensChatDeduped([
      {
        id: "ia",
        direcao: "saida",
        conteudo: "Agendado!",
        enviada_em: ts,
        fonte: "hub_mensagens",
        agente_id: "dany",
      },
      {
        id: "lead",
        direcao: "entrada",
        conteudo: "Tem pra amanhã às 17",
        enviada_em: ts,
        fonte: "hub_fila_mensagens",
      },
    ]);
    expect(merged.map((m) => m.id)).toEqual(["lead", "ia"]);
  });

  it("prefere enviada_em sobre criado_em desatualizado", () => {
    const merged = mergeMensagensChatDeduped([
      {
        id: "antiga",
        direcao: "saida",
        conteudo: "Até amanhã",
        criado_em: "2026-06-27T19:19:00.000Z",
        enviada_em: "2026-06-27T15:14:00.000Z",
        fonte: "hub_fila_mensagens",
      },
      {
        id: "nova",
        direcao: "entrada",
        conteudo: "Tem pra amanhã às 17",
        enviada_em: "2026-06-27T19:19:00.000Z",
        fonte: "hub_fila_mensagens",
      },
    ]);
    expect(merged.map((m) => m.id)).toEqual(["antiga", "nova"]);
  });
});
