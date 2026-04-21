# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## First-time setup

```bash
bash scripts/init.sh
```

Installs Node deps, creates `data/geo_results.db`, and verifies Chrome CDP / python prerequisites.

## How to Run

```bash
claude --agent geo-collector
```

The agent reads active keywords from the DB, queries Doubao, extracts brands via the `brand-extractor` skill, and appends one row to `runs` + N rows to `brands` via `db-cli append`.

## Prerequisites

- **Chrome or Edge with CDP:**
  ```bash
  open -a "Google Chrome" --args --remote-debugging-port=9222
  # or: open -a "Microsoft Edge" --args --remote-debugging-port=9222
  ```
  Then log into doubao.com in that window.
- **Node 18+** and `npm install` complete (handled by `scripts/init.sh`).
- **python3 + websockets:** `pip3 install websockets` (used by `bin/ge-doubao-cli`).
- **Configuration:** Copy `.env.example` to `.env` if you want to override defaults. `CDP_PORT` defaults to `9222`. `GEO_DB_PATH` defaults to `data/geo_results.db`.

## Architecture

```
.claude/agents/geo-collector.md   — orchestrator loop
.claude/skills/brand-extractor/   — LLM brand extraction + new-entrant detection
bin/db-cli                        — Node/TS CLI: keywords + runs + brands + competitors (SQLite)
bin/ge-doubao-cli                 — bash+python3 CDP scraper for doubao.com
src/db/                           — schema, migrations, prepared-statement helpers
src/db-cli/                       — one file per subcommand
competitors.json                  — frozen seed; imported once into DB by scripts/init.sh
scripts/import-competitors.ts     — one-time importer: competitors.json → DB (idempotent)
data/geo_results.db               — gitignored; all state lives here
scripts/init.sh                   — one-time setup
.claude/settings.json             — SessionStart hook inlines ./bin PATH injection
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

## Adding / managing competitors

The competitors catalog lives in the `competitors` and `competitor_models` tables (seeded from `competitors.json` on first `bash scripts/init.sh`).

```bash
db-cli competitors list               # tabular view
db-cli competitors list --json        # same JSON shape as the former competitors.json
db-cli competitors show "穿山甲机器人" # name, brand aliases, source, added_at, models
db-cli competitors add "新品牌"        # insert manually
db-cli competitors add-model "新品牌" --model "X1" --aliases "alias1,alias2"
db-cli competitors set-aliases "猎户星空" --aliases "OrionStar,orionstar"  # set/replace brand-level aliases
```

Brand aliases (e.g. English names like `OrionStar`) live **only in the DB** — they are not stored in `competitors.json`. Set them via `set-aliases` after `init.sh`.

## New brand review

Every unknown brand surfaced by the collector is automatically tracked in `brand_candidates`. Ops uses `db-cli candidates` to triage; accepted candidates move atomically into the `competitors` catalog.

```bash
db-cli candidates pending                            # unreviewed brands
db-cli candidates show "新品牌"                      # details + every keyword/date/rank it appeared
db-cli candidates accept "新品牌" --model "X1" --aliases "alias1,alias2"
db-cli candidates reject "新品牌" --reason "宣传物料"
db-cli candidates list --status accepted             # all accepted
db-cli candidates list --pack hospital-guide-robot   # filter by pack
```

After `accept`, the brand is in `competitors` with `source='candidate-accept'` and future collector runs will classify it as `known=1`.

## Schema

`data/geo_results.db` — SQLite, six tables:

- **`keywords`** — `id, keyword, pack, active, created_at`. `UNIQUE(keyword, pack)`.
- **`runs`** — `id, date, keyword, pack, platform, response_text, timestamp, total_brands, new_brands`. `UNIQUE(date, keyword, platform)` enforces idempotency.
- **`brands`** — `run_id, rank, name, known, matched_competitor`. Cascades on run delete.
- **`competitors`** — `name, aliases, added_at, source`. `aliases` is a JSON array of brand-level alternate names (e.g. English names). Source is `seed` | `candidate-accept` | `manual`.
- **`competitor_models`** — `competitor_name, name, aliases` (JSON array). Cascades on competitor delete.
- **`brand_candidates`** — `name, first_seen, last_seen, sighting_count, reviewed, decision, accepted_at, notes`. Auto-populated when `appendRun` inserts `known=0` brands. `decision` is `NULL` | `'accepted'` | `'rejected'`.

## competitors.json

Frozen seed file. Imported once into the DB by `scripts/init.sh` via `scripts/import-competitors.ts`. Do **not** use it at runtime — `db-cli competitors list --json` is now the authoritative source. The file is kept in the repo for git-visible provenance of the initial catalog.
