#!/bin/bash
# 执行飞书/Telegram 触发的任务
set +e

action="$1"
target="$2"
style="$3"
skill="$4"

result=""

case "$action" in
  fetch)
    # 公众号用 Playwright 脚本抓取
    if echo "$target" | grep -q "mp.weixin.qq.com"; then
      result=$(python3 tools/content-fetch/fetch_weixin.py "$target" 2>&1)
      # 检查是否成功（成功的输出以 --- 开头）
      if ! echo "$result" | head -1 | grep -q "^---"; then
        echo "Script failed: $result" >&2
        result=""
      fi
    fi
    # 非公众号或脚本失败，用 jina 代理
    if [ -z "$result" ]; then
      jina_out=$(curl -sL --max-time 30 "https://r.jina.ai/${target}" 2>/dev/null)
      # 检查是否被验证码拦截
      if echo "$jina_out" | grep -qi "captcha\|验证\|环境异常"; then
        jina_out=""
      fi
      result="$jina_out"
    fi
    # jina 失败用 defuddle
    if [ -z "$result" ]; then
      result=$(curl -sL --max-time 30 "https://defuddle.md/${target}" 2>/dev/null)
    fi
    if [ -n "$result" ]; then
      mkdir -p articles
      filename=$(echo "$target" | md5sum | cut -c1-8)
      echo "$result" > "articles/fetched-${filename}.md"
    fi
    ;;

  rewrite)
    if echo "$target" | grep -qE '^https?://'; then
      article=$(python3 tools/content-fetch/fetch_weixin.py "$target" 2>&1)
      if ! echo "$article" | head -1 | grep -q "^---"; then
        article=""
      fi
      if [ -z "$article" ]; then
        jina_out=$(curl -sL --max-time 30 "https://r.jina.ai/${target}" 2>/dev/null)
        if ! echo "$jina_out" | grep -qi "captcha\|验证\|环境异常"; then
          article="$jina_out"
        fi
      fi
    else
      article=$(cat "$target" 2>/dev/null)
    fi

    if [ -z "$article" ]; then
      result="错误：无法获取文章内容"
    else
      prompt="请用你的风格改写以下文章。只输出改写后的完整文章正文。原文如下：

${article}"
      result=$(timeout 300 nullclaw agent --skill "${style}-writer" -m "$prompt" 2>/dev/null)

      # 改写成功后添加封面图并发布到墨问
      if [ -n "$result" ]; then
        mkdir -p rewritten
        outfile="rewritten/${style}-$(date +%Y%m%d%H%M%S).md"

        # 从文章提取关键词搜索封面图
        cover_url=$(echo "$result" | python3 tools/get-cover.py 2>/dev/null)

        # 插入封面图到文章开头
        if [ -n "$cover_url" ]; then
          echo "![cover](${cover_url})

${result}" > "$outfile"
        else
          echo "$result" > "$outfile"
        fi

        # 更新 result 为带封面图的完整内容
        result=$(cat "$outfile")

        # 发布到墨问（v0.4.0 支持图片上传）
        if [ -x /usr/local/bin/mowen-cli ] && [ -n "$MOWEN_API_KEY" ]; then
          MOWEN_API_KEY="$MOWEN_API_KEY" /usr/local/bin/mowen-cli create "$outfile" --auto-publish --tags "${style},改写" >/dev/null 2>/dev/null
          if [ $? -eq 0 ]; then
            result="${result}

---
✅ 已发布到墨问"
          fi
        fi
      fi
    fi
    ;;

  skill)
    result=$(timeout 300 nullclaw agent --skill "$skill" -m "$target" 2>/dev/null)
    ;;

  ingest)
    # 摄入：抓取 URL → 存入 llmwiki/raw/ → NullClaw 生成 wiki 页面
    # 先抓取内容
    if echo "$target" | grep -q "mp.weixin.qq.com"; then
      content=$(python3 tools/content-fetch/fetch_weixin.py "$target" 2>/dev/null)
      if ! echo "$content" | head -1 | grep -q "^---"; then
        content=""
      fi
    fi
    if [ -z "$content" ]; then
      content=$(curl -sL --max-time 30 "https://r.jina.ai/${target}" 2>/dev/null)
      if echo "$content" | grep -qi "captcha\|验证\|环境异常"; then
        content=""
      fi
    fi
    if [ -z "$content" ]; then
      content=$(curl -sL --max-time 30 "https://defuddle.md/${target}" 2>/dev/null)
    fi

    if [ -z "$content" ]; then
      result="错误：无法抓取文章内容"
    else
      # 存入 raw/
      mkdir -p llmwiki/raw
      filename=$(echo "$target" | md5sum | cut -c1-8)
      raw_file="llmwiki/raw/fetched-${filename}.md"
      echo "$content" > "$raw_file"

      # 让 NullClaw 用 llmwiki-agent skill 执行 ingest
      result=$(timeout 300 nullclaw agent --skill llmwiki-agent \
        --workspace llmwiki \
        -m "请执行 Ingest 操作。新素材文件：${raw_file}。请读取素材，生成摘要页到 wiki/，更新 index.md 和 log.md。只输出你创建/更新的文件列表和摘要内容。" 2>/dev/null)
    fi
    ;;

  query)
    # 查询：基于 wiki 回答问题
    result=$(timeout 300 nullclaw agent --skill llmwiki-agent \
      --workspace llmwiki \
      -m "请执行 Query 操作。问题：${target}。先读 wiki/index.md 找相关页面，然后综合回答。如果回答有价值，file back 回 wiki。" 2>/dev/null)
    ;;

  lint)
    # 健康检查
    result=$(timeout 300 nullclaw agent --skill llmwiki-agent \
      --workspace llmwiki \
      -m "请执行 Lint 操作。检查 wiki/ 目录的健康状况：断链、孤立页面、index.md 与实际文件不一致、缺失的概念页。输出检查报告。" 2>/dev/null)
    ;;

  distill)
    # 蒸馏人物
    result=$(timeout 300 nullclaw agent --skill nuwa-skill \
      --workspace llmwiki \
      -m "请蒸馏：${target}。按女娲流程执行，生成 SKILL.md 保存到 .agents/skills/ 目录下。" 2>/dev/null)
    ;;

  publish)
    # 手动发布文件到墨问
    if [ -f "$target" ]; then
      if [ -x /usr/local/bin/mowen-cli ] && [ -n "$MOWEN_API_KEY" ]; then
        MOWEN_API_KEY="$MOWEN_API_KEY" /usr/local/bin/mowen-cli create "$target" --auto-publish --tags "nullclaw" >/dev/null 2>/dev/null
        if [ $? -eq 0 ]; then
          result="✅ 已发布到墨问：$target"
        else
          result="❌ 发布失败，请检查 API Key 配置"
        fi
      else
        result="错误：mowen-cli 未安装"
      fi
    else
      result="错误：文件不存在 $target"
    fi
    ;;

  pending)
    # 列出未发布的文件
    published=""
    if [ -f ".mowen/metadata.json" ]; then
      published=$(python3 -c "
import json
with open('.mowen/metadata.json') as f:
    data = json.load(f)
for item in data.get('files', data) if isinstance(data, list) else data.get('files', []):
    path = item.get('path') or item.get('file_path') or ''
    if path: print(path)
" 2>/dev/null)
    fi

    pending_list=""
    for f in rewritten/*.md; do
      [ -f "$f" ] || continue
      if ! echo "$published" | grep -qF "$f"; then
        pending_list="${pending_list}
• $f"
      fi
    done

    if [ -z "$pending_list" ]; then
      result="所有文件都已发布，没有待发布的内容。"
    else
      result="未发布的文件：${pending_list}

发送「发布 <文件路径>」上传指定文件"
    fi
    ;;

  *)
    result="未知指令: $action"
    ;;
esac

if [ -n "$result" ]; then
  echo "$result" > /tmp/result.txt
  echo "success"
else
  echo "执行超时或无输出" > /tmp/result.txt
  echo "error"
fi
