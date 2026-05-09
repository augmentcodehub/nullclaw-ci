"""Pipeline: AI 蒸馏人物 → 生成 writer skill"""
import glob
from pathlib import Path
from capabilities.ai_runner import run_skill


def execute(target: str, **kwargs) -> str:
    name = target.strip().strip("<>")
    target_dir = Path(f"skills/writers/{name}-writer")

    # 调用女娲蒸馏
    prompt = (
        f"请蒸馏：{name}。按女娲流程执行，"
        f"生成的 SKILL.md 保存到 skills/writers/{name}-writer/ 目录下。"
        f"注意：生成的是一个 writer skill，用于改写文章，name 字段格式为 xxx-writer。"
    )
    result = run_skill("nuwa-skill", prompt, timeout=600)

    # 兜底：NullClaw 可能忽略路径指令，找到文件移到正确位置
    if not (target_dir / "SKILL.md").exists():
        found = _find_generated_skill(name)
        if found:
            target_dir.mkdir(parents=True, exist_ok=True)
            (target_dir / "SKILL.md").write_text(
                Path(found).read_text(encoding="utf-8"), encoding="utf-8"
            )

    return result or "错误：蒸馏失败"


def _find_generated_skill(name: str) -> str | None:
    """搜索 NullClaw 可能输出的位置"""
    patterns = [
        f"./**/*{name}*/SKILL.md",
        f"./llmwiki/.agents/skills/*{name}*/SKILL.md",
        f"./.agents/skills/*{name}*/SKILL.md",
    ]
    for pattern in patterns:
        matches = glob.glob(pattern, recursive=True)
        for m in matches:
            if "skills/writers/" not in m and ".git" not in m:
                return m
    return None
