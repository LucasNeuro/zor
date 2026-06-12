import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");

function patch(file, fn) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, "utf8");
  s = fn(s);
  fs.writeFileSync(p, s);
  console.log("patched", file);
}

patch("lib/email/inbound-processor.ts", (s) => {
  if (!s.includes("conversa-canal")) {
    s = s.replace(
      'import { gerarCodigoPessoa } from "@/lib/crm/pessoa-cadastro";',
      'import { gerarCodigoPessoa } from "@/lib/crm/pessoa-cadastro";\nimport {\n  ensureConversaAtiva,\n  gravarParMensagensConversa,\n} from "@/lib/crm/conversa-canal";'
    );
  }
  s = s.replace('origem: "outro",', 'origem: "email",');
  const old = `  if (!send.ok) {
    return { ok: false, error: send.error, status: send.status || 502 };
  }

  if (dedupeId) {`;
  const neu = `  if (!send.ok) {
    return { ok: false, error: send.error, status: send.status || 502 };
  }

  const conversaId = await ensureConversaAtiva(supabase, {
    leadId: lead.id as string,
    canal: "email",
    tenantId,
    pessoaId: (lead.pessoa_id as string | null) ?? null,
    preview: resultado.resposta,
  });

  if (conversaId) {
    await gravarParMensagensConversa(supabase, {
      conversaId,
      leadId: lead.id as string,
      tenantId,
      canal: "email",
      entrada: {
        conteudo: inbound.text,
        emailSubject: inbound.subject,
        emailMessageId: inbound.messageId,
        metadados: { from: inbound.fromEmail, resend_email_id: inbound.resendEmailId },
      },
      saida: {
        conteudo: resultado.resposta,
        remetente: "ia",
        agenteId: agenteSlug,
        emailSubject: replySubject,
        emailMessageId: send.id ?? null,
        emailInReplyTo: inbound.messageId,
        emailStatus: "enviado",
        metadados: { resend_id: send.id ?? null },
      },
    });
  }

  if (dedupeId) {`;
  if (!s.includes(old)) throw new Error("inbound-processor marker missing");
  return s.replace(old, neu);
});

console.log("done");
