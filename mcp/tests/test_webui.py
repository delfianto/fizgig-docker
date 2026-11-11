"""Verify WebUI ASGI gateway CSRF injection, session auth forwarding and catalog security."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import httpx2 as httpx
from starlette.testclient import TestClient

from fizgig_mcp.webui import TelemetryCollector, create_webui_app


class FakeTelemetry(TelemetryCollector):
    async def get_gpus(self) -> list[dict[str, object]]:
        return [
            {
                "index": 0,
                "name": "RTX 4080",
                "vram": [1073741824, 16 * 1073741824],
                "util": 22,
                "temp": 49,
                "power": 65,
                "power_limit": 320,
            }
        ]

    def get_cpu(self) -> dict[str, int | None]:
        return {"util": 12, "temp": 54}


class WebuiGatewayTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)

        self.dist = root / "dist"
        (self.dist / "assets").mkdir(parents=True)
        (self.dist / "index.html").write_text(
            "<!doctype html><html><head><title>Fizgig Studio</title></head>"
            '<body><div id="app"></div></body></html>',
            encoding="utf-8",
        )
        (self.dist / "assets" / "app.js").write_text(
            "console.log('fizgig');", encoding="utf-8"
        )

        self.catalog = root / "models.json"
        self.catalog.write_text(
            json.dumps(
                {
                    "active": ["krea-lustify"],
                    "bundles": {"krea-lustify": {"family": "krea2", "preferences": {}}},
                    "external_roots": {"toolkit": "/toolkit-models"},
                }
            ),
            encoding="utf-8",
        )

    def _make_client(self) -> TestClient:
        def upstream_handler(request: httpx.Request) -> httpx.Response:
            path = request.url.path
            if path == "/":
                return httpx.Response(
                    200,
                    text='<html><head><meta name="fizgig-token" content="csrf-abc-123"></head></html>',
                )
            if path == "/api/login" and request.method == "POST":
                token = request.headers.get("x-fizgig-token")
                body = json.loads(request.content)
                if token == "csrf-abc-123" and body.get("password") == "correct-secret":
                    return httpx.Response(
                        200,
                        json={"ok": True},
                        headers={
                            "set-cookie": "fizgig_session=valid; Path=/; HttpOnly"
                        },
                    )
                return httpx.Response(401, json={"error": "Wrong password"})

            has_session = "fizgig_session=valid" in request.headers.get("cookie", "")
            has_csrf = request.headers.get("x-fizgig-token") == "csrf-abc-123"
            if not (has_session and has_csrf):
                return httpx.Response(401, json={"error": "Unauthorized"})

            if path == "/api/state":
                return httpx.Response(200, json={"family": "krea2"})
            if path == "/api/schema":
                return httpx.Response(200, json={"families": [], "order": []})
            if path == "/api/stats":
                return httpx.Response(
                    200,
                    json={
                        "vram": [0, 16 * 1073741824],
                        "ram": [0, 32 * 1073741824],
                        "device_name": "GPU",
                    },
                )
            return httpx.Response(404, json={"error": "Not found"})

        upstream_http = httpx.AsyncClient(
            base_url="http://127.0.0.1:18081",
            transport=httpx.MockTransport(upstream_handler),
        )
        app = create_webui_app(
            upstream_http, self.dist, self.catalog, telemetry=FakeTelemetry()
        )
        return TestClient(app)

    def test_spa_injects_csrf_and_rejects_unauthenticated_apis(self) -> None:
        with self._make_client() as client:
            home = client.get("/composer")
            self.assertEqual(home.status_code, 200)
            self.assertIn('name="fizgig-token" content="csrf-abc-123"', home.text)

            asset = client.get("/assets/app.js")
            self.assertEqual(asset.status_code, 200)
            self.assertIn("immutable", asset.headers["cache-control"])

            # Unauthenticated API & local catalog calls must be rejected with 401
            self.assertEqual(
                client.get(
                    "/api/schema", headers={"X-Fizgig-Token": "csrf-abc-123"}
                ).status_code,
                401,
            )
            self.assertEqual(
                client.get(
                    "/ui-api/local/bundles", headers={"X-Fizgig-Token": "csrf-abc-123"}
                ).status_code,
                401,
            )

            # Login sets session cookie and unlocks API + telemetry enrichment + bundles
            login = client.post(
                "/api/login",
                json={"password": "correct-secret"},
                headers={"X-Fizgig-Token": "csrf-abc-123"},
            )
            self.assertEqual(login.status_code, 200)

            bundles = client.get(
                "/ui-api/local/bundles", headers={"X-Fizgig-Token": "csrf-abc-123"}
            )
            self.assertEqual(bundles.status_code, 200)
            self.assertEqual(bundles.json()["active"], ["krea-lustify"])

            stats = client.get("/api/stats", headers={"X-Fizgig-Token": "csrf-abc-123"})
            self.assertEqual(stats.status_code, 200)
            stats_json = stats.json()
            self.assertEqual(stats_json["gpu_util"], 22)
            self.assertEqual(stats_json["cpu_util"], 12)
            self.assertEqual(len(stats_json["gpus"]), 1)


if __name__ == "__main__":
    unittest.main()
