# 飞书机器人配置教程

将飞书机器人接入 NullClaw CI，实现在飞书中发 URL 自动抓取、发指令自动改写。

## 前提

- Cloudflare Worker 已部署（参考 `docs/deploy.md`）
- 有飞书管理员权限或能创建企业自建应用

## 第一步：创建飞书应用

1. 打开 https://open.feishu.cn/app
2. 点击「创建企业自建应用」
3. 填写应用名称（如 `NullClaw Bot`）和描述
4. 记录 **App ID** 和 **App Secret**（凭证与基础信息页面）

## 第二步：添加机器人能力

1. 左侧菜单 → **添加应用能力**
2. 找到「机器人」→ 点击添加

## 第三步：配置权限

1. 左侧菜单 → **权限管理**
2. 搜索并开通以下权限：
   - `im:message` — 获取与发送单聊、群组消息
   - `im:message:send_as_bot` — 以应用身份发送消息

## 第四步：配置事件订阅

1. 左侧菜单 → **事件与回调** → **事件配置**
2. 订阅方式选择：**将事件发送至开发者服务器**
3. 请求地址填写：
   ```
   https://bot.ouraihub.com/feishu/event
   ```
   （替换为你的 Worker 域名）
4. 点击保存，飞书会发送 challenge 验证，Worker 自动响应
5. 添加事件 → 搜索 `im.message.receive_v1`（接收消息）→ 添加

## 第五步：配置加密策略

1. 左侧菜单 → **事件与回调** → **加密策略**
2. 记录 **Verification Token**（点击眼睛图标查看）
3. **Encrypt Key** 不需要开启

## 第六步：配置 Worker Secrets

在终端执行（替换为你的实际值）：

```bash
cd worker

# App ID
echo "cli_你的AppID" | wrangler secret put FEISHU_APP_ID

# App Secret
echo "你的AppSecret" | wrangler secret put FEISHU_APP_SECRET

# Verification Token（第五步获取的）
echo "你的VerificationToken" | wrangler secret put FEISHU_VERIFICATION_TOKEN
```

## 第七步：发布应用

**重要：每次修改配置（权限、事件订阅、请求地址）后都需要发布新版本才能生效。**

1. 左侧菜单 → **版本管理与发布**
2. 点击「创建版本」
3. 填写版本号（如 `1.0.0`）
4. 点击「发布」或「申请发布」
5. 等待审核通过（企业内部应用通常秒过）

## 第八步：测试

1. 在飞书搜索栏搜索你的应用名称
2. 点击机器人，进入对话
3. 发送一条消息测试：
   ```
   你好
   ```
   应该收到帮助信息回复

4. 发送 URL 测试抓取：
   ```
   https://mp.weixin.qq.com/s/xxx
   ```

## 常见问题

### 机器人不回复

1. 确认应用已发布（版本管理页面有已上线的版本）
2. 确认事件 `im.message.receive_v1` 已添加
3. 确认请求地址已保存且验证通过
4. 确认权限 `im:message` 和 `im:message:send_as_bot` 已开通
5. 以上任何修改后都需要**重新发布版本**

### 验证地址失败

- 确认 Worker 已部署且能访问：浏览器打开 `https://你的域名/feishu/event` 不报错
- 确认 Worker 能正确响应 challenge（可用 curl 测试）：
  ```bash
  curl -X POST https://你的域名/feishu/event \
    -H "Content-Type: application/json" \
    -d '{"type":"url_verification","challenge":"test","token":"你的token"}'
  ```
  应返回：`{"challenge":"test"}`

### 搜索不到机器人

- 确认已添加「机器人」能力
- 确认应用已发布上线
- 尝试用应用的精确名称搜索

### 群聊中机器人不回复

- 默认需要 @机器人 才会响应
- 确认机器人已被添加到群中
