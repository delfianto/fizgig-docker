"""Enforce local-only networking in every Python worker via a site .pth hook.

Loopback/Unix sockets work. Outbound helpers and downloads require an intentional
FIZGIG_OFFLINE=0 deployment change. This is a runtime policy, not a sandbox.
"""

from __future__ import annotations

import ipaddress
import os
import sys


def local_host(host) -> bool:
    if isinstance(host, bytes):
        host = host.decode()
    if host in {None, "", "localhost"}:
        return True
    try:
        return ipaddress.ip_address(str(host)).is_loopback
    except ValueError:
        return False


def audit(event: str, args: tuple) -> None:
    if event == "socket.getaddrinfo" and not local_host(args[0]):
        raise PermissionError(
            "Fizgig offline mode: outbound network access is disabled; register local assets"
        )
    if event == "socket.connect":
        address = args[1]
        if isinstance(address, tuple) and not local_host(address[0]):
            raise PermissionError(
                "Fizgig offline mode: outbound network access is disabled; register local assets"
            )


def install() -> None:
    if os.environ.get("FIZGIG_OFFLINE", "1") != "1":
        return
    for key in (
        "HF_HUB_OFFLINE",
        "TRANSFORMERS_OFFLINE",
        "HF_DATASETS_OFFLINE",
        "HF_HUB_DISABLE_TELEMETRY",
    ):
        os.environ[key] = "1"
    sys.addaudithook(audit)
