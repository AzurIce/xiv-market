from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from difflib import SequenceMatcher
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PORT = 4178
WINDOWS_PLAYWRIGHT_CHROMIUM = Path.home() / "AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render an XIV Market item report PNG.")
    parser.add_argument("--item", "-i", required=True, help="Item id, exact name, or unambiguous partial name.")
    parser.add_argument("--scope", "-s", default="中国", help="Universalis scope. Defaults to 中国.")
    parser.add_argument("--out", "-o", default="item-report.png", help="Output PNG path.")
    parser.add_argument("--base-url", help="Existing xiv-market URL. If omitted, a local Vite server is started.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Local server port. Defaults to {DEFAULT_PORT}.")
    parser.add_argument("--keep-server", action="store_true", help="Keep the local Vite server alive.")
    parser.add_argument("--browser", help="Browser executable path. Defaults to PLAYWRIGHT_BROWSER, then bundled Chromium.")
    parser.add_argument("--items", default=str(ROOT / "app/public/items.json"), help="Path to xiv-market app/public/items.json.")
    parser.add_argument("--debug", action="store_true", help="Print renderer progress to stderr.")
    return parser.parse_args()


def debug(enabled: bool, message: str) -> None:
    if enabled:
        print(f"[render:item] {message}", file=sys.stderr, flush=True)


def load_items(path: Path) -> dict[str, dict[str, object]]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def resolve_item_id(raw: str, items_path: Path) -> str:
    item = raw.strip()
    if item.isdigit():
        return item

    items = load_items(items_path)
    normalized = normalize_item_name(item)
    exact = [(item_id, info) for item_id, info in items.items() if normalize_item_name(str(info.get("name", ""))) == normalized]
    if exact:
        return exact[0][0]

    partial = [(item_id, info) for item_id, info in items.items() if normalized in normalize_item_name(str(info.get("name", "")))]
    if len(partial) == 1:
        return partial[0][0]
    if len(partial) > 1:
        choices = ", ".join(f"{info.get('name')} (#{item_id})" for item_id, info in partial[:12])
        raise SystemExit(f'Ambiguous item name "{raw}". Matches: {choices}')

    suggestions = suggest_items(item, items, 5)
    if suggestions:
        choices = ", ".join(f"{info.get('name')} (#{item_id})" for item_id, info in suggestions)
        raise SystemExit(f'Item not found: "{raw}". Possible matches: {choices}')

    raise SystemExit(f'Item not found: "{raw}"')


def normalize_item_name(value: str) -> str:
    ignored = set(" \t\n\r·-_　「」《》（）():：")
    return "".join(ch.lower() for ch in value.strip() if ch not in ignored)


def suggest_items(
    raw: str,
    items: dict[str, dict[str, object]],
    limit: int,
) -> list[tuple[str, dict[str, object]]]:
    normalized_query = normalize_item_name(raw)
    if not normalized_query:
        return []

    scored: list[tuple[float, str, dict[str, object]]] = []
    for item_id, info in items.items():
        name = str(info.get("name", ""))
        score = item_similarity(normalized_query, normalize_item_name(name))
        if score >= 0.35:
            scored.append((score, item_id, info))
    scored.sort(key=lambda item: (item[0], -len(str(item[2].get("name", "")))), reverse=True)
    return [(item_id, info) for _, item_id, info in scored[:limit]]


def item_similarity(query: str, name: str) -> float:
    if not query or not name:
        return 0.0
    if query == name:
        return 1.0
    if query in name:
        return min(0.98, 0.72 + 0.25 * len(query) / max(len(name), 1))

    sequence = SequenceMatcher(None, query, name).ratio()
    lcs = lcs_ratio(query, name)
    query_bigrams = char_ngrams(query, 2)
    name_bigrams = char_ngrams(name, 2)
    overlap = len(query_bigrams & name_bigrams) / len(query_bigrams | name_bigrams) if query_bigrams and name_bigrams else 0.0
    score = sequence * 0.50 + lcs * 0.30 + overlap * 0.20

    query_tail = query[-1]
    if name.endswith(query_tail):
        score += 0.14
    elif query_tail in name:
        score += 0.06
    else:
        score -= 0.18

    missing_chars = sum(1 for ch in set(query) if ch not in name)
    score -= min(0.18, missing_chars * 0.04)
    return max(0.0, min(1.0, score))


def char_ngrams(value: str, size: int) -> set[str]:
    if len(value) < size:
        return {value} if value else set()
    return {value[index : index + size] for index in range(len(value) - size + 1)}


def lcs_ratio(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    previous = [0] * (len(right) + 1)
    for left_ch in left:
        current = [0]
        for index, right_ch in enumerate(right, start=1):
            if left_ch == right_ch:
                current.append(previous[index - 1] + 1)
            else:
                current.append(max(current[-1], previous[index]))
        previous = current
    return previous[-1] / max(len(left), len(right))


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


def build_render_url(base_url: str, item_id: str, scope: str) -> str:
    from urllib.parse import quote

    normalized_base = base_url if base_url.endswith("/") else f"{base_url}/"
    return f"{normalized_base}#/render/item/{quote(item_id)}?scope={quote(scope)}"


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
    item_id = resolve_item_id(args.item, Path(args.items))
    server: subprocess.Popen[bytes] | None = None

    try:
        if args.base_url:
            base_url = args.base_url
        else:
            server = start_server(args.port, args.debug)
            base_url = f"http://127.0.0.1:{args.port}/"
            wait_for_server(base_url, server)

        url = build_render_url(base_url, item_id, args.scope)
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
                debug(args.debug, f"opening {url}")
                page.goto(url, wait_until="domcontentloaded", timeout=60_000)
                root = page.locator('[data-render-root="item-report"]')
                debug(args.debug, "waiting for render root")
                root.wait_for(state="visible", timeout=30_000)
                debug(args.debug, "waiting for data-render-ready=true")
                page.wait_for_function(
                    """() => {
                      const el = document.querySelector('[data-render-root="item-report"]');
                      return el?.getAttribute('data-render-ready') === 'true';
                    }""",
                    timeout=60_000,
                )
                debug(args.debug, "render ready; waiting for chart paint")
                page.wait_for_timeout(750)
                debug(args.debug, f"writing {out_path}")
                root.screenshot(path=str(out_path), animations="disabled")
            finally:
                debug(args.debug, "closing browser")
                browser.close()

        return {"itemId": item_id, "scope": args.scope, "url": url, "out": str(out_path)}
    finally:
        if server is not None and not args.keep_server:
            stop_server(server, args.debug)


def main() -> None:
    result = render_report(parse_args())
    print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
