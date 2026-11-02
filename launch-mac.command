#!/bin/bash
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  exec python3 server.py
fi
if command -v python >/dev/null 2>&1; then
  exec python server.py
fi
echo "Python 3 is required to launch Gobbler Gauntlet."
echo "Install it from https://www.python.org/downloads/ and try again."
exit 1
