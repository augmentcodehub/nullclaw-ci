import { log } from "./log.js";

/**
 * @typedef {{ action: string, target?: string, style?: string, skill?: string }} Command
 * @typedef {{ ok: boolean, error: string|null }} TriggerResult
 */

/**
 * 触发 GitHub Actions workflow
 * @param {object} env - Worker 环境变量
 * @param {Command} command - 解析后的指令
 * @param {string} channel - telegram|feishu|wecom
 * @param {string} chatId - 用户标识
 * @returns {Promise<TriggerResult>}
 */
export async function triggerWorkflow(env, command, channel, chatId) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/feishu-task.yml/dispatches`;
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "msgflow-worker",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          action: command.action,
          target: command.target || "",
          style: command.style || "",
          skill: command.skill || "",
          chat_id: `${channel}:${chatId}`,
          callback_url: env.WORKER_URL + "/callback",
        },
      }),
    });
  } catch (e) {
    log.error("triggerWorkflow fetch failed", { error: e.message, action: command.action });
    return { ok: false, error: `网络错误: ${e.message}` };
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    log.error("triggerWorkflow API error", { status: resp.status, action: command.action, body: text.substring(0, 200) });
    return { ok: false, error: `GitHub API ${resp.status}: ${text.substring(0, 200)}` };
  }
  return { ok: true, error: null };
}
