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
});
