# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## How to Run

```bash
claude --agent geo-collector
```

The agent loops over all keyword files, queries Doubao, extracts brands, and appends results to `data/results.jsonl`.

## Prerequisites

- **Chrome with CDP:**
  ```bash
  open -a "Google Chrome" --args --remote-debugging-port=9222
  ```
  Then log into doubao.com in that browser window.
- **python3 + websockets:** `pip3 install websockets`
- **Configuration:** Copy `.env.example` to `.env` and adjust if needed. `CDP_PORT` defaults to `9222`.

## Architecture

```
.claude/agents/geo-collector.md     — orchestrator loop
.claude/skills/brand-extractor/     — LLM brand extraction + new entrant detection
keywords/*.txt                      — one prompt per line; # lines are comments
bin/ge-doubao-cli                   — bash+Python3 CDP scraper for doubao.com
competitors.json                    — human-curated catalog of known robot brands
data/results.jsonl                  — gitignored output; one JSON record per keyword per day
```

## Adding Keywords

Add a line to any `keywords/*.txt` file, or create a new `.txt` file. The next run picks it up automatically. Lines starting with `#` are treated as comments.

## Data Format

`data/results.jsonl` — one JSON record per line, one record per keyword per collection day.

| Field | Type | Description |
|---|---|---|
| `date` | string | YYYY-MM-DD of collection |
| `keyword` | string | Full prompt sent to Doubao |
| `keyword_file` | string | Stem of the source .txt file (e.g., `exhibition-hall-robot`) |
| `platform` | string | `"doubao"` |
| `brands` | object[] | Ordered brand list — see below |
| `brands[].rank` | number | Position in response (1-based) |
| `brands[].name` | string | Brand name as extracted from response |
| `brands[].known` | boolean | Whether it matches a known competitor |
| `brands[].matched_competitor` | string | Key from competitors.json (only when `known: true`) |
| `new_brands` | string[] | Names of brands not in competitors.json — new entrants |
| `total_brands` | number | Length of brands array |
| `response_text` | string | Full Doubao AI response |
| `timestamp` | string | ISO 8601 from ge-doubao-cli |

## Analysis with jq

```bash
# Show all records: date, keyword, brand count, new brands
jq -r '[.date, .keyword, (.total_brands|tostring), (.new_brands|join(","))] | @tsv' data/results.jsonl

# Show ranked brands for a specific keyword file
jq -r 'select(.keyword_file=="exhibition-hall-robot") | [.date, (.brands[] | [(.rank|tostring), .name, (.known|tostring)] | join("\t"))] | @tsv' data/results.jsonl

# Find all new entrants ever detected
jq -r 'select(.new_brands | length > 0) | [.date, .keyword_file, (.new_brands | join(", "))] | @tsv' data/results.jsonl

# Show today's rankings
jq -r 'select(.date == (now | strftime("%Y-%m-%d"))) | [.keyword_file, (.brands[] | .name)] | @tsv' data/results.jsonl
```

## competitors.json

Human-maintained catalog of known service robot brands. Structure:
```json
{ "品牌名": { "models": [{ "name": "...", "aliases": ["..."] }] } }
```

Do **not** modify it — it is maintained externally. The brand-extractor skill uses it to distinguish known vs. new competitors. New entrants (brands not in this file) are surfaced in `new_brands`.
