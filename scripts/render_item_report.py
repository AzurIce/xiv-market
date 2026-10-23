from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PORT = 4178
WINDOWS_PLAYWRIGHT_CHROMIUM = Path.home() / "AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render an XIV Market item report PNG.")
    parser.add_argument("--data", "-d", required=True, help="Path to an ItemReport JSON file.")
    parser.add_argument("--quality", type=str.lower, choices=("nq", "hq"), default="hq", help="Chart quality; defaults to HQ.")
    parser.add_argument("--out", "-o", default="item-report.png", help="Output PNG path.")
    parser.add_argument("--base-url", help="Existing xiv-market URL. If omitted, a local Vite server is started.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Local server port. Defaults to {DEFAULT_PORT}.")
    parser.add_argument("--keep-server", action="store_true", help="Keep the local Vite server alive.")
    parser.add_argument("--browser", help="Browser executable path. Defaults to PLAYWRIGHT_BROWSER, then bundled Chromium.")
    parser.add_argument("--debug", action="store_true", help="Print renderer progress to stderr.")
    return parser.parse_args()


def debug(enabled: bool, message: str) -> None:
    if enabled:
        print(f"[render:item] {message}", file=sys.stderr, flush=True)


def wait_for_server(url: str, process: subprocess.Popen[bytes], timeout_sec: int = 30) -> None:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        if process.poll() is not None:
            stdout, stderr = process.communicate(timeout=1)
            raise SystemExit(
                "Vite server exited early:\n"
                + stdout.decode("utf-8", errors="replace")
                + stderr.decode("utf-8", errors="replace")
            )
        try:
            with urlopen(url, timeout=2) as response:
                if 200 <= response.status < 500:
                    return
        except Exception:
            pass
        time.sleep(0.25)
    raise SystemExit(f"Timed out waiting for Vite server: {url}")


def start_server(port: int, debug_enabled: bool) -> subprocess.Popen[bytes]:
    debug(debug_enabled, f"starting local server on port {port}")
    return subprocess.Popen(
        ["bun", "run", "--cwd", "app", "dev", "--host", "127.0.0.1", "--port", str(port)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env={**os.environ, "BROWSER": "none"},
    )


def stop_server(process: subprocess.Popen[bytes], debug_enabled: bool) -> None:
    debug(debug_enabled, "stopping local server")
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/pid", str(process.pid), "/t", "/f"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


def default_browser_path() -> str | None:
    explicit = os.environ.get("PLAYWRIGHT_BROWSER")
    if explicit:
        return explicit
    if WINDOWS_PLAYWRIGHT_CHROMIUM.exists():
        return str(WINDOWS_PLAYWRIGHT_CHROMIUM)
    return None


def launch_browser(playwright, browser_path: str | None, debug_enabled: bool):
    for attempt in range(1, 3):
        try:
            return playwright.chromium.launch(
                executable_path=browser_path,
                headless=True,
                args=["--disable-background-networking"],
            )
        except PlaywrightError as exc:
            if attempt == 2:
                raise
            reason = str(exc).splitlines()[0] if str(exc) else type(exc).__name__
            debug(debug_enabled, f"browser launch failed: {reason}; retrying in 1 second")
            time.sleep(1)


def render_report(args: argparse.Namespace) -> dict[str, str]:
    with Path(args.data).open("r", encoding="utf-8") as stream:
        report = json.load(stream)
    if report.get("schemaVersion") != 1 or not report.get("itemId") or not report.get("scope"):
        raise SystemExit("Expected a version 1 ItemReport JSON with itemId and scope")
    item_id = str(report["itemId"])
    quality = args.quality if report.get("item", {}).get("canBeHq") else "nq"
    server: subprocess.Popen[bytes] | None = None

    try:
        if args.base_url:
            base_url = args.base_url
        else:
            server = start_server(args.port, args.debug)
            base_url = f"http://127.0.0.1:{args.port}/"
            wait_for_server(base_url, server)

        url = base_url.rstrip("/") + "/render.html?quality=" + quality
        out_path = Path(args.out).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        browser_path = args.browser or default_browser_path()

        debug(args.debug, f"launching browser{': ' + browser_path if browser_path else ''}")
        with sync_playwright() as playwright:
            browser = launch_browser(playwright, browser_path, args.debug)
            try:
                page = browser.new_page(
                    viewport={"width": 1120, "height": 1600},
                    device_scale_factor=2,
                )
                page.on("console", lambda msg: debug(args.debug, f"console.{msg.type}: {msg.text}"))
                page.on("pageerror", lambda err: debug(args.debug, f"pageerror: {err}"))
                payload = json.dumps(report, ensure_ascii=True).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
                page.add_init_script("Object.defineProperty(globalThis, '__XIV_MARKET_REPORT__', { value: " + payload + " });")
                debug(args.debug, f"opening {url}")
                page.goto(url, wait_until="domcontentloaded", timeout=60_000)
                root = page.locator('[data-render-root="item-report"]')
                debug(args.debug, "waiting for render root")
                root.wait_for(state="visible", timeout=30_000)
                debug(args.debug, "waiting for data-render-ready=true")
                page.wait_for_function(
                    """() => {
                      const el = document.querySelector('[data-render-root="item-report"]');
                      return el?.getAttribute('data-render-ready') === 'true' || Boolean(el?.getAttribute('data-render-error'));
                    }""",
                    timeout=60_000,
                )
                render_error = root.get_attribute("data-render-error")
                if render_error:
                    raise RuntimeError(render_error)
                debug(args.debug, f"writing {out_path}")
                root.screenshot(path=str(out_path), animations="disabled")
            finally:
                debug(args.debug, "closing browser")
                browser.close()

        return {"itemId": item_id, "scope": report["scope"], "quality": quality, "url": url, "out": str(out_path)}
    finally:
        if server is not None and not args.keep_server:
            stop_server(server, args.debug)


def main() -> None:
    result = render_report(parse_args())
    print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
