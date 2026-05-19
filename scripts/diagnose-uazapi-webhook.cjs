/**
 * Diagnóstico UAZAPI ↔ Render webhook (não imprime tokens completos).
 * Uso: node scripts/diagnose-uazapi-webhook.cjs
 *      npm run diagnose:uazapi
 *
 * TLS: em Windows com antivírus/proxy SSL, Node pode falhar com
 * `UNABLE_TO_VERIFY_LEAF_SIGNATURE` — o script relaxa TLS como `npm run dev`.
 * Verificação estrita: STRICT_TLS=1 node scripts/diagnose-uazapi-webhook.cjs
 */
if (!process.env.STRICT_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn(
    "[diagnose-uazapi] NODE_TLS_REJECT_UNAUTHORIZED=0 (só este processo). Use STRICT_TLS=1 para TLS estrito.\n"
  );
}

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function parseEnvFile(filePath) {
  const o = {};
  if (!fs.existsSync(filePath)) return o;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    o[k] = v;
  }
  return o;
}

function loadEnv(root) {
  return {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, ".env.local")),
  };
}

function maskUrl(url) {
  if (!url || typeof url !== "string") return String(url);
  try {
    const u = new URL(url);
    const wh = u.searchParams.get("wh");
    if (wh) u.searchParams.set("wh", wh.slice(0, 4) + "…");
    return u.toString();
  } catch {
    return url.slice(0, 80) + "…";
  }
}

function uazapiBase(env) {
  let b = (env.UAZAPI_BASE_URL || "").trim().replace(/\/+$/, "");
  b = b.replace(/\/api\/?$/, "");
  return b || null;
}

async function uazapiGet(base, pathname, headers) {
  const url = `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const r = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 500);
  }
  return { status: r.status, ok: r.ok, data };
}

async function main() {
  const root = path.join(__dirname, "..");
  const env = loadEnv(root);
  const base = uazapiBase(env);
  const admin = env.UAZAPI_ADMIN_TOKEN?.trim();
  const appUrl = (env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  const wh = env.WEBHOOK_SECRET?.trim();
  const expectedWebhook = wh
    ? `${appUrl}/api/whatsapp/webhook?wh=${encodeURIComponent(wh)}`
    : `${appUrl}/api/whatsapp/webhook`;

  console.log("\n=== Diagnóstico UAZAPI → Webhook Render ===\n");
  console.log("UAZAPI_BASE_URL:", base || "(ausente)");
  console.log("NEXT_PUBLIC_APP_URL:", appUrl || "(ausente)");
  console.log("WEBHOOK_SECRET:", wh ? `${wh.slice(0, 4)}… (${wh.length} chars)` : "(ausente)");
  console.log("URL esperada (sync app):", maskUrl(expectedWebhook));
  console.log("");

  if (!base || !admin) {
    console.log("[!!] Defina UAZAPI_BASE_URL e UAZAPI_ADMIN_TOKEN no .env");
    process.exit(1);
  }

  // Maria no Supabase
  let instanceId = "";
  let instanceToken = "";
  let waStatus = "";
  let modo = "";
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await sb
      .from("hub_agente_identidade")
      .select("agente_slug,uazapi_instance_id,uazapi_connection_status,modo_operacao,uazapi_instance_name")
      .eq("agente_slug", "maria")
      .maybeSingle();
    if (error) {
      console.log("[--] Supabase maria:", error.message.slice(0, 120));
    } else if (data) {
      instanceId = data.uazapi_instance_id || "";
      instanceToken = ""; // fetch token separately if column exists - might be sensitive
      waStatus = data.uazapi_connection_status || "";
      modo = data.modo_operacao || "";
      console.log("[OK] Agente maria (Supabase)");
      console.log("     instância:", instanceId || "(vazio)");
      console.log("     nome:", data.uazapi_instance_name || "—");
      console.log("     conexão:", waStatus || "—");
      console.log("     modo:", modo || "—");
    }
    const { data: row2 } = await sb
      .from("hub_agente_identidade")
      .select("uazapi_instance_token")
      .eq("agente_slug", "maria")
      .maybeSingle();
    if (row2?.uazapi_instance_token) {
      instanceToken = String(row2.uazapi_instance_token).trim();
      console.log("     token instância:", instanceToken ? `${instanceToken.slice(0, 8)}…` : "(vazio)");
    }
  } else {
    console.log("[--] Supabase não configurado no .env");
  }
  console.log("");

  // Global webhook
  console.log("--- Webhook GLOBAL (UAZAPI) ---");
  const g = await uazapiGet(base, "/globalwebhook", { admintoken: admin });
  console.log(g.ok ? "[OK]" : "[--]", `GET /globalwebhook → HTTP ${g.status}`);
  if (g.ok && g.data) {
    const cfg = Array.isArray(g.data) ? g.data[0] : g.data;
    if (cfg && typeof cfg === "object") {
      console.log("     enabled:", cfg.enabled);
      console.log("     url:", maskUrl(cfg.url));
      console.log("     events:", JSON.stringify(cfg.events));
      console.log("     excludeMessages:", JSON.stringify(cfg.excludeMessages));
      const cfgUrl = String(cfg.url || "");
      if (cfgUrl && !cfgUrl.includes("escritorio-virtual-9c2o.onrender.com")) {
        console.log("     [!!] URL global NÃO aponta para Render!");
      }
      if (cfgUrl && wh && !cfgUrl.includes("wh=")) {
        console.log("     [!!] URL global sem ?wh= (auth pode falhar se UAZAPI não enviar header)");
      }
      if (expectedWebhook && cfgUrl.split("?")[0] === expectedWebhook.split("?")[0] && wh) {
        const u = new URL(cfgUrl);
        const cfgWh = u.searchParams.get("wh");
        if (cfgWh !== wh) {
          console.log("     [!!] ?wh= na UAZAPI ≠ WEBHOOK_SECRET do .env/Render");
        }
      }
    } else {
      console.log("     payload:", JSON.stringify(g.data).slice(0, 400));
    }
  } else {
    console.log("     erro:", typeof g.data === "string" ? g.data : JSON.stringify(g.data).slice(0, 200));
  }

  console.log("\n--- Erros entrega webhook GLOBAL ---");
  const err = await uazapiGet(base, "/globalwebhook/errors", { admintoken: admin });
  console.log(err.ok ? "[OK]" : "[--]", `GET /globalwebhook/errors → HTTP ${err.status}`);
  if (err.ok) {
    const list = Array.isArray(err.data) ? err.data : err.data?.errors || err.data?.data || [];
    if (!list || (Array.isArray(list) && list.length === 0)) {
      console.log("     (nenhum erro recente em memória — ou lista vazia)");
    } else {
      const slice = Array.isArray(list) ? list.slice(0, 5) : [list];
      for (const e of slice) {
        console.log("    •", JSON.stringify(e).slice(0, 280));
      }
    }
  } else {
    console.log("     ", JSON.stringify(err.data).slice(0, 300));
  }

  if (instanceToken) {
    console.log("\n--- Webhook INSTÂNCIA (token Maria) ---");
    const iw = await uazapiGet(base, "/webhook", { token: instanceToken });
    console.log(iw.ok ? "[OK]" : "[--]", `GET /webhook → HTTP ${iw.status}`);
    const list = Array.isArray(iw.data) ? iw.data : iw.data ? [iw.data] : [];
    for (const cfg of list.slice(0, 2)) {
      if (cfg && typeof cfg === "object") {
        console.log("     • enabled:", cfg.enabled, "| url:", maskUrl(cfg.url));
        console.log("       events:", JSON.stringify(cfg.events), "| exclude:", JSON.stringify(cfg.excludeMessages));
      }
    }

    console.log("\n--- Status instância ---");
    const st = await fetch(`${base}/instance/status`, {
      headers: { Accept: "application/json", token: instanceToken },
    });
    const stData = await st.json().catch(() => ({}));
    console.log(st.ok ? "[OK]" : "[--]", `GET /instance/status → HTTP ${st.status}`);
    const inst = stData?.instance || stData;
    const state =
      inst?.state || inst?.status || inst?.connectionStatus || stData?.status || "—";
    const phone =
      inst?.phone || inst?.owner || inst?.wid || stData?.phone || stData?.owner || "—";
    console.log("     state/status:", state);
    console.log("     número/conta:", typeof phone === "string" ? phone : JSON.stringify(phone).slice(0, 60));
    if (String(state).toLowerCase() !== "connected" && String(state).toLowerCase() !== "open") {
      console.log("     [!!] Instância pode não estar recebendo eventos de mensagem");
    }

    console.log("\n--- Limites WhatsApp (novas conversas) ---");
    const lim = await fetch(`${base}/instance/wa_messages_limits`, {
      headers: { Accept: "application/json", token: instanceToken },
    });
    const limData = await lim.json().catch(() => ({}));
    console.log(lim.ok ? "[OK]" : "[--]", `GET /instance/wa_messages_limits → HTTP ${lim.status}`);
    if (lim.ok && limData) {
      console.log("     can_send_new_messages:", limData.can_send_new_messages);
      console.log("     message_ptbr:", limData.message_ptbr || limData.message || "—");
    }

    console.log("\n--- Chats recentes (UAZAPI recebe mensagens?) ---");
    const chats = await fetch(`${base}/chat/find`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        token: instanceToken,
      },
      body: JSON.stringify({
        operator: "AND",
        sort: "-wa_lastMsgTimestamp",
        limit: 5,
        offset: 0,
        wa_isGroup: false,
      }),
    });
    const chatsData = await chats.json().catch(() => ({}));
    console.log(chats.ok ? "[OK]" : "[--]", `POST /chat/find → HTTP ${chats.status}`);
    const chatList = chatsData?.chats || chatsData?.data || chatsData?.results || [];
    if (Array.isArray(chatList) && chatList.length > 0) {
      for (const c of chatList.slice(0, 5)) {
        const name = c.wa_contactName || c.wa_name || c.name || "—";
        const chatid = c.wa_chatid || c.chatid || "—";
        const last = c.wa_lastMsgTimestamp || c.lastMsgTimestamp || c.timestamp;
        const lastTxt = (c.wa_lastMessageTextVote || c.lastMessage || "").toString().slice(0, 40);
        const fromMe = c.wa_lastMessageSender === "me" || c.fromMe === true;
        console.log(`     • ${name} | ${chatid}`);
        console.log(`       última: ${last || "—"} | fromMe: ${fromMe} | "${lastTxt}"`);
      }
      console.log("     → Se vê chat recente mas Render não recebe POST, falha é só no disparo do webhook UAZAPI.");
    } else {
      console.log("     (nenhum chat 1:1 recente — confirme que enviou msg para o número da instância acima)");
    }
  }

  console.log("\n--- Teste POST Render (resolver de instância) ---");
  if (appUrl && wh) {
    const url = `${appUrl}/api/whatsapp/webhook?wh=${encodeURIComponent(wh)}`;
    const msgBase = {
      EventType: "messages",
      chatid: "5511999990000@s.whatsapp.net",
      sender: "5511999990000@s.whatsapp.net",
      messageid: `diag-${Date.now()}`,
      messageTimestamp: Date.now(),
      messageType: "conversation",
      text: "diag resolver",
    };
    async function probe(label, extra) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...msgBase, ...extra }),
        });
        const j = await r.json().catch(() => ({}));
        const okMaria = j.agente === "maria" || j.status === "ok";
        console.log(
          okMaria ? "[OK]" : "[!!]",
          label,
          "→ HTTP",
          r.status,
          j.reason || j.status || j.error || JSON.stringify(j).slice(0, 80)
        );
        return j;
      } catch (e) {
        console.log("[--]", label, "falhou:", e.message);
        return null;
      }
    }
    const semId = await probe("sem instance/token (como webhook global UAZAPI)", {});
    const comToken = instanceToken
      ? await probe("só token no body", { token: instanceToken })
      : null;
    const comId = instanceId ? await probe("com instance id", { instance: instanceId }) : null;

    if (semId?.reason === "instancia_desconhecida_sem_fallback_global") {
      console.log(
        "     [!!] Render ainda sem resolver novo (token / único agente connected)."
      );
      console.log("     → Faça deploy do código atual ou defina UAZAPI_INSTANCE_TOKEN no Render.");
    }
    if (comToken?.reason === "instancia_desconhecida_sem_fallback_global") {
      console.log("     [!!] Render ignora token no body — precisa deploy.");
    }
    if (comId?.agente === "maria" || comId?.status === "ok") {
      console.log("     [OK] Com `instance` no JSON o Render já roteia para Maria.");
    }
  }

  console.log("\n=== Conclusão rápida ===");
  console.log("Se POST Render [OK] mas WhatsApp real não gera log wa.webhook.received:");
  console.log("  → UAZAPI não dispara webhook em mensagens reais (sessão, painel ou instância errada).");
  console.log("  → Reconecte QR, confira /globalwebhook/errors e envie msg de outro telefone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
