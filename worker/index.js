import { handleTelegram, sendTelegram } from "./handlers/telegram.js";
import { handleFeishu, sendFeishu } from "./handlers/feishu.js";
import { handleWecom, handleWecomVerify, sendWecom } from "./handlers/wecom.js";
import { log } from "./lib/log.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Telegram
      if (path === "/telegram/webhook" && request.method === "POST") {
        return await handleTelegram(request, env);
      }
      // 飞书
      if (path === "/feishu/event" && request.method === "POST") {
        return await handleFeishu(request, env);
      }
      // 企业微信
      if (path === "/wecom/callback" && request.method === "GET") {
        return await handleWecomVerify(request, env);
      }
      if (path === "/wecom/callback" && request.method === "POST") {
        return await handleWecom(request, env);
      }
      // GitHub Actions 回调
      if (path === "/callback" && request.method === "POST") {
        return await handleCallback(request, env);
      }
      // Telegram webhook 一键设置（需要 ?token=CALLBACK_SECRET）
      if (path === "/setup" && request.method === "GET") {
        if (url.searchParams.get("token") !== env.CALLBACK_SECRET) {
          return new Response("Forbidden", { status: 403 });
        }
        const webhookUrl = `${url.origin}/telegram/webhook`;
        const resp = await fetch(
          `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
        );
        return new Response(await resp.text(), { headers: { "Content-Type": "application/json" } });
      }
      return new Response("OK");
    } catch (e) {
      log.error("unhandled error", { path: url.pathname, error: e.message });
      return new Response("Internal Error", { status: 500 });
    }
  },
};

// 回调处理（Actions 完成后回传结果）
async function handleCallback(request, env) {
  const body = await request.json();
  if (body.secret !== env.CALLBACK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { chat_id, status, result } = body;
  const [channel, ...rest] = chat_id.split(":");
  const id = rest.join(":");
  const msg = result || "";
  const text = status === "success"
    ? `✅ 完成\n\n${msg.substring(0, 4000)}`
    : `❌ 失败\n\n${msg}`;

  if (channel === "telegram") {
    await sendTelegram(env, id, text);
  } else if (channel === "feishu") {
    await sendFeishu(env, id, text);
  } else if (channel === "wecom") {
    const [userId, agentId] = id.split("|");
    await sendWecom(env, userId, agentId, text);
  }
  return new Response("OK");
}
