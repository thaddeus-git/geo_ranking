#!/usr/bin/env bash
# scripts/init.sh — set up all prerequisites for geo-ranking collection
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== geo-ranking init ==="

# 1. Python deps
echo ""
echo "[1/4] Checking python3..."
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found. Install it via 'brew install python3' or https://python.org" >&2
  exit 1
fi
echo "      python3: $(python3 --version)"

echo "[2/4] Installing python3 package: websockets..."
if python3 -c "import websockets" 2>/dev/null; then
  echo "      websockets: already installed"
else
  pip3 install websockets
  echo "      websockets: installed"
fi

# 2. Executable bit on the CLI
echo "[3/4] Making bin/ge-doubao-cli executable..."
chmod +x "$ROOT/bin/ge-doubao-cli"
echo "      done"

# 3. Create data dir
echo "[4/4] Creating data/ directory..."
mkdir -p "$ROOT/data"
echo "      done"

# 4. Summary / next steps
echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Launch Chrome with CDP:"
echo "     open -a 'Google Chrome' --args --remote-debugging-port=9222"
echo ""
echo "  2. In that Chrome window, log into https://www.doubao.com"
echo ""
echo "  3. Run the collector:"
echo "     claude --agent geo-collector"
