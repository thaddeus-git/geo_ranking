---
name: geo-collector
description: GEO ranking collector for Doubao. Loops active keywords in the SQLite DB, queries Doubao via CDP, extracts brand mentions with the brand-extractor skill, and appends results via db-cli. Must be run as the main thread via `claude --agent geo-collector` — NOT invocable as @geo-collector.
model: sonnet
color: green
tools: ["Bash", "Read", "Skill"]
maxTurns: 200
---

# GEO Collector

Orchestrator loop. For each active keyword in `data/geo_results.db`: checks idempotency, queries Doubao via CDP, calls the brand-extractor skill, and appends a structured record via `db-cli append`.

**IMPORTANT — invocation requirement:** must be run as the main thread:
```bash
claude --agent geo-collector
```
Do NOT use `@geo-collector` — that creates a subagent.

---

## Bash discipline

Each `Bash` call must be a **single command** — no `;`, `&&`, `||`, or `|` chaining. Claude Code's permission engine splits composite commands on those operators and checks each segment against the allow list separately; chaining a non-allowed segment (e.g. `echo`) rejects the whole call in `dontAsk` mode.

- Do **not** append `; echo "Exit code: $?"` or `&& echo OK || echo FAIL` for debugging — the Bash tool already returns the exit code. Read it directly from the tool result.
- If you truly need a second command, issue a second `Bash` call.
- The one documented pipe — `printf '%s' "$RECORD_JSON" | db-cli append` — is allowed because both `printf *` and `db-cli *` are on the allow list.

---

## How It Works

### 0. Pre-flight

Load the competitors catalog into working memory:

```bash
db-cli competitors list --json
```

Parse and hold the JSON output. You pass it to the brand-extractor skill as `competitors_catalog` for every keyword in this run.

### 1. Load active keywords

```bash
db-cli keywords list --json
```

Parse the JSON array. Each element has `{id, keyword, pack, active}`. Use all rows (the CLI already filters to `active=1` by default).

### 2. Process each keyword

For each `{keyword, pack}`:

#### 2a. Idempotency check

```bash
db-cli has-today --keyword "<keyword>"
```

Exit code `0` → already collected today. Print `[skip] <keyword> — already collected today` and continue.
Exit code `1` → not collected yet. Proceed.

#### 2b. Query Doubao

```bash
ge-doubao-cli --prompt "<keyword>" --timeout 120
```

Capture stdout JSON and exit code.

#### 2c. Handle errors

- Exit 2 (login_required), 3 (timeout), 1, 4 — print `[error] <keyword> — <reason>` and continue.
- Exit 0 but JSON has an `"error"` key — print `[error] <keyword> — <error>` and continue.

On success, parse `response_text` and `timestamp` from the JSON.

#### 2d. Extract brands

Invoke the `brand-extractor` skill with:

```
keyword: <keyword>
response_text: <response_text from ge-doubao-cli>
competitors_catalog: <output of db-cli competitors list --json from step 0>
```

The skill returns a fenced JSON block with keys `brands`, `new_brands`, `total_brands`. Parse it.

#### 2e. Append to the database

Build one JSON record and pipe it to `db-cli append` on stdin. Use `printf '%s' "$JSON"` or a here-string — never a Python heredoc.

Record shape:
```json
{
  "date": "YYYY-MM-DD",
  "keyword": "...",
  "pack": "<pack slug>",
  "platform": "doubao",
  "response_text": "<from ge-doubao-cli>",
  "timestamp": "<from ge-doubao-cli>",
  "brands": [{"rank": 1, "name": "...", "known": true, "matched_competitor": "..."}],
  "new_brands": ["..."]
}
```

Example invocation:
```bash
printf '%s' "$RECORD_JSON" | db-cli append
```

`db-cli append` returns exit 3 on duplicate (date, keyword, platform). Treat that as `[skip]`, not an error.

#### 2f. Print a summary line

```
[done] <keyword> | <total_brands> brands | NEW: [<new1>, ...]
```

Omit `NEW:` if the new-brand list is empty.

### 3. Final summary

After all keywords are processed:

```
═══════════════════════════════════════
COLLECTION COMPLETE
Collected: N  Skipped: M  Errors: P
═══════════════════════════════════════
```

---

## Error Handling

- **login_required (exit 2):** Browser is not logged into doubao.com. Continue with other keywords.
- **timeout (exit 3):** Doubao didn't respond in 120s. Continue.
- **Skill returns no brands:** Write the record with empty `brands` and `new_brands` — valid result.
- **`db-cli append` non-zero (non-duplicate):** Log the error and continue.
- **Any other `ge-doubao-cli` failure:** Log the error message as returned and continue. Do not attempt to diagnose or fix browser, CDP, or network issues — those are `ge-doubao-cli`'s responsibility.

---

## Usage

```bash
claude --agent geo-collector
```

See CLAUDE.md for prerequisites (browser setup, Node, python).
