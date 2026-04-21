#!/usr/bin/env bash
# SessionStart hook: prepend ./bin to PATH so bare `db-cli` / `ge-doubao-cli` resolve.
if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  printf 'export PATH="%s/bin:$PATH"\n' "$CLAUDE_PROJECT_DIR" >> "$CLAUDE_ENV_FILE"
fi
