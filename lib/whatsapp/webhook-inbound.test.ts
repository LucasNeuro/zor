import { describe, expect, it } from "vitest";
import { extractWebhookInstanceRefs, parseWhatsappWebhookBody } from "./webhook-inbound";

const PNG = "5511914589862";

describe("parseWhatsappWebhookBody UAZAPI", () => {
  it("formato clássico data.*", () => {
    const r = parseWhatsappWebhookBody({
      event: "messages",
      instance: "inst-1",
      data: {
        fromMe: false,
        isGroup: false,
        chatid: `${PNG}@s.whatsapp.net`,
        sender: `${PNG}@s.whatsapp.net`,
        senderName: "Lead",
        messageid: "abc",
        messageTimestamp: 1_700_000_000,
        messageType: "conversation",
        text: "Olá",
      },
    });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.telefone).toBe(PNG);
      expect(r.value.mensagemFinal).toBe("Olá");
    }
  });

  it("EventType no root com campos Message", () => {
    const r = parseWhatsappWebhookBody({
      EventType: "messages",
      instance: "inst-1",
      chatid: `${PNG}@s.whatsapp.net`,
      sender: `${PNG}@s.whatsapp.net`,
      messageid: "x1",
      messageTimestamp: 1_700_000_000_000,
      messageType: "conversation",
      text: "gostaria de fazer parte",
    });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.value.mensagemFinal).toContain("gostaria");
  });

  it("texto em content.conversation (JSON object)", () => {
    const r = parseWhatsappWebhookBody({
      event: "messages",
      instance: "i",
      data: {
        fromMe: false,
        chatid: `${PNG}@s.whatsapp.net`,
        sender: `${PNG}@s.whatsapp.net`,
        messageid: "m2",
        messageTimestamp: 1_700_000_000,
        messageType: "ExtendedTextMessage",
        content: { conversation: "Olá do WhatsApp" },
      },
    });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.value.mensagemFinal).toBe("Olá do WhatsApp");
  });

  it("data como array", () => {
    const r = parseWhatsappWebhookBody({
      event: "messages",
      data: [
        {
          fromMe: false,
          chatid: `${PNG}@s.whatsapp.net`,
          sender: `${PNG}@s.whatsapp.net`,
          messageid: "m3",
          messageTimestamp: 1_700_000_000,
          text: "array ok",
        },
      ],
    });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.value.mensagemFinal).toBe("array ok");
  });

  it("extrai token de instância no root (webhook global)", () => {
    const refs = extractWebhookInstanceRefs({
      event: "messages",
      token: "792df438-5d32-4e14-aaaa-bbbb",
      chatid: `${PNG}@s.whatsapp.net`,
      text: "oi",
    });
    expect(refs.instanceToken).toBe("792df438-5d32-4e14-aaaa-bbbb");
  });

  it("ignora messages_update", () => {
    const r = parseWhatsappWebhookBody({
      event: "messages_update",
      data: { text: "x", chatid: `${PNG}@s.whatsapp.net`, fromMe: false },
    });
    expect(r.kind).toBe("unknown_event");
  });

  it("prioriza chatid quando sender vem como @lid", () => {
    const r = parseWhatsappWebhookBody({
      event: "messages",
      data: {
        fromMe: false,
        chatid: "5511970364763@s.whatsapp.net",
        sender: "7249938374763@lid",
        messageid: "lid-1",
        messageTimestamp: 1_700_000_000,
        text: "olá com lid",
      },
    });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.telefone).toBe("5511970364763");
      expect(r.value.mensagemFinal).toBe("olá com lid");
    }
  });

  it("webhook global UAZAPI: clique em botão (buttonOrListid + convertOptions)", () => {
    const r = parseWhatsappWebhookBody({
      BaseUrl: "https://example.uazapi.com",
      EventType: "messages",
      token: "inst-token",
      instanceName: "mari",
      owner: "5511999999999",
      chat: {
        chatid: "5511970364501@s.whatsapp.net",
        name: "Lucas",
      },
      message: {
        fromMe: false,
        isGroup: false,
        messageid: "btn-triagem-arq",
        messageTimestamp: 1_700_000_000_000,
        messageType: "buttonsResponseMessage",
        text: "",
        buttonOrListid: "triagem_arq",
        convertOptions: "Projeto arquitetura / design",
      },
    });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.telefone).toBe("5511970364501");
      expect(r.value.menuChoiceId).toBe("triagem_arq");
      expect(r.value.mensagemFinal).toBe("Projeto arquitetura / design");
      expect(r.value.pushName).toBe("Lucas");
    }
  });

  it("aceita clique só com buttonOrListid (sem convertOptions)", () => {
    const r = parseWhatsappWebhookBody({
      EventType: "messages",
      message: {
        fromMe: false,
        chatid: `${PNG}@s.whatsapp.net`,
        messageid: "btn-id-only",
        messageTimestamp: 1_700_000_000,
        text: "",
        buttonOrListid: "triagem_imob",
      },
    });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.value.menuChoiceId).toBe("triagem_imob");
      expect(r.value.mensagemFinal).toBe("triagem_imob");
    }
  });
});
