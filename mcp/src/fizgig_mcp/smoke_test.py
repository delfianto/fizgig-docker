"""Read-only live protocol smoke test; no queue mutations or GPU work."""

import argparse
import asyncio
from pathlib import Path

import httpx2 as httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client


async def check(url: str, token: str) -> None:
    async with httpx.AsyncClient(trust_env=False) as anonymous:
        response = await anonymous.post(url, json={})
        assert response.status_code == 401
    async with (
        httpx.AsyncClient(
            headers={"Authorization": "Bearer " + token}, timeout=30, trust_env=False
        ) as http,
        streamable_http_client(url, http_client=http) as (read, write),
        ClientSession(read, write) as session,
    ):
        await session.initialize()
        tools = await session.list_tools()
        print(f"MCP handshake: {len(tools.tools)} tools")
        for name in (
            "get_status",
            "list_runs",
            "list_queue",
            "get_gpu_stats",
            "list_families",
            "list_model_bundles",
            "get_paths",
            "list_datasets",
            "list_outputs",
            "get_logs",
        ):
            result = await session.call_tool(name, {})
            assert not result.is_error, name
            print("PASS", name)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8083/mcp")
    parser.add_argument(
        "--token-file", type=Path, default=Path("/run/secrets/FIZGIG_PASSWORD")
    )
    args = parser.parse_args()
    asyncio.run(check(args.url, args.token_file.read_text().strip()))


if __name__ == "__main__":
    main()
