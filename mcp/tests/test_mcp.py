"""Exercise real MCP discovery/tools against a fake UI, without loading models."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx2 as httpx
from mcp import Client
from starlette.testclient import TestClient

from fizgig_mcp.adapter import FizgigAPI, create_server
from fizgig_mcp.server import create_app


class AdapterTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.dataset = self.root / "subject"
        self.dataset.mkdir()
        self.env = patch.dict(os.environ, {"FIZGIG_DATASETS_ROOT": str(self.root)})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.calls = []
        self.held = False
        self.warnings = []
        self.http = httpx.AsyncClient(
            base_url="http://127.0.0.1:8081",
            transport=httpx.MockTransport(self.handler),
        )
        self.api = FizgigAPI(self.http, "test-password")

    async def asyncTearDown(self):
        await self.http.aclose()

    def handler(self, request):
        self.calls.append((request.method, request.url.path))
        path = request.url.path
        if path == "/":
            return httpx.Response(
                200, text='<meta name="fizgig-token" content="test-token">'
            )
        if path == "/api/login":
            self.assertEqual(json.loads(request.content)["password"], "test-password")
            return httpx.Response(
                200,
                json={"ok": True},
                headers={"set-cookie": "fizgig_session=test; Path=/"},
            )
        self.assertEqual(request.headers.get("x-fizgig-token"), "test-token")
        self.assertIn("fizgig_session=test", request.headers.get("cookie", ""))
        if path == "/api/run":
            return httpx.Response(
                200,
                json={"state": "idle", "web_queue": {"held": self.held, "items": []}},
            )
        if path == "/api/schema":
            return httpx.Response(
                200,
                json={
                    "families": [
                        {
                            "key": "krea2",
                            "form": {"sections": [{"rows": [{"key": "LORA_NAME"}]}]},
                        }
                    ]
                },
            )
        if path == "/api/plan":
            return httpx.Response(200, json={"problems": [], "warnings": self.warnings})
        if path == "/api/prefs":
            return httpx.Response(
                200,
                json={
                    "models": {},
                    "HF_TOKEN": "hidden",
                    "web_password": "test-password",
                    "output_default": "/workspace/output_loras",
                },
            )
        if path == "/api/start":
            return httpx.Response(200, json={"ok": True})
        if path == "/api/queue/add":
            return httpx.Response(200, json={"ok": True, "id": "queued-1"})
        return httpx.Response(404)

    async def test_discovery_reads_and_redaction(self):
        async with Client(create_server(self.api)) as client:
            tools = await client.list_tools()
            names = {t.name for t in tools.tools}
            self.assertTrue(
                {
                    "get_status",
                    "prepare_training",
                    "start_training",
                    "list_model_bundles",
                }
                <= names
            )
            result = await client.call_tool("get_paths", {})
            self.assertFalse(result.is_error)
            self.assertNotIn("hidden", str(result))
            self.assertNotIn("test-password", str(result))
            await client.call_tool("get_status", {})
        self.assertNotIn(("POST", "/api/start"), self.calls)

    async def test_prepare_never_starts_and_queue_requires_dispatch_consent(self):
        args = {
            "family": "krea2",
            "values": {"LORA_NAME": "test"},
            "image_folder": str(self.dataset),
        }
        async with Client(create_server(self.api)) as client:
            result = await client.call_tool("prepare_training", args)
            self.assertFalse(result.is_error)
            self.assertFalse(result.structured_content["submitted"])
            result = await client.call_tool("queue_training", args)
            self.assertTrue(result.is_error)
        self.assertNotIn(("POST", "/api/start"), self.calls)
        self.assertNotIn(("POST", "/api/queue/add"), self.calls)

    async def test_held_queue_and_explicit_start(self):
        args = {
            "family": "krea2",
            "values": {"LORA_NAME": "test"},
            "image_folder": str(self.dataset),
        }
        self.held = True
        async with Client(create_server(self.api)) as client:
            result = await client.call_tool("queue_training", args)
            self.assertFalse(result.is_error)
            self.warnings = ["review settings"]
            await client.call_tool("start_training", args)
            self.assertNotIn(("POST", "/api/start"), self.calls)
            self.warnings = []
            result = await client.call_tool("start_training", args)
            self.assertFalse(result.is_error)
        self.assertIn(("POST", "/api/queue/add"), self.calls)
        self.assertEqual(self.calls.count(("POST", "/api/start")), 1)

    async def test_dataset_escape_and_internal_controls_rejected(self):
        async with Client(create_server(self.api)) as client:
            for folder, values in (
                ("/etc", {"LORA_NAME": "x"}),
                (str(self.dataset), {"LORA_NAME": "x", "__continue": "x"}),
            ):
                result = await client.call_tool(
                    "prepare_training",
                    {"family": "krea2", "values": values, "image_folder": folder},
                )
                self.assertTrue(result.is_error)
        self.assertNotIn(("POST", "/api/plan"), self.calls)

    async def test_uncertain_mutation_is_not_retried(self):
        self.api.token = "present"

        def fail(request):
            self.calls.append((request.method, request.url.path))
            raise httpx.ReadTimeout("secret must not leak")

        async with httpx.AsyncClient(
            base_url="http://127.0.0.1", transport=httpx.MockTransport(fail)
        ) as http:
            api = FizgigAPI(http, "test-password")
            api.token = "present"
            async with Client(create_server(api)) as client:
                result = await client.call_tool("stop_training", {})
                self.assertTrue(result.is_error)
                self.assertNotIn("secret must not leak", str(result))
        self.assertEqual(self.calls.count(("POST", "/api/stop")), 1)

    async def test_caption_edit_is_atomic_and_paths_stay_in_dataset(self):
        image = self.dataset / "a.jpg"
        image.write_bytes(b"preserved")
        async with Client(create_server(self.api)) as client:
            result = await client.call_tool(
                "set_caption",
                {"dataset": "subject", "image": "a.jpg", "caption": "new caption"},
            )
            self.assertFalse(result.is_error)
            result = await client.call_tool(
                "get_caption", {"dataset": "subject", "image": "a.jpg"}
            )
            self.assertEqual(result.structured_content["caption"], "new caption")
            result = await client.call_tool(
                "get_caption", {"dataset": "../outside", "image": "a.jpg"}
            )
            self.assertTrue(result.is_error)
        self.assertEqual(image.read_bytes(), b"preserved")
        self.assertEqual((self.dataset / "a.txt").read_text(), "new caption")
        self.assertNotIn(("POST", "/api/start"), self.calls)


class AuthenticationTests(unittest.TestCase):
    def test_all_mcp_requests_require_bearer(self):
        http = httpx.AsyncClient(base_url="http://127.0.0.1:8081")
        api = FizgigAPI(http, "test-password")
        with TestClient(create_app(api, "test-password", ["testserver"])) as client:
            for method in ("GET", "POST", "DELETE"):
                result = client.request(method, "/mcp")
                self.assertEqual(result.status_code, 401)


if __name__ == "__main__":
    unittest.main()
