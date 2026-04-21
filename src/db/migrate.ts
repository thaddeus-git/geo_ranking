import { getDb } from './connection.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS keywords (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword     TEXT    NOT NULL,
  pack        TEXT    NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(keyword, pack)
);
CREATE INDEX IF NOT EXISTS idx_keywords_active_pack ON keywords(active, pack);

CREATE TABLE IF NOT EXISTS runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT    NOT NULL,
  keyword       TEXT    NOT NULL,
  pack          TEXT    NOT NULL,
  platform      TEXT    NOT NULL DEFAULT 'doubao',
  response_text TEXT    NOT NULL,
  timestamp     TEXT    NOT NULL,
  total_brands  INTEGER NOT NULL,
  new_brands    TEXT    NOT NULL DEFAULT '[]',
  UNIQUE(date, keyword, platform)
);
CREATE INDEX IF NOT EXISTS idx_runs_date ON runs(date);
CREATE INDEX IF NOT EXISTS idx_runs_pack ON runs(pack);

CREATE TABLE IF NOT EXISTS brands (
  run_id              INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  rank                INTEGER NOT NULL,
  name                TEXT    NOT NULL,
  known               INTEGER NOT NULL,
  matched_competitor  TEXT,
  PRIMARY KEY (run_id, rank)
);
CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);

CREATE TABLE IF NOT EXISTS competitors (
  name      TEXT PRIMARY KEY,
  added_at  TEXT NOT NULL DEFAULT (datetime('now')),
  source    TEXT NOT NULL DEFAULT 'seed'
);

CREATE TABLE IF NOT EXISTS competitor_models (
  competitor_name TEXT NOT NULL REFERENCES competitors(name) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  aliases         TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (competitor_name, name)
);
`;

export function migrate(): void {
  getDb().exec(SCHEMA);
}
