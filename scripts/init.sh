#!/usr/bin/env bash
# One-time setup for geo_ranking. Run from repo root:  bash scripts/init.sh
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }

echo ""
echo "geo_ranking setup"
echo "================="

# 1. Node version
echo ""
echo "1. Node.js"
if ! command -v node &>/dev/null; then
  fail "node not found — install Node 18+ from https://nodejs.org"; exit 1
fi
NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node $NODE_MAJOR — Node 18+ required"; exit 1
fi
ok "node $(node --version)"

# 2. Dependencies
echo ""
echo "2. npm install"
if [ -f package-lock.json ]; then npm ci; else npm install; fi
ok "dependencies installed"

# 3. Verify bin/ wrappers are executable
echo ""
echo "3. bin/ wrappers"
for f in db-cli ge-doubao-cli; do
  if [ -x "./bin/$f" ]; then
    ok "$f"
  else
    if [ -f "./bin/$f" ]; then
      chmod +x "./bin/$f" && ok "$f (chmod +x)"
    else
      fail "bin/$f missing"
    fi
  fi
done

# 4. Database init
echo ""
echo "4. Database"
if ./bin/db-cli init >/dev/null 2>&1; then
  ok "data/geo_results.db ready"
else
  fail "db-cli init failed"; exit 1
fi

# 5. Keywords
echo ""
echo "5. Keywords"
ACTIVE=$(./bin/db-cli keywords list --json | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>console.log(JSON.parse(s).length))")
ok "active keywords in DB: $ACTIVE"

# 6. Chrome CDP reachability (doubao)
echo ""
echo "6. Chrome CDP on :9222"
if curl -sf "http://127.0.0.1:9222/json/version" >/dev/null 2>&1; then
  ok "Chrome CDP reachable"
else
  warn "Chrome CDP not reachable — start with:"
  echo "       open -a \"Google Chrome\" --args --remote-debugging-port=9222"
  echo "       then log into doubao.com in that window"
fi

# 7. python3 + websockets (ge-doubao-cli prereq)
echo ""
echo "7. python3 + websockets (for ge-doubao-cli)"
if command -v python3 &>/dev/null; then
  if python3 -c "import websockets" &>/dev/null; then
    ok "python3 + websockets"
  else
    warn "websockets not installed — run: pip3 install websockets"
  fi
else
  fail "python3 not found"
fi

echo ""
echo "================="
ok "Setup complete."
echo ""
echo "  Run the collector:  claude --agent geo-collector"
echo "  Add a keyword:      ./bin/db-cli keywords add --keyword \"...\" --pack <slug>"
echo "  Status:             ./bin/db-cli status"
echo ""
