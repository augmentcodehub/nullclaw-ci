// Cloudflare Worker: 飞书 + Telegram → GitHub Actions → 回传
// 环境变量:
//   FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_VERIFICATION_TOKEN
//   TELEGRAM_BOT_TOKEN
//   GITHUB_TOKEN / GITHUB_REPO
//   CALLBACK_SECRET

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/feishu/event" && request.method === "POST") {
      return handleFeishuEvent(request, env);
    }
    if (path === "/telegram/webhook" && request.method === "POST") {
      return handleTelegramWebhook(request, env);
    }
    if (path === "/callback" && request.method === "POST") {
      return handleCallback(request, env);
    }
    if (path === "/setup" && request.method === "GET") {
      // 一键设置 Telegram webhook
      const webhookUrl = `${url.origin}/telegram/webhook`;
      const resp = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
      );
      return new Response(await resp.text(), { headers: { "Content-Type": "application/json" } });
    }
    return new Response("OK");
  },
};

// ========== 指令解析（通用） ==========

function parseCommand(text) {
  if (!text) return null;
  text = text.replace(/^\/start\s*/, "").trim();
  if (!text) return null;

  // 帮助指令
  if (/^(?:帮助|help|指令|命令|\?)$/i.test(text)) {
    return { action: "help" };
  }

  // 摄入: "摄入 URL" 或 "ingest URL"
  const ingestMatch = text.match(/^(?:摄入|ingest)\s+(https?:\/\/\S+)$/i);
  if (ingestMatch) {
    return { action: "ingest", target: ingestMatch[1] };
  }

  // 查询: "查询 xxx" 或 "query xxx"
  const queryMatch = text.match(/^(?:查询|query)\s+(.+)$/i);
  if (queryMatch) {
    return { action: "query", target: queryMatch[1] };
  }

  // 蒸馏: "蒸馏 xxx" 或 "distill xxx"
  const distillMatch = text.match(/^(?:蒸馏|distill)\s+(.+)$/i);
  if (distillMatch) {
    return { action: "distill", target: distillMatch[1] };
  }

  // 发布: "发布 文件路径" 或 "publish xxx"
  const publishMatch = text.match(/^(?:发布|publish)\s+(.+)$/i);
  if (publishMatch) {
    return { action: "publish", target: publishMatch[1].trim() };
  }

  // 健康检查: "健康检查" 或 "lint"
  if (/^(?:健康检查|lint)$/i.test(text)) {
    return { action: "lint", target: "full" };
  }

  // 待发布: "待发布" 或 "pending"
  if (/^(?:待发布|pending)$/i.test(text)) {
    return { action: "pending", target: "list" };
  }

  // 改写: "改写 鲁迅 https://..." 或 "rewrite lu-xun https://..."
  const rewriteMatch = text.match(/^(?:改写|rewrite)\s+(鲁迅|马三立|徐志摩|lu-xun|ma-sanli|xu-zhimo)\s+(.+)$/i);
  if (rewriteMatch) {
    const styleMap = { "鲁迅": "lu-xun", "马三立": "ma-sanli", "徐志摩": "xu-zhimo" };
    return { action: "rewrite", style: styleMap[rewriteMatch[1]] || rewriteMatch[1], target: rewriteMatch[2].trim() };
  }

  // URL 抓取
  const urlMatch = text.match(/(https?:\/\/\S+)/i);
  if (urlMatch) {
    return { action: "fetch", target: urlMatch[1] };
  }

  // 通用 skill: "skill:xxx 消息"
  const skillMatch = text.match(/^skill:(\S+)\s+(.+)$/i);
  if (skillMatch) {
    return { action: "skill", skill: skillMatch[1], target: skillMatch[2] };
  }

  return null;
}

const HELP_TEXT = `支持的指令：
• 发 URL → 抓取为 Markdown
• 摄入 <URL> → 抓取并存入知识库
• 查询 <问题> → 基于知识库回答
• 改写 鲁迅/马三立/徐志摩 <URL> → 风格改写+自动发布
• 待发布 → 查看未上传的文件
• 发布 <文件路径> → 手动发布到墨问
• 蒸馏 <人名> → 生成人物思维 Skill
• 健康检查 → 检查知识库一致性
• skill:名称 <消息> → 执行任意 skill`;

// ========== 触发 GitHub Actions ==========

async function triggerWorkflow(env, command, channel, chatId) {
  const resp = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/feishu-task.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "nullclaw-worker",
    },
    body: JSON.stringify({
      ref: "main",
      inputs: {
        action: command.action,
        target: command.target,
        style: command.style || "",
        skill: command.skill || "",
        chat_id: `${channel}:${chatId}`,
        callback_url: env.WORKER_URL + "/callback",
      },
    }),
  });
  return resp.ok;
}

// ========== 回调处理 ==========

async function handleCallback(request, env) {
  const body = await request.json();
  if (body.secret !== env.CALLBACK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { chat_id, status, result } = body;
  const [channel, id] = chat_id.split(":", 2);
  const text = status === "success"
    ? `✅ 完成\n\n${result.substring(0, 4000)}`
    : `❌ 失败\n\n${result}`;

  if (channel === "telegram") {
    await sendTelegram(env, id, text);
  } else if (channel === "feishu") {
    await sendFeishu(env, id, text);
  }
  return new Response("OK");
}

// ========== Telegram ==========

async function handleTelegramWebhook(request, env) {
  const body = await request.json();
  const message = body.message;
  if (!message || !message.text) return new Response("OK");

  const chatId = message.chat.id;
  const text = message.text.trim();
  const command = parseCommand(text);

  if (!command || command.action === "help") {
    await sendTelegram(env, chatId, HELP_TEXT);
    return new Response("OK");
  }

  await sendTelegram(env, chatId, `收到，正在处理... ⏳\n${command.action}: ${command.target}`);
  await triggerWorkflow(env, command, "telegram", chatId);
  return new Response("OK");
}

async function sendTelegram(env, chatId, text) {
  // Telegram 消息限制 4096 字符
  const chunks = [];
  for (let i = 0; i < text.length; i += 4096) {
    chunks.push(text.substring(i, i + 4096));
  }
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
  }
}

// ========== 飞书 ==========

async function handleFeishuEvent(request, env) {
  const body = await request.json();

  if (body.type === "url_verification") {
    return Response.json({ challenge: body.challenge });
  }

  const header = body.header;
  if (!header || header.token !== env.FEISHU_VERIFICATION_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 飞书事件去重：同一个 event_id 只处理一次
  const eventId = header.event_id;
  if (eventId) {
    const cacheKey = `feishu_event:${eventId}`;
    const cached = await caches.default.match(new Request(`https://dedup/${cacheKey}`));
    if (cached) return new Response("OK");
    // 标记已处理（缓存 5 分钟）
    const dedup = new Response("1", { headers: { "Cache-Control": "max-age=300" } });
    await caches.default.put(new Request(`https://dedup/${cacheKey}`), dedup);
  }

  if (header.event_type !== "im.message.receive_v1") {
    return new Response("OK");
  }

  const event = body.event;
  const message = event.message;
  if (message.message_type !== "text") return new Response("OK");

  const content = JSON.parse(message.content);
  const text = content.text.trim();
  const chatId = message.chat_id;
  const command = parseCommand(text);

  if (!command || command.action === "help") {
    await sendFeishu(env, chatId, HELP_TEXT);
    return new Response("OK");
  }

  await sendFeishu(env, chatId, `收到，正在处理... ⏳\n${command.action}: ${command.target}`);
  await triggerWorkflow(env, command, "feishu", chatId);
  return new Response("OK");
}

async function sendFeishu(env, chatId, text) {
  const tokenResp = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
  });
  const { tenant_access_token } = await tokenResp.json();

  await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", {
    method: "POST",
    headers: { Authorization: `Bearer ${tenant_access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ receive_id: chatId, msg_type: "text", content: JSON.stringify({ text }) }),
  });
}
