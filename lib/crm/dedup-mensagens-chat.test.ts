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
});
