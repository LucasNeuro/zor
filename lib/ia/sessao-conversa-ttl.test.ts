import { describe, expect, it } from "vitest";
import {
  filtrarLinhasHistoricoNaSessao,
  limparMetadataConversacional,
  sessaoConversaExpirada,
  sessaoConversaTtlMs,
} from "@/lib/ia/sessao-conversa-ttl";

describe("sessao-conversa-ttl", () => {
  it("expira após 12h por defeito", () => {
    const ttl = sessaoConversaTtlMs();
    expect(ttl).toBe(12 * 60 * 60 * 1000);
    const agora = Date.parse("2026-05-20T12:00:00.000Z");
    const ultima = agora - ttl - 1;
    expect(sessaoConversaExpirada(ultima, agora)).toBe(true);
    expect(sessaoConversaExpirada(agora - ttl + 60_000, agora)).toBe(false);
  });

  it("filtra linhas fora da janela", () => {
    const agora = Date.parse("2026-05-20T12:00:00.000Z");
    const recente = new Date(agora - 60_000).toISOString();
    const antiga = new Date(agora - 13 * 60 * 60 * 1000).toISOString();
    const linhas = filtrarLinhasHistoricoNaSessao(
      [
        { role: "user", content: "velho", criadoEm: antiga },
        { role: "assistant", content: "novo", criadoEm: recente },
      ],
      agora
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.content).toBe("novo");
  });

  it("limparMetadataConversacional remove playbook WhatsApp e fluxo", () => {
    const limpo = limparMetadataConversacional({
      nome_crm: "João",
      wa_playbook_step: "triagem_inicial",
      wa_playbook_answers: { triagem: "arq" },
      wa_playbook_active: true,
      wa_menu_triagem_enviado: true,
      wa_menu_triagem_enviado_at: "2026-05-20T10:00:00Z",
      fase_atendimento: "triagem",
      fluxo_ativo: "arq",
      triagem_escolha: "projeto",
      arq_tipo_imovel: "casa",
    });
    expect(limpo).toEqual({ nome_crm: "João" });
  });
});
