import { describe, expect, it } from "vitest";
import { avaliarDisparoPasso } from "@/lib/hub/followup-schedule";
import { minutosSilencioDesdeUltimaMsgCliente, parseFollowupTimestamp } from "@/lib/hub/followup-relogio";
import type { HubAgenteFollowupPasso } from "@/lib/hub/followup-types";
import {
  corpoTemplateFollowupPasso,
  normalizarCorpoPassoFollowupParaGravar,
  textoExibicaoFollowupPasso,
} from "@/lib/hub/followup-types";

const passoBase: HubAgenteFollowupPasso = {
  id: "p1",
  config_id: "c1",
  tenant_id: null,
  agente_slug: "teste",
  ordem: 1,
  espera_minutos: 5,
  atraso_dias: 0,
  atraso_horas: 0,
  atraso_minutos: 0,
  tipo_conteudo: "texto",
  texto_template: "Oi {nome}",
  imagem_url: null,
  legenda_imagem: null,
  ativo: true,
};

describe("followup relógio do cliente", () => {
  it("calcula minutos desde ultima_msg_cliente_em", () => {
    const agora = Date.parse("2026-06-25T19:00:00.000Z");
    const iso = "2026-06-25T18:55:00.000Z";
    expect(minutosSilencioDesdeUltimaMsgCliente(iso, agora)).toBe(5);
  });

  it("retorna null sem ultima_msg_cliente_em", () => {
    expect(minutosSilencioDesdeUltimaMsgCliente(null, Date.now())).toBeNull();
  });

  it("parseFollowupTimestamp aceita ISO WhatsApp", () => {
    const d = parseFollowupTimestamp("2026-06-25T18:47:00.000Z");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-06-25T18:47:00.000Z");
  });
});

describe("avaliarDisparoPasso — passo 1 (espera_minutos)", () => {
  it("dispara após 5 min de silêncio", () => {
    const r = avaliarDisparoPasso({
      indicePasso: 0,
      passo: passoBase,
      minutosSilencio: 5,
      minutosDesdeUltimoFollowup: null,
    });
    expect(r.permitido).toBe(true);
  });

  it("aguarda antes dos 5 min", () => {
    const r = avaliarDisparoPasso({
      indicePasso: 0,
      passo: passoBase,
      minutosSilencio: 2,
      minutosDesdeUltimoFollowup: null,
    });
    expect(r.permitido).toBe(false);
    expect(r.motivo).toBe("aguardando_espera");
    expect(r.detalhe).toContain("faltam 3 min");
  });

  it("passo 2 usa tempo desde ultimo follow-up", () => {
    const r = avaliarDisparoPasso({
      indicePasso: 1,
      passo: { ...passoBase, ordem: 2, espera_minutos: 720 },
      minutosSilencio: 999,
      minutosDesdeUltimoFollowup: 60,
      enviadosCount: 1,
    });
    expect(r.permitido).toBe(false);
    expect(r.motivo).toBe("aguardando_espera");
    expect(r.detalhe).toContain("passo anterior");
  });

  it("não reenvia passo 1 se ultimo_followup já existe", () => {
    const r = avaliarDisparoPasso({
      indicePasso: 0,
      passo: passoBase,
      minutosSilencio: 60,
      minutosDesdeUltimoFollowup: 5,
      enviadosCount: 0,
    });
    expect(r.permitido).toBe(false);
    expect(r.motivo).toBe("passo_ja_enviado");
  });
});

describe("avaliarDisparoPasso — legado sem espera_minutos", () => {
  it("usa gatilho + atraso legado no passo 1", () => {
    const r = avaliarDisparoPasso({
      indicePasso: 0,
      passo: { ...passoBase, espera_minutos: null, atraso_minutos: 5 },
      config: { gatilho_minutos: 5 },
      minutosSilencio: 8,
      minutosDesdeUltimoFollowup: null,
    });
    expect(r.permitido).toBe(false);
    expect(r.motivo).toBe("aguardando_espera");
  });
});

describe("corpo follow-up por tipo", () => {
  it("imagem+legenda usa legenda_imagem e ignora texto_template fantasma", () => {
    const passo: HubAgenteFollowupPasso = {
      ...passoBase,
      tipo_conteudo: "texto_imagem",
      texto_template: "texto antigo no campo errado",
      legenda_imagem: "Legenda nova {nome}",
    };
    expect(corpoTemplateFollowupPasso(passo)).toBe("Legenda nova {nome}");
    expect(textoExibicaoFollowupPasso(passo)).toBe("Legenda nova {nome}");
    expect(normalizarCorpoPassoFollowupParaGravar(passo)).toEqual({
      texto_template: null,
      legenda_imagem: "Legenda nova {nome}",
    });
  });

  it("só texto grava em texto_template", () => {
    const passo: HubAgenteFollowupPasso = {
      ...passoBase,
      tipo_conteudo: "texto",
      texto_template: "Oi {nome}",
      legenda_imagem: "legenda residual",
    };
    expect(normalizarCorpoPassoFollowupParaGravar(passo)).toEqual({
      texto_template: "Oi {nome}",
      legenda_imagem: null,
    });
  });
});
