---
name: brand-extractor
description: Extracts brand mentions from a Doubao AI response, cross-references against a known competitors catalog, and flags new market entrants.
---

# Brand Extractor

Stateless LLM analysis. Receives a Doubao response and a competitors catalog. Extracts every brand mentioned, determines if each is a known competitor, and flags new entrants.

## Input

The caller passes all three fields in the invocation context:

- `query` — the prompt string sent to Doubao
- `response_text` — full Doubao AI response text
- `competitors_catalog` — JSON output of `db-cli competitors list --json` (same shape as the former competitors.json)

## Process

1. **Build lookup set** from `competitors_catalog`:
   - All top-level brand keys (e.g., `穿山甲机器人`, `优必选科技`)
   - All top-level `aliases` values on each brand (e.g., `OrionStar` for `猎户星空`)
   - All model `name` values under each brand
   - All `aliases` strings under each model
   - Store as a flat set for O(1) fuzzy lookup

2. **Extract brands** from `response_text` in order of appearance. Handle all formats Doubao uses:
   - Numbered lists: `1. **品牌名**`, `1、品牌名`, `一、品牌名`
   - Bold markdown: `**品牌名**`
   - Section headers followed by `代表产品：` / `核心优势：` / `主要产品：` on the next line
   - Plain names with parenthetical English: `猎户星空 (OrionStar)` → extract `猎户星空`
   - Deduplicate (keep first occurrence rank)

3. **Match each brand** against the lookup set using fuzzy logic:
   - Exact match on any lookup entry
   - Short form match: `猎户星空` matches `猎户星空 (OrionStar)`
   - Spacing/punctuation normalization
   - When matched: record which top-level brand key it belongs to as `matched_competitor`

4. **Flag new entrants**: any brand with no match in the lookup → `known: false`

## Output

Return exactly one fenced JSON block (nothing else — no prose, no tables, no extra commentary). The caller extracts the content between the fences and pipes it straight to `db-cli append`.

````
```json
{
  "brands": [
    {"rank": 1, "name": "<brand>", "known": true, "matched_competitor": "<top-level key from competitors.json>"},
    {"rank": 2, "name": "<brand>", "known": false}
  ],
  "new_brands": ["<name1>", "<name2>"],
  "total_brands": 2
}
```
````

Rules:
- `name` is the brand as it appeared in the response (strip parenthetical English if present)
- `matched_competitor` is only present when `known: true`
- `new_brands` is a flat list of names where `known: false`
- `total_brands` equals `brands.length`
- If no brands found: `{"brands": [], "new_brands": [], "total_brands": 0}`
