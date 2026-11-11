"""Tie the upstream worker, WebUI gateway and MCP server lifetimes to the container."""

import contextlib
import os
import signal
import subprocess
import time
from types import FrameType


def main() -> int:
    children: list[subprocess.Popen[bytes]] = []
    stopping = False

    def stop(_signum: int, _frame: FrameType | None) -> None:
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    result = 0
    try:
        for command in (
            [
                "/opt/venv/bin/python3",
                "/opt/Fizgig/fizgig.py",
                "--web",
                "--host",
                "127.0.0.1",
                "--port",
                "18081",
            ],
            ["/opt/fizgig-mcp/bin/python", "-m", "fizgig_mcp.webui"],
            ["/opt/fizgig-mcp/bin/python", "-m", "fizgig_mcp.server"],
        ):
            children.append(subprocess.Popen(command, start_new_session=True))
        while not stopping:
            if any(child.poll() is not None for child in children):
                print("Fizgig process exited; stopping container", flush=True)
                result = 1
                break
            time.sleep(0.25)
    finally:
        for child in children:
            with contextlib.suppress(ProcessLookupError):
                os.killpg(child.pid, signal.SIGTERM)
        deadline = time.monotonic() + 25
        for child in children:
            try:
                child.wait(timeout=max(0.1, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(child.pid, signal.SIGKILL)
                child.wait()
    return result


if __name__ == "__main__":
    raise SystemExit(main())
