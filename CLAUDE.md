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

The agent reads active queries from the DB, queries Doubao, extracts brands via the `brand-extractor` skill, and appends one row to `runs` + N rows to `brands` via `db-cli append`.

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
bin/db-cli                        — Node/TS CLI: queries + runs + brands + competitors (SQLite)
bin/ge-doubao-cli                 — bash+python3 CDP scraper for doubao.com
src/db/                           — schema, migrations, prepared-statement helpers
src/db-cli/                       — one file per subcommand
competitors.json                  — frozen seed; imported once into DB by scripts/init.sh
scripts/import-competitors.ts     — one-time importer: competitors.json → DB (idempotent)
data/geo_results.db               — gitignored; all state lives here
scripts/init.sh                   — one-time setup
.claude/settings.json             — SessionStart hook inlines ./bin PATH injection
```

## Adding / managing queries

**Bulk seed a new product line via TSV drop:**

1. Create `data/seeds/<pack-slug>.tsv` — the filename stem becomes the pack slug (e.g. `hospital-guide-robot.tsv` → `pack=hospital-guide-robot`).
2. Run `bash scripts/init.sh`. The script auto-discovers all `*.tsv` files in `data/seeds/` and seeds them idempotently.

TSV format: one query per line, optionally prefixed with a rank and tab (`<rank>\t<query>`). Lines starting with `#` are comments. See `data/seeds/TEMPLATE.tsv.example` for a full example.

**Single-row edits after initial seed:**

```bash
db-cli queries list
db-cli queries add --query "展厅机器人都有哪些品牌" --pack exhibition-hall-robot
db-cli queries deactivate 3    # soft-delete; history preserved
db-cli queries activate 3
```

`pack` is a free-form category slug (e.g. `reception-robot`, `exhibition-hall-robot`, `hospital-guide-robot`). Use the same `pack` for related queries so you can filter by it later.

The `reception-robot` pack (176 queries spanning 展厅 and 前台 scenarios) is auto-seeded from `data/seeds/reception-robot.tsv` via the TSV-drop mechanism above. Re-running is a no-op.

## Freshness & work queue

The collector uses a 7-day rolling freshness window: a query is "due" when its most recent run is older than 7 days (or it has never run). Handout is atomic — `db-cli next` claims a query for 60 minutes so concurrent runs don't double-process. Crash-recovery is built in: an expired claim is automatically re-eligible.

```bash
db-cli next --pack reception-robot --limit 1 --json       # hand out one due query (claim)
db-cli next --pack reception-robot --limit 5 --compact    # tsv: id\tquery\tpack\tage_days
db-cli next --pack reception-robot --limit 5 --no-claim   # peek without claiming
db-cli has-recent --query "..." --days 7 --json           # inspect staleness without claiming
db-cli release <id>                                       # manually clear a stuck claim
```

`db-cli next` always exits 0. An empty output/array means nothing is due.

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
db-cli candidates show "新品牌"                      # details + every query/date/rank it appeared
db-cli candidates accept "新品牌" --model "X1" --aliases "alias1,alias2"
db-cli candidates reject "新品牌" --reason "宣传物料"
db-cli candidates list --status accepted             # all accepted
db-cli candidates list --pack hospital-guide-robot   # filter by pack
```

After `accept`, the brand is in `competitors` with `source='candidate-accept'` and future collector runs will classify it as `known=1`.

## Schema

`data/geo_results.db` — SQLite, six tables:

- **`queries`** — `id, query, pack, active, created_at, claimed_at`. `UNIQUE(query, pack)`. `claimed_at` is set by `db-cli next` for 60-min atomic handoff.
- **`runs`** — `id, date, query, pack, platform, response_text, timestamp, total_brands, new_brands, raw_html, url, links, related_queries`. `UNIQUE(date, query, platform)` enforces idempotency. `raw_html` + `url` are captured by the scraper; `links` and `related_queries` are populated by a later offline parser.
- **`brands`** — `run_id, rank, name, known, matched_competitor`. Cascades on run delete.
- **`competitors`** — `name, aliases, added_at, source`. `aliases` is a JSON array of brand-level alternate names (e.g. English names). Source is `seed` | `candidate-accept` | `manual`.
- **`competitor_models`** — `competitor_name, name, aliases` (JSON array). Cascades on competitor delete.
- **`brand_candidates`** — `name, first_seen, last_seen, sighting_count, reviewed, decision, accepted_at, notes`. Auto-populated when `appendRun` inserts `known=0` brands. `decision` is `NULL` | `'accepted'` | `'rejected'`.

## competitors.json

Frozen seed file. Imported once into the DB by `scripts/init.sh` via `scripts/import-competitors.ts`. Do **not** use it at runtime — `db-cli competitors list --json` is now the authoritative source. The file is kept in the repo for git-visible provenance of the initial catalog.
