# NullClaw CI - 文章抓取与改写

基于 [NullClaw](https://github.com/nullclaw/nullclaw) 的 GitHub Actions 自动化项目。抓取公众号文章，用不同风格改写，支持任意 skill 执行任意任务。

## 为什么用 NullClaw 而不是 Codex CLI

| 对比 | Codex CLI | NullClaw |
|------|-----------|----------|
| 安装 | npm install（需 Node.js） | curl 下载 678KB 二进制 |
| 启动 | 数秒 | <2ms |
| 内存 | >100MB | ~1MB |
| 提供商 | 绑定 OpenAI | 50+ 提供商，任意自定义端点 |
| Skill 激活 | 隐式 | `--skill name` 显式指定 |

## 目录结构

```
.github/workflows/
├── fetch-weixin.yml          # 抓取公众号文章到 articles/
├── rewrite-article.yml       # 用 NullClaw + writer skill 改写文章
└── run-skill.yml             # 通用 skill 执行（支持任意 skill + 任意任务）

articles/                     # 原始抓取文章
rewritten/                    # 改写后的文章
output/                       # 通用 skill 执行输出

skills/
├── writers/
│   ├── lu-xun-writer/        # 鲁迅风格
│   ├── ma-sanli-writer/      # 马三立风格
│   └── xu-zhimo-writer/      # 徐志摩风格
└── markdown-proxy/           # URL 抓取为 Markdown（支持公众号、飞书、X 等）

tools/content-fetch/
└── fetch_weixin.py           # 公众号抓取脚本
```

## 使用方法

### 1. 抓取公众号文章

运行 **Fetch WeChat Article** workflow：

- 输入公众号文章 URL
- 自动抓取并保存到 `articles/` 目录

### 2. 改写文章

运行 **Rewrite Article** workflow：

- `source_file`: 待改写文件路径，如 `articles/xxx.md`
- `style`: 选择 `lu-xun` / `ma-sanli` / `xu-zhimo`

改写结果保存到 `rewritten/` 目录。

### 3. 通用 Skill 执行

运行 **Run Skill** workflow：

- `skill`: skill 名称（如 `markdown-proxy`、`lu-xun-writer`）
- `message`: 发给 agent 的指令（如 URL、改写要求等）

适用场景：
- 用 `markdown-proxy` 抓取任意 URL 为 Markdown
- 用任意 writer skill 改写指定内容
- 未来新增的 skill（浏览器搜索、数据分析等）

## Secrets 配置

在 GitHub 仓库 Settings → Secrets and variables → Actions 中配置：

| 名称 | 说明 | 示例 |
|------|------|------|
| `NULLCLAW_API_KEY` | AI 提供商 API Key | `tp-xxx` 或 `sk-xxx` |
| `NULLCLAW_BASE_URL` | OpenAI 兼容接口地址 | `https://token-plan-sgp.xiaomimimo.com/v1` |

可选 Variables：

| 名称 | 说明 | 默认值 |
|------|------|--------|
| `NULLCLAW_MODEL` | 使用的模型 | `mimo-v2.5-pro` |

### 推荐配置（小米 MiMo）

```
NULLCLAW_API_KEY = your-api-key
NULLCLAW_BASE_URL = https://token-plan-sgp.xiaomimimo.com/v1
NULLCLAW_MODEL = mimo-v2.5-pro
```

### 其他提供商示例

```
# OpenRouter
NULLCLAW_BASE_URL = https://openrouter.ai/api/v1
NULLCLAW_MODEL = anthropic/claude-sonnet-4

# 自定义中转
NULLCLAW_BASE_URL = https://api.sbbbbbbbbb.xyz/v1
NULLCLAW_MODEL = gpt-5.4
```

## 安全配置说明

NullClaw 默认安全策略较严格，会拦截 skill 中的 shell 命令（curl、python 等）和网络请求。对于需要执行外部命令或浏览器操作的 skill（如 `markdown-proxy`、未来的搜索类 skill），需要放宽安全策略。

### CI 环境中的安全配置（workflow 已内置）

workflow 中已自动配置以下安全策略，无需手动操作：

```bash
# 允许所有 shell 命令（CI 环境是隔离的，安全风险可控）
nullclaw config set autonomy.level autonomous
nullclaw config set autonomy.allowed_commands '["*"]'
nullclaw config set autonomy.workspace_only false
nullclaw config set security.sandbox.enabled false

# 允许 HTTP 请求（浏览器搜索、URL 抓取等场景需要）
nullclaw config set http_request.enabled true
nullclaw config set http_request.allowed_domains '["*"]'

# 启用浏览器工具（Playwright 场景）
nullclaw config set browser.enabled true
```

### 本地使用时的安全配置

本地使用时建议按需开放，不要全部放开：

```bash
# 方式一：只允许特定命令（推荐）
nullclaw config set autonomy.allowed_commands '["python3","curl","pip","playwright"]'

# 方式二：全部放开（仅在信任的环境中使用）
nullclaw config set autonomy.allowed_commands '["*"]'
nullclaw config set autonomy.level autonomous
nullclaw config set security.sandbox.enabled false
```

### Skill 安装注意事项

`nullclaw skills install` 有安全审计，包含 shell 命令的 skill 可能安装失败。解决方法：

```bash
# 方法一：手动复制到 skills 目录（推荐）
cp -r skills/markdown-proxy ~/.nullclaw/workspace/skills/markdown-proxy

# 方法二：在 CI 中直接复制（workflow 已内置）
cp -r skills/xxx ~/.nullclaw/workspace/skills/xxx
```

## 本地使用

```bash
# 安装 NullClaw
curl -sL -o /usr/local/bin/nullclaw \
  https://github.com/nullclaw/nullclaw/releases/download/v2026.5.4/nullclaw-linux-x86_64.bin
chmod +x /usr/local/bin/nullclaw

# 配置提供商
nullclaw onboard --api-key "你的key" --provider "custom:https://你的url/v1" --model "mimo-v2.5-pro"

# 放宽安全策略（按需）
nullclaw config set autonomy.allowed_commands '["*"]'
nullclaw config set security.sandbox.enabled false

# 安装 skill（手动复制方式）
cp -r skills/markdown-proxy ~/.nullclaw/workspace/skills/markdown-proxy

# 用 markdown-proxy 抓取文章
nullclaw agent --skill markdown-proxy -m "请抓取这个链接：https://mp.weixin.qq.com/s/xxx"

# 用鲁迅风格改写
cp -r skills/writers/lu-xun-writer ~/.nullclaw/workspace/skills/lu-xun-writer
nullclaw agent --skill lu-xun-writer -m "请用你的风格改写以下文章：$(cat articles/xxx.md)"
```

## 扩展新 Skill

将新 skill 放到 `skills/` 目录下，确保包含 `SKILL.md` 文件即可。workflow 会自动识别并加载。

适合扩展的场景：
- 浏览器搜索信息（需要 `browser.enabled: true`）
- 数据采集与分析
- 多语言翻译
- SEO 优化改写
- 更多写作风格
