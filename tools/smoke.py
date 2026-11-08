"""Check the live UI, authentication and model preferences without starting work."""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import re
import urllib.error
import urllib.request
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8082")
    parser.add_argument("--password-file", type=Path, required=True)
    args = parser.parse_args()
    base = args.url.rstrip("/")
    client = urllib.request.build_opener(
        urllib.request.ProxyHandler({}),
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),
    )
    with client.open(base + "/", timeout=10) as response:
        page = response.read().decode()
    token = re.search(r'name="fizgig-token" content="([^"]+)"', page)
    if token is None:
        raise RuntimeError("Page does not contain the Fizgig session token")
    headers = {"X-Fizgig-Token": token.group(1), "Content-Type": "application/json"}
    try:
        client.open(
            urllib.request.Request(base + "/api/schema", headers=headers), timeout=10
        )
    except urllib.error.HTTPError as error:
        if error.code != 401:
            raise
    else:
        raise RuntimeError("Unauthenticated API unexpectedly accessible")
    password = args.password_file.read_text().strip()
    request = urllib.request.Request(
        base + "/api/login",
        data=json.dumps({"password": password}).encode(),
        headers=headers,
    )
    with client.open(request, timeout=10) as response:
        assert response.status == 200
    for endpoint in ("schema", "prefs", "state"):
        request = urllib.request.Request(base + "/api/" + endpoint, headers=headers)
        with client.open(request, timeout=20) as response:
            data = json.load(response)
        if "error" in data:
            raise RuntimeError(f"{endpoint} API error: {data['error']}")
        if endpoint == "prefs":
            assert data["password_on"] is True
            assert data["output_default"] == "/workspace/output_loras"
        if endpoint == "state":
            print("UI family:", data.get("family"))
    print(
        "PASS: UI served, unauthenticated API rejected, login and authenticated APIs work"
    )


if __name__ == "__main__":
    main()
