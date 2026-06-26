import { describe, expect, it } from "vitest";
import { avaliarDisparoPasso } from "@/lib/hub/followup-schedule";
import { minutosSilencioDesdeUltimaMsgCliente, parseFollowupTimestamp } from "@/lib/hub/followup-relogio";
import type { HubAgenteFollowupPasso } from "@/lib/hub/followup-types";

const passoBase: HubAgenteFollowupPasso = {
  id: "p1",
  config_id: "c1",
  tenant_id: null,
  agente_slug: "teste",
  ordem: 1,
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

describe("avaliarDisparoPasso — passo 1", () => {
  it("dispara após gatilho 5 min com atraso extra 0", () => {
    const r = avaliarDisparoPasso({
      indicePasso: 0,
      passo: passoBase,
      gatilho_minutos: 5,
      minutosSilencio: 5,
      minutosDesdeUltimoFollowup: null,
    });
    expect(r.permitido).toBe(true);
  });

  it("aguarda gatilho antes dos 5 min", () => {
    const r = avaliarDisparoPasso({
      indicePasso: 0,
      passo: passoBase,
      gatilho_minutos: 5,
      minutosSilencio: 2,
      minutosDesdeUltimoFollowup: null,
    });
    expect(r.permitido).toBe(false);
    expect(r.motivo).toBe("aguardando_gatilho");
  });

  it("soma gatilho + atraso extra no passo 1", () => {
    const r = avaliarDisparoPasso({
      indicePasso: 0,
      passo: { ...passoBase, atraso_minutos: 5 },
      gatilho_minutos: 5,
      minutosSilencio: 8,
      minutosDesdeUltimoFollowup: null,
    });
    expect(r.permitido).toBe(false);
    expect(r.motivo).toBe("aguardando_atraso_passo");
    expect(r.detalhe).toContain("total 10 min");
  });

  it("passo 2 usa tempo desde ultimo follow-up", () => {
    const r = avaliarDisparoPasso({
      indicePasso: 1,
      passo: { ...passoBase, ordem: 2, atraso_horas: 12 },
      gatilho_minutos: 5,
      minutosSilencio: 999,
      minutosDesdeUltimoFollowup: 60,
    });
    expect(r.permitido).toBe(false);
    expect(r.motivo).toBe("aguardando_atraso_passo");
    expect(r.detalhe).toContain("passo anterior");
  });
});
