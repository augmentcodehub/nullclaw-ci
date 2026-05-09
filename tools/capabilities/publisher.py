"""墨问发布封装"""
import os
import subprocess


def publish_to_mowen(file_path: str, tags: list[str] | None = None) -> bool:
    """调用 mowen-cli 发布文件，返回是否成功"""
    api_key = os.environ.get("MOWEN_API_KEY", "")
    if not api_key:
        return False

    mowen = "/usr/local/bin/mowen-cli"
    if not os.path.isfile(mowen):
        return False

    cmd = [mowen, "create", file_path, "--auto-publish"]
    if tags:
        cmd.extend(["--tags", ",".join(tags)])

    try:
        env = {**os.environ, "MOWEN_API_KEY": api_key}
        result = subprocess.run(cmd, capture_output=True, timeout=60, env=env)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False
