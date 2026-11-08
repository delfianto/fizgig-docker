"""Authenticated Streamable HTTP entrypoint for the Fizgig adapter."""

from __future__ import annotations

import hmac
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit

import httpx2 as httpx
import uvicorn
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.types import ASGIApp, Receive, Scope, Send

from .adapter import FizgigAPI, create_server


class BearerAuth:
    """Authenticate every MCP request, including initialize, SSE and session deletion."""

    def __init__(self, app: ASGIApp, token: str) -> None:
        self.app = app
        self.expected = ("Bearer " + token).encode()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["path"] != "/health":
            headers = dict(scope["headers"])
            if not hmac.compare_digest(
                headers.get(b"authorization", b""), self.expected
            ):
                response = JSONResponse(
                    {"error": "Bearer token required"},
                    status_code=401,
                    headers={"WWW-Authenticate": "Bearer"},
                )
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)


def create_app(api: FizgigAPI, token: str, allowed_hosts: list[str]) -> ASGIApp:
    server = create_server(api)
    app = server.streamable_http_app(
        stateless_http=True,
        json_response=True,
        host="0.0.0.0",
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=True, allowed_hosts=allowed_hosts
        ),
    )
    original_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(application: Starlette) -> AsyncIterator[None]:
        async with api.http, original_lifespan(application):
            yield

    async def health(_request: Request) -> JSONResponse:
        try:
            await api.request("run")
        except (httpx.HTTPError, ToolError):
            return JSONResponse({"status": "unavailable"}, status_code=503)
        return JSONResponse({"status": "ok"})

    app.router.lifespan_context = lifespan
    app.routes.append(Route("/health", health))
    return BearerAuth(app, token)


def main() -> None:
    token = (
        os.environ.get("FIZGIG_PASSWORD")
        or Path(os.environ.get("FIZGIG_AUTH_FILE", "/run/secrets/FIZGIG_PASSWORD"))
        .read_text()
        .strip()
    )
    if not token:
        raise ValueError("A nonempty FIZGIG_PASSWORD token is required")
    url = os.environ.get("FIZGIG_API_URL", "http://127.0.0.1:8081")
    if urlsplit(url).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("Fizgig companion API must use container loopback")
    # No inherited proxies: this connection remains within the container.
    http = httpx.AsyncClient(
        base_url=url,
        timeout=30,
        trust_env=False,
    )
    api = FizgigAPI(http, token)
    hosts = os.environ.get(
        "FIZGIG_MCP_ALLOWED_HOSTS", "localhost:*,127.0.0.1:*,fizgig:*"
    ).split(",")
    app = create_app(api, token, hosts)
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("FIZGIG_MCP_PORT", "8083")),
        access_log=False,
    )


if __name__ == "__main__":
    main()
