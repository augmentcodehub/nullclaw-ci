"""Pipeline: AI 蒸馏人物 → 生成 writer skill"""
import glob
import re
from pathlib import Path
from capabilities.ai_runner import run_skill

# 常见人物名中文→拼音映射（可扩展）
_NAME_MAP = {
    "鲁迅": "lu-xun", "马三立": "ma-sanli", "徐志摩": "xu-zhimo",
    "李白": "li-bai", "苏东坡": "su-dongpo", "苏轼": "su-shi",
    "杜甫": "du-fu", "王小波": "wang-xiaobo", "林语堂": "lin-yutang",
    "钱钟书": "qian-zhongshu", "张爱玲": "zhang-ailing",
    "老舍": "lao-she", "沈从文": "shen-congwen",
}


def execute(target: str, **kwargs) -> str:
    name = target.strip().strip("<>")
    slug = _NAME_MAP.get(name, _to_slug(name))
    target_dir = Path(f"skills/writers/{slug}-writer")

    # 调用女娲蒸馏
    prompt = (
        f"请蒸馏：{name}。按女娲流程执行，"
        f"生成的 SKILL.md 保存到 skills/writers/{slug}-writer/ 目录下。"
        f"注意：生成的是一个 writer skill，用于改写文章，name 字段必须是 {slug}-writer。"
    )
    result = run_skill("nuwa-skill", prompt, timeout=600)

    # 兜底：NullClaw 可能忽略路径指令，找到文件移到正确位置
    if not (target_dir / "SKILL.md").exists():
        found = _find_generated_skill(name, slug)
        if found:
            target_dir.mkdir(parents=True, exist_ok=True)
            (target_dir / "SKILL.md").write_text(
                Path(found).read_text(encoding="utf-8"), encoding="utf-8"
            )

    return result or "错误：蒸馏失败"


def _to_slug(name: str) -> str:
    """简单 fallback：非 ASCII 字符保留，空格转连字符，小写"""
    s = name.lower().replace(" ", "-")
    s = re.sub(r"[^a-z0-9\u4e00-\u9fff-]", "", s)
    return s or "unknown"


def _find_generated_skill(name: str, slug: str) -> str | None:
    """搜索 NullClaw 可能输出的位置"""
    patterns = [
        f"./**/*{name}*/SKILL.md",
        f"./**/*{slug}*/SKILL.md",
        f"./llmwiki/.agents/skills/*/SKILL.md",
    ]
    for pattern in patterns:
        matches = glob.glob(pattern, recursive=True)
        for m in matches:
            if f"skills/writers/{slug}-writer" not in m and ".git" not in m:
                return m
    return None
