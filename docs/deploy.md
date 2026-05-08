# 部署指南

飞书 + Telegram 接入 NullClaw，通过 Cloudflare Worker 中转触发 GitHub Actions。

## 架构

```
飞书/Telegram 发消息 → Cloudflare Worker → GitHub Actions (NullClaw + Skill) → Worker → 飞书/Telegram 回复
```

## 前置条件

- GitHub 账号
- Cloudflare 账号（免费）
- 能上 Telegram（发消息用）
- Node.js 环境（部署 Worker 用，本机 WSL 即可）

---

## 第一步：推代码到 GitHub

```bash
cd /home/administrator/workspace/nullclaw-ci
git init
git add .
git commit -m "init: nullclaw-ci with feishu + telegram"
```

在 GitHub 上创建新仓库（建议命名 `nullclaw-ci`），然后：

```bash
git remote add origin https://github.com/你的用户名/nullclaw-ci.git
git branch -M main
git push -u origin main
```

---

## 第二步：配置 GitHub 仓库 Secrets

进入仓库页面 → Settings → Secrets and variables → Actions → New repository secret

添加以下 Secrets：

| Name | Value |
|------|-------|
| `NULLCLAW_API_KEY` | `your-api-key` |
| `NULLCLAW_BASE_URL` | `https://token-plan-sgp.xiaomimimo.com/v1` |
| `CALLBACK_SECRET` | 自己编一个随机字符串，例如 `nc-cb-2026-ouraihub`（记住它，第五步要用） |

添加 Variable（同页面切换到 Variables 标签）：

| Name | Value |
|------|-------|
| `NULLCLAW_MODEL` | `mimo-v2.5-pro` |

---

## 第三步：创建 GitHub Personal Access Token

1. 打开 https://github.com/settings/tokens?type=beta
2. 点击 "Generate new token"
3. 填写：
   - Token name: `nullclaw-ci-worker`
   - Expiration: 90 days（或更长）
   - Repository access: Only select repositories → 选择 `nullclaw-ci`
   - Permissions:
     - Actions: **Read and write**
     - Contents: **Read and write**
4. 点击 Generate token
5. **立即复制 token**（只显示一次）

---

## 第四步：安装 Wrangler CLI

```bash
npm install -g wrangler
```

如果没有 npm：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g wrangler
```

---

## 第五步：部署 Cloudflare Worker

### 5.1 登录 Cloudflare

```bash
wrangler login
```

浏览器会打开授权页面，点击 Allow。

### 5.2 修改配置

编辑 `worker/wrangler.toml`，把两个变量改成你的实际值：

```toml
[vars]
WORKER_URL = "https://bot.ouraihub.com"
GITHUB_REPO = "你的GitHub用户名/nullclaw-ci"
```

### 5.3 配置 Secrets

```bash
cd /home/administrator/workspace/nullclaw-ci/worker
```

逐个输入（每条命令会提示你输入值）：

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
```
输入：`your-telegram-bot-token`

```bash
wrangler secret put FEISHU_APP_ID
```
输入：`your-feishu-app-id`

```bash
wrangler secret put FEISHU_APP_SECRET
```
输入：`your-feishu-app-secret`

```bash
wrangler secret put FEISHU_VERIFICATION_TOKEN
```
输入：去飞书开放平台 → 你的应用 → 事件与回调 → 页面上的 Verification Token

```bash
wrangler secret put GITHUB_TOKEN
```
输入：第三步生成的 GitHub PAT

```bash
wrangler secret put CALLBACK_SECRET
```
输入：第二步填的那个随机字符串（如 `nc-cb-2026-ouraihub`）

### 5.4 部署

```bash
wrangler deploy
```

部署成功后会显示 Worker URL，类似：
```
https://feishu-nullclaw.你的子域名.workers.dev
```

---

## 第六步：绑定自定义域名（推荐）

1. 打开 https://dash.cloudflare.com → Workers & Pages
2. 点击 `feishu-nullclaw` Worker
3. Settings → Triggers → Custom Domains → Add Custom Domain
4. 输入：`bot.ouraihub.com`
5. Cloudflare 自动创建 DNS 记录，等待生效（通常 1-2 分钟）

绑定后 Worker 地址变为：`https://bot.ouraihub.com`

---

## 第七步：注册 Telegram Webhook

浏览器打开：

```
https://bot.ouraihub.com/setup
```

看到类似以下内容就成功了：

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

---

## 第八步：配置飞书事件回调

1. 打开 https://open.feishu.cn/app → 你的应用
2. 事件与回调 → 事件订阅
3. 请求地址填写：`https://bot.ouraihub.com/feishu/event`
4. 点击保存（飞书会发验证请求，Worker 自动响应）
5. 添加事件：`im.message.receive_v1`（接收消息）
6. 确认应用已发布上线

---

## 第九步：测试

### 测试 Telegram

在 Telegram 里找到你的 bot，发送：

```
https://mp.weixin.qq.com/s/Ul7svdPOs4x-XNJTkYaGCQ
```

预期：
1. 立即收到「收到，正在处理... ⏳」
2. 1-2 分钟后收到抓取的 Markdown 内容

### 测试改写

```
改写 鲁迅 https://mp.weixin.qq.com/s/Ul7svdPOs4x-XNJTkYaGCQ
```

### 测试飞书

同样的消息发给飞书机器人，效果一样。

---

## 支持的指令

| 指令 | 说明 | 示例 |
|------|------|------|
| 直接发 URL | 抓取为 Markdown | `https://mp.weixin.qq.com/s/xxx` |
| `改写 风格 URL` | 抓取并改写 | `改写 鲁迅 https://mp.weixin.qq.com/s/xxx` |
| `改写 风格 文件路径` | 改写已有文章 | `改写 马三立 articles/xxx.md` |
| `skill:名称 消息` | 执行任意 skill | `skill:markdown-proxy https://example.com` |

支持的风格：`鲁迅` / `马三立` / `徐志摩`

---

## 故障排查

### Bot 没有回复「收到」

- 检查 Worker 是否部署成功：浏览器访问 `https://bot.ouraihub.com` 应返回 "OK"
- Telegram：访问 `https://bot.ouraihub.com/setup` 确认 webhook 注册成功
- 飞书：确认事件订阅地址正确且验证通过

### 收到「收到」但没有后续结果

- 去 GitHub 仓库 → Actions 页面查看是否有 workflow 运行
- 如果没有触发：检查 `GITHUB_TOKEN` 权限和 `GITHUB_REPO` 值
- 如果触发了但失败：查看 Actions 日志

### 回调失败（有 Actions 日志但飞书/Telegram 没收到结果）

- 确认 GitHub Secret `CALLBACK_SECRET` 和 Worker Secret `CALLBACK_SECRET` 值一致
- 确认 `WORKER_URL` 配置正确

### Actions 中 NullClaw 执行失败

- 检查 `NULLCLAW_API_KEY` 和 `NULLCLAW_BASE_URL` 是否正确
- 查看 Actions 日志中的具体错误

---

## 费用

| 组件 | 费用 |
|------|------|
| Cloudflare Worker | 免费（每天 10 万次请求） |
| GitHub Actions | 免费（公开仓库无限制，私有仓库每月 2000 分钟） |
| 飞书机器人 | 免费 |
| Telegram Bot | 免费 |
| 小米 MiMo API | 按 token 计费 |
