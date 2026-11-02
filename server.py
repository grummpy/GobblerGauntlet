#!/usr/bin/env python3
"""Serve Gobbler Gauntlet on 127.0.0.1 and open a browser.

The port comes from arcade.json (default 8814) and falls forward to the next
free port. Pass --no-browser to skip opening a window, which the smoke test does.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
FALLBACK_PORT = 8814


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **getattr(SimpleHTTPRequestHandler, "extensions_map", {}),
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".jpg": "image/jpeg",
        ".html": "text/html; charset=utf-8",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("[http]", fmt % args, flush=True)


def default_port():
    path = os.path.join(ROOT, "arcade.json")
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
        return int(data.get("port", FALLBACK_PORT))
    except (OSError, ValueError, json.JSONDecodeError, TypeError):
        return FALLBACK_PORT


def bind_server(start_port):
    for port in range(start_port, start_port + 30):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            return server, port
        except OSError:
            continue
    print(f"No free port from {start_port} through {start_port + 29}.", file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Serve Gobbler Gauntlet")
    parser.add_argument("--port", type=int, default=None, help="first port to try")
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser")
    args = parser.parse_args()

    os.chdir(ROOT)
    start = args.port if args.port is not None else default_port()
    server, port = bind_server(start)
    url = f"http://127.0.0.1:{port}/"
    print("Gobbler Gauntlet", flush=True)
    print(url, flush=True)
    print(f"PORT={port}", flush=True)
    if not args.no_browser:
        try:
            opened = webbrowser.open(url)
            if not opened:
                print(f"Could not open a browser. Open {url} yourself.", flush=True)
        except Exception as exc:
            print(f"Could not open a browser ({exc}). Open {url} yourself.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
