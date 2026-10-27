"""Run Admin browser smoke tests against the local demo Firebase Emulator only.

The HTTP server overlays firebase-config.local.js in memory, so the workspace's
cloud configuration is never changed or served to these tests.
"""

from functools import partial
from html import unescape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from threading import Thread
from urllib.request import Request, urlopen


WEB_ROOT = Path(__file__).resolve().parents[1]
API_BASE = "http://127.0.0.1:5001/demo-recycling-share/asia-southeast1/api/v1"
AUTH_URL = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key"
CONFIG = (
    'export default { projectId: "demo-recycling-share", apiKey: "demo-key", '
    f'apiBase: "{API_BASE}", emulator: true, authEmulatorHost: "127.0.0.1:9099" }};\n'
).encode("utf-8")
TESTS = [
    ("firebase-smoke.html", "browser-result"),
    ("social-smoke.html", "browser-result"),
    ("settings-smoke.html", "settings-result"),
    ("module-navigation.html", "module-navigation-result"),
    ("live-updates.html", "live-updates-result"),
    ("delete-content.html", "delete-content-result"),
]


def json_request(url: str, body: dict | None = None, token: str | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    with urlopen(Request(url, data=data, headers=headers), timeout=10) as response:
        return json.load(response)


def check_demo_environment() -> None:
    health = json_request(f"{API_BASE}/health")
    if health.get("emulator") is not True or health.get("status") != "ok":
        raise RuntimeError("Functions API is not the demo Emulator")
    auth = json_request(AUTH_URL, {
        "email": "admin@ecoshare.test",
        "password": "EcoShareDemo123!",
        "returnSecureToken": True,
    })
    profile = json_request(f"{API_BASE}/me", token=auth["idToken"])
    if profile.get("id") != "demo-admin" or profile.get("role") != "ADMIN":
        raise RuntimeError("Seed demo Admin profile before running browser smoke tests")


class DemoHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path.split("?", 1)[0] == "/firebase-config.local.js":
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(CONFIG)))
            self.end_headers()
            self.wfile.write(CONFIG)
        else:
            super().do_GET()

    def log_message(self, *args: object) -> None:
        pass


def browser_path() -> str:
    configured = os.environ.get("ECOSHARE_BROWSER")
    candidates = [
        configured,
        shutil.which("msedge"),
        shutil.which("chrome"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
    raise RuntimeError("Edge/Chrome not found; set ECOSHARE_BROWSER to its executable path")


def run_test(browser: str, port: int, page: str, marker: str) -> bool:
    profile = Path(tempfile.mkdtemp(prefix="ecoshare-admin-browser-qa-"))
    try:
        command = [
            browser, "--headless", "--disable-gpu", "--no-first-run",
            "--no-default-browser-check", f"--user-data-dir={profile}",
            "--virtual-time-budget=90000", "--dump-dom",
            f"http://127.0.0.1:{port}/tests/{page}",
        ]
        result = subprocess.run(command, capture_output=True, text=True,
                                encoding="utf-8", errors="replace", timeout=120)
        match = re.search(rf'<pre id="{re.escape(marker)}"[^>]*>(.*?)</pre>',
                          result.stdout, re.DOTALL)
        lines = unescape(match.group(1)).splitlines() if match else []
        print(f"{page}: browser exit {result.returncode}")
        for line in lines:
            print(f"  {line}")
        if not lines:
            print("  FAIL No test result in browser DOM")
        return result.returncode == 0 and bool(lines) and not any(line.startswith("FAIL") for line in lines)
    finally:
        temp_root = Path(tempfile.gettempdir()).resolve()
        resolved = profile.resolve()
        if resolved.parent != temp_root or not resolved.name.startswith("ecoshare-admin-browser-qa-"):
            raise RuntimeError("Unexpected browser profile directory")
        shutil.rmtree(resolved, ignore_errors=True)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Run Admin browser smoke tests on the demo Firebase Emulator.")
    parser.add_argument("--page", choices=[page for page, _ in TESTS], help="Run one browser page only")
    args = parser.parse_args()
    tests = [item for item in TESTS if args.page is None or item[0] == args.page]
    check_demo_environment()
    server = ThreadingHTTPServer(("127.0.0.1", 0),
                                 partial(DemoHandler, directory=str(WEB_ROOT)))
    server.daemon_threads = True
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        browser = browser_path()
        passed = [run_test(browser, server.server_port, page, marker)
                  for page, marker in tests]
        print(f"RESULT: {sum(passed)}/{len(passed)} browser pages passed")
        return 0 if all(passed) else 1
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    raise SystemExit(main())
