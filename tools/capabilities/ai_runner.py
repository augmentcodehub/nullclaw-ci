"""NullClaw AI 调用封装"""
import subprocess


def run_skill(skill_name: str, prompt: str, timeout: int = 300, workspace: str | None = None) -> str | None:
    """调用 NullClaw agent with skill，返回输出文本"""
    cmd = ["nullclaw", "agent", "--skill", skill_name, "-m", prompt]
    if workspace:
        cmd.extend(["--workspace", workspace])
    return _run(cmd, timeout)


def run_prompt(prompt: str, timeout: int = 300) -> str | None:
    """无 skill 的纯 prompt 调用"""
    cmd = ["nullclaw", "agent", "-m", prompt]
    return _run(cmd, timeout)


def _run(cmd: list[str], timeout: int) -> str | None:
    """执行命令，返回 stdout 或 None"""
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout
        )
        output = result.stdout.strip()
        return output if output else None
    except subprocess.TimeoutExpired:
        return None
    except OSError:
        return None
