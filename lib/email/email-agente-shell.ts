import { APP_NAME_TITLE, BRAND_GREEN, BRAND_MARK_BG, COMPANY_NAME } from "@/lib/brand";
import type { ArtefatoBranding } from "@/lib/hub/superagente/artefato-branding";
import { markdownLeveParaHtmlEmail, markdownLeveParaTextoPlano } from "@/lib/email/email-markdown";

export type EmailAgenteFormatado = {
  html: string;
  text: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assinaturaTexto(b: ArtefatoBranding): string {
  const cargo = [b.cargo, b.area].filter(Boolean).join(" · ");
  const linhas = [
    "",
    "—",
    b.agenteNome,
    cargo || "Assistente de IA",
    `${APP_NAME_TITLE} · ${b.plataformaNome}`,
    COMPANY_NAME,
  ];
  return linhas.join("\n");
}

/**
 * Envolve o corpo do agente (texto/markdown) no mesmo padrão visual dos relatórios:
 * marca Waje, layout responsivo e assinatura do funcionário IA.
 */
export function formatarCorpoEmailAgente(
  corpo: string,
  branding: ArtefatoBranding
): EmailAgenteFormatado {
  const corpoLimpo = (corpo || "").trim();
  const corpoHtml = markdownLeveParaHtmlEmail(corpoLimpo);
  const nome = escapeHtml(branding.agenteNome);
  const cargoLinha = [branding.cargo, branding.area].filter(Boolean).join(" · ");
  const cargo = escapeHtml(cargoLinha || "Assistente de IA");
  const avatar = escapeHtml(branding.avatarUrl);
  const plat = escapeHtml(branding.plataformaNome);

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>${nome}</title>
</head>
<body style="margin:0;padding:0;background:#f8fcf6;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fcf6;">
<tr><td align="center" style="padding:16px 12px 32px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dcebd8;border-radius:14px;overflow:hidden;">
<tr><td style="padding:16px 20px;border-bottom:1px solid #dcebd8;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="vertical-align:middle;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="width:40px;height:40px;border-radius:10px;background:${BRAND_MARK_BG};border:1px solid ${BRAND_GREEN};text-align:center;vertical-align:middle;font-weight:800;font-size:11px;color:${BRAND_GREEN};letter-spacing:.04em;">IA</td>
<td style="padding-left:10px;vertical-align:middle;">
<div style="font-weight:800;font-size:15px;color:#0b2210;line-height:1.2;">${APP_NAME_TITLE}</div>
<div style="font-size:10px;color:#5d7a67;letter-spacing:.06em;text-transform:uppercase;margin-top:2px;">${plat}</div>
</td>
</tr>
</table>
</td>
<td align="right" style="vertical-align:middle;">
<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;border-radius:999px;border:1px solid #b8d4bc;color:#2d4a35;background:#eef7eb;">Assistente IA</span>
</td>
</tr>
</table>
</td></tr>
<tr><td style="padding:20px 20px 8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
${corpoHtml}
</td></tr>
<tr><td style="padding:8px 20px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #dcebd8;">
<tr><td style="padding-top:16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="vertical-align:top;padding-right:12px;">
<img src="${avatar}" alt="" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:50%;border:2px solid #b8d4bc;object-fit:cover;" />
</td>
<td style="vertical-align:top;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
<div style="font-weight:800;font-size:14px;color:#0b2210;">${nome}</div>
<div style="font-size:12px;color:#2d4a35;margin-top:2px;">${cargo}</div>
<div style="font-size:11px;color:#5d7a67;margin-top:6px;">Enviado automaticamente por ${APP_NAME_TITLE} · ${COMPANY_NAME}</div>
</td>
</tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `${markdownLeveParaTextoPlano(corpoLimpo)}${assinaturaTexto(branding)}`;

  return { html, text };
}
