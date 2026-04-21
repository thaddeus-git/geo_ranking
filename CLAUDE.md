# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## First-time setup

```bash
bash scripts/init.sh
```

Installs Node deps, creates `data/geo_results.db`, imports any legacy `keywords/*.txt` into the DB, and verifies Chrome CDP / python prerequisites.

## How to Run

```bash
claude --agent geo-collector
```

The agent reads active keywords from the DB, queries Doubao, extracts brands via the `brand-extractor` skill, and appends one row to `runs` + N rows to `brands` via `db-cli append`.

## Prerequisites

- **Chrome with CDP:**
  ```bash
  open -a "Google Chrome" --args --remote-debugging-port=9222
  ```
  Then log into doubao.com in that window.
- **Node 18+** and `npm install` complete (handled by `scripts/init.sh`).
- **python3 + websockets:** `pip3 install websockets` (used by `bin/ge-doubao-cli`).
- **Configuration:** Copy `.env.example` to `.env` if you want to override defaults. `CDP_PORT` defaults to `9222`. `GEO_DB_PATH` defaults to `data/geo_results.db`.

## Architecture

```
.claude/agents/geo-collector.md   — orchestrator loop
.claude/skills/brand-extractor/   — LLM brand extraction + new-entrant detection
bin/db-cli                        — Node/TS CLI: keywords + runs + brands (SQLite)
bin/ge-doubao-cli                 — bash+python3 CDP scraper for doubao.com
src/db/                           — schema, migrations, prepared-statement helpers
src/db-cli/                       — one file per subcommand
competitors.json                  — human-curated catalog of known robot brands
data/geo_results.db               — gitignored; all state lives here
scripts/init.sh                   — one-time setup
.claude/hooks/prepend-bin-path.sh — SessionStart: adds ./bin to PATH
```

## Adding / managing keywords

Keywords live in the `keywords` table, not files.

```bash
db-cli keywords list
db-cli keywords add --keyword "展厅机器人都有哪些品牌" --pack exhibition-hall-robot
db-cli keywords deactivate 3    # soft-delete; history preserved
db-cli keywords activate 3
```

`pack` is a free-form category slug (e.g. `exhibition-hall-robot`, `hospital-guide-robot`). Use the same `pack` for related keywords so you can filter by it later.

## Running queries

```bash
db-cli status                             # overall counts
db-cli today                              # today's runs (tsv)
db-cli today --json                       # today's runs with full brand arrays
db-cli list --pack hospital-guide-robot
db-cli brand-history "猎户星空"           # every time this brand appeared
```

## Analysis with jq

`db-cli export` dumps runs to JSONL with the legacy schema (`pack` → `keyword_file`). The jq examples work unchanged against the exported file.

```bash
db-cli export --out data/results.jsonl

# All records: date, keyword, brand count, new brands
jq -r '[.date, .keyword, (.total_brands|tostring), (.new_brands|join(","))] | @tsv' data/results.jsonl

# Ranked brands for a pack
jq -r 'select(.keyword_file=="exhibition-hall-robot") | [.date, (.brands[] | [(.rank|tostring), .name, (.known|tostring)] | join("\t"))] | @tsv' data/results.jsonl

# Today's rankings
jq -r 'select(.date == (now | strftime("%Y-%m-%d"))) | [.keyword_file, (.brands[] | .name)] | @tsv' data/results.jsonl
```

## Schema

`data/geo_results.db` — SQLite, three tables:

- **`keywords`** — `id, keyword, pack, active, created_at`. `UNIQUE(keyword, pack)`.
- **`runs`** — `id, date, keyword, pack, platform, response_text, timestamp, total_brands, new_brands`. `UNIQUE(date, keyword, platform)` enforces idempotency.
- **`brands`** — `run_id, rank, name, known, matched_competitor`. Cascades on run delete.

## competitors.json

Human-maintained catalog of known service robot brands:
```json
{ "品牌名": { "models": [{ "name": "...", "aliases": ["..."] }] } }
```

Do **not** modify it — it is maintained externally. The brand-extractor skill uses it to distinguish known vs. new competitors. Brands not in this file are surfaced in each run's `new_brands` field.
