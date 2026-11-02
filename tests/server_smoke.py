#!/usr/bin/env python3
"""Smoke-test that server.py serves the game and falls forward off a busy port."""

import os
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def free_port():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def start_server(args):
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    return subprocess.Popen(
        [sys.executable, os.path.join(ROOT, "server.py"), *args],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
    )


def stop(proc):
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3)


def fetch(url, proc, timeout=5):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        if proc.poll() is not None:
            output = proc.stdout.read() if proc.stdout else ""
            raise SystemExit(f"server exited {proc.returncode}: {output}")
        try:
            with urllib.request.urlopen(url, timeout=0.5) as response:
                return response.status, response.read()
        except Exception as exc:
            last = exc
            time.sleep(0.05)
    raise SystemExit(f"timed out fetching {url}: {last}")


def read_port(proc, timeout=5):
    deadline = time.time() + timeout
    buffered = ""
    while time.time() < deadline:
        if proc.poll() is not None:
            raise SystemExit(f"server exited before announcing a port: {buffered}")
        line = proc.stdout.readline()
        if not line:
            time.sleep(0.02)
            continue
        buffered += line
        if line.startswith("PORT="):
            return int(line.strip().split("=", 1)[1]), buffered
    raise SystemExit(f"no PORT line in: {buffered}")


def main():
    port = free_port()
    proc = start_server(["--port", str(port), "--no-browser"])
    try:
        status, body = fetch(f"http://127.0.0.1:{port}/", proc)
        text = body.decode("utf-8", "replace")
        assert status == 200, status
        assert "Gobbler Gauntlet" in text
        assert "src/main.js" in text
        for path in ("/arcade.json", "/src/main.js", "/src/core/race.js", "/assets/cover.jpg", "/assets/icon.jpg"):
            code, data = fetch(f"http://127.0.0.1:{port}{path}", proc)
            assert code == 200, path
            assert len(data) > 50, path
        module_status, _ = fetch(f"http://127.0.0.1:{port}/src/main.js", proc)
        assert module_status == 200
    finally:
        stop(proc)

    holder = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    holder.bind(("127.0.0.1", 8814))
    holder.listen(1)
    fallback = start_server(["--no-browser"])
    try:
        chosen, banner = read_port(fallback)
        assert chosen != 8814, banner
        status, body = fetch(f"http://127.0.0.1:{chosen}/", fallback)
        assert status == 200
        assert b"Gobbler Gauntlet" in body
    finally:
        stop(fallback)
        holder.close()

    print("server smoke ok")


if __name__ == "__main__":
    main()
