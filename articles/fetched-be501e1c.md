---
title: "手把手：给 Hermes Agent 装一个六面板控制中心"
author: "AI赋能说"
date: "2026年5月6日 02:37"
url: "https://mp.weixin.qq.com/s/mqJO_Lrv9rZWMKVcb94XlQ"
---

# 手把手：给 Hermes Agent 装一个六面板控制中心

![图片](https://mmbiz.qpic.cn/mmbiz_png/B9Tu6L8wd2ZxVECdRFngU9PGqnxdVL5Z682Oot1WHACt4ICuOn2OhaBGSjuWicjicyeu3X0IgibZs5hAicdsrPdRoNa5OsbRQltg1Db9w6cPlJw/640?wx_fmt=png&from=appmsg&watermark=1#imgIndex=0)

# 这篇教你做一件事：给已有的 Hermes Agent 装上 Hermes Workspace[1]，让你在浏览器里看到代理的一切。

做完之后，你会有一个 Web 界面。六个面板：聊天、记忆、技能、终端、工具卡片、Conductor 编排。想玩多代理协作，还能开 Kanban。

原理拆解见上一篇。这篇只讲操作。

---

## 先看完成后的样子

![图片](https://mmbiz.qpic.cn/mmbiz_png/B9Tu6L8wd2YOicD00PoVTgKWqOiatibYjEvX3sfJibmzQQGSY6HbRNqB9IwPFHAcaLgq5Bjtia7O2xRwB3ANrVnT1kh2hTFnZhGC68CyDs3NIRA4/640?wx_fmt=png&from=appmsg&watermark=1#imgIndex=1)

两个进程。Agent gateway 跑在 8642 端口处理模型和记忆。Workspace 跑在 3000 端口提供界面。

---

## 前提条件

开始之前，确认你有这些：

* **Node.js ≥ 22** — 终端里跑 `node -v` 看版本
* **Python ≥ 3.11** — Hermes Agent 本体需要
* **pnpm** — 没有的话跑 `npm install -g pnpm`
* **Hermes Agent 已安装** — 跑 `hermes --version` 确认

如果你还没装 Hermes Agent，跳到最后的「从零开始」部分。

---

## 阶段一：克隆和安装

**第一步：克隆仓库**

```
git clone https://github.com/outsourc-e/hermes-workspace.git  
cd hermes-workspace
```

做完后，你应该在 `hermes-workspace` 目录里。跑 `ls` 能看到 `package.json`。

**第二步：安装依赖**

```
pnpm install
```

等它跑完。没有红色报错就是成功。

如果报 Node 版本不够，升级到 22 以上：

```
nvm install 22  
nvm use 22
```

**验证：**`ls node_modules` 能看到一堆文件夹。

---

## 阶段二：配置连接

**第三步：创建环境变量文件**

```
cp .env.example .env
```

**第四步：编辑 .env**

打开 `.env` 文件。核心是两个地址：

```
HERMES_API_URL=http://localhost:8642  
HERMES_DASHBOARD_URL=http://localhost:3000
```

Agent gateway 默认跑在 8642。Workspace 默认跑在 3000。

如果你的 Agent 跑在远程服务器上，把 `localhost` 换成服务器 IP。默认端口不用改。

**验证：**`cat .env | grep HERMES` 能看到你填的地址。

---

## 阶段三：启动

**第五步：启动 Agent Gateway**

```
hermes gateway run
```

这是后端。处理模型调用、记忆读写、技能执行。

**第六步：启动 Workspace**

新开一个终端窗口：

```
cd ~/hermes-workspace && pnpm dev
```

或者用一条命令同时启动两个：

```
pnpm start:all
```

浏览器打开 `http://localhost:3000`。

看到 Hermes Workspace 的界面，说明成功了。

**验证：** 界面左侧有聊天面板，能看到代理状态。显示「Connected」说明连接成功。

---

## 阶段四：验证核心功能

**第七步：测试多模型聊天**

在聊天面板里发一条消息。回复是流式的，一个字一个字出来。

试试切换模型。Claude、GPT、Gemini、本地模型，同一个对话里切换不丢上下文。

首次使用会提示 `hermes setup` 选择模型提供商。支持 Anthropic、OpenAI、OpenRouter、Ollama、vLLM、LM Studio。

**第八步：浏览记忆和技能**

点击「Memory」标签。代理的三层记忆系统一览无余。可以搜索、浏览、编辑。

点击「Skills」标签。100+ 技能在线管理。

点击工具卡片区域。实时看代理在调什么工具，能批准，能中止。

---

## 完整流程一览

![图片](https://mmbiz.qpic.cn/sz_mmbiz_png/B9Tu6L8wd2ZZu2la6FUcIzmox6qMj8BtrsbnKVOKI3kjPtoISA0oPQOuE5LperQeuOd0ibn7lozSJ4Nycpa5giayIexzNf7icrsBepOIXemTY8/640?wx_fmt=png&from=appmsg&watermark=1#imgIndex=2)

---

## 从零开始（没有 Hermes Agent 的情况）

如果你还没装 Hermes Agent，用官方一键脚本：

```
curl -fsSL https://hermes-workspace.com/install.sh | bash
```

这条命令会检测 Node 22+、Python 3.11+、pnpm。缺什么装什么。然后安装 `hermes-agent`，克隆 Workspace，配好 `.env`。可重复执行。

装完后：

```
hermes gateway run          # 终端 1，启动 gateway :8642  
cd ~/hermes-workspace && pnpm dev  # 终端 2，启动 UI :3000
```

首次运行会提示 `hermes setup` 选择模型提供商。

---

## 进阶：开启 Kanban 多代理协作

跑通基础功能之后，可以试多代理。

Workspace 里找到「Conductor」入口。这是任务编排器，能并行生成子代理，实时看工作网格。

更强大的是 Kanban。在终端里：

```
hermes kanban create --title "调研三个竞品" --assignee researcher
```

任务会出现在 Kanban 板上。Dispatcher 每 60 秒扫一次，自动分配给对应 profile 的代理执行。

每个工作代理有自己的工具、技能和人格 profile。它们从板上认领任务，通过链接依赖展开工作，通过共享工作区或 git worktree 传递文件。

任务状态流转：triage → todo → ready → running → blocked → done。

有实时仪表盘，有每个任务的评论线程（人和代理都能写），有心跳监控。整个系统 SQLite 支撑，崩溃重启后任务不丢。

第一次用建议给一个小任务试水。看 Dispatcher 怎么分配，工作代理怎么汇报。

---

## 进阶：用 Inspector 调试代理

这个功能容易被忽略，但很实用。

点击「Inspector」面板。能看到代理的推理链、性能指标、错误追踪。

代理为什么做了某个决定？Inspector 里有答案。

调试速度比翻日志快一个量级。

---

## 进阶：手机端访问

Workspace 是 PWA。桌面、平板、手机功能完全一致。

如果你用 Tailscale 把服务器暴露到内网，手机浏览器直接访问 `http://你的IP:3000`。可以添加到主屏幕，支持离线和推送通知。

---

## 进阶：macOS 桌面版

不想开浏览器的话，有原生桌面应用。

去 GitHub Releases 页面下载 dmg 安装包。约 529 MB。拖进 Applications 文件夹就行。

不需要 Node.js 环境。但仍需要 Agent gateway 在后台运行。

---

## 第一次做的建议

* 先跑通基础的聊天和记忆浏览。确认 Workspace 和 Agent 连接正常
* Kanban 等熟悉单代理工作流之后再开。上来就多代理容易懵
* 主题可以换。8 套主题，每套有亮色暗色。在 Settings 里切换
* 资源开销很小。Workspace 本身只占约 200MB 内存

---

## 容易踩的坑

**Node.js 版本不够**项目要求 ≥ 22。很多人系统自带的是 18 或 20。用 `nvm install 22` 升级。

**pnpm 没装**直接跑 `npm install` 会报错。必须用 pnpm。`npm install -g pnpm` 装一下。

**.env 端口写错**V2 架构下 Agent gateway 默认端口是 8642，不是 3000。Workspace 才是 3000。搞反了会连不上。

**Gateway 没启动**Workspace 只是前端。后面必须有 `hermes gateway run` 在跑。如果 gateway 没启动，界面会显示断开。

**首次运行没 setup**第一次用需要跑 `hermes setup` 选模型提供商。不选的话没有模型可用，聊天面板会报错。

---

SOURCES

* Hermes Workspace GitHub[2] — 2.8k Stars，MIT 协议
* Hermes Workspace 官网[3] — 安装指南和截图
* Hermes Agent 官网[4] — 128k Stars
* Kanban 多代理文档[5]
* Kanban 实测报道[6] — Unwind AI
* Workspace 开发者评测[7]
* Release v2.1.3[8] — 2026-05-01

Reference

[1] 

Hermes Workspace: *https://github.com/outsourc-e/hermes-workspace*

[2] 

Hermes Workspace GitHub: *https://github.com/outsourc-e/hermes-workspace*

[3] 

Hermes Workspace 官网: *https://hermes-workspace.com/*

[4] 

Hermes Agent 官网: *https://hermes-agent.nousresearch.com/*

[5] 

Kanban 多代理文档: *https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban*

[6] 

Kanban 实测报道: *https://www.theunwindai.com/p/multi-agent-kanban-board-in-hermes-agent*

[7] 

Workspace 开发者评测: *https://aiprofitboardroom.com/blog/hermes-agent-workspace/*

[8] 

Release v2.1.3: *https://github.com/outsourc-e/hermes-workspace/releases/tag/v2.1.3*

**下方是赋能君的AI学习交流永久免费星球，想学习更多内容，欢迎扫码加入。**

![图片](https://mmbiz.qpic.cn/mmbiz_jpg/x2j7P5RtWf4gqEyB1KvAPwa5t7my8U7LfnzFiceFRPeZQ7ucZJXmdSYT2RP6wR81U2YT7ubZEJIYHhwe8DWaCDQ/640?wx_fmt=jpeg&from=appmsg&watermark=1#imgIndex=3)

🙌 如果你阅读到这里，说明我们对信息的认可区域是有一定交集的，可以说我们是同道中人，所以如果你有自认为不错的信息获取渠道，欢迎留言或者私聊我，谢谢。

都看到这里了，就给个关注吧👀：

喜欢我的文章，可以请你右下角顺手来一波点赞&在看&分享三连么👉
