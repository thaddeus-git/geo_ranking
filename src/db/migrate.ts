import { getDb } from './connection.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS queries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  query       TEXT    NOT NULL,
  pack        TEXT    NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(query, pack)
);
CREATE INDEX IF NOT EXISTS idx_queries_active_pack ON queries(active, pack);

CREATE TABLE IF NOT EXISTS runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT    NOT NULL,
  query         TEXT    NOT NULL,
  pack          TEXT    NOT NULL,
  platform      TEXT    NOT NULL DEFAULT 'doubao',
  response_text TEXT    NOT NULL,
  timestamp     TEXT    NOT NULL,
  total_brands  INTEGER NOT NULL,
  new_brands    TEXT    NOT NULL DEFAULT '[]',
  UNIQUE(date, query, platform)
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
  aliases   TEXT NOT NULL DEFAULT '[]',
  added_at  TEXT NOT NULL DEFAULT (datetime('now')),
  source    TEXT NOT NULL DEFAULT 'seed'
);

CREATE TABLE IF NOT EXISTS competitor_models (
  competitor_name TEXT NOT NULL REFERENCES competitors(name) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  aliases         TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (competitor_name, name)
);

CREATE TABLE IF NOT EXISTS brand_candidates (
  name           TEXT PRIMARY KEY,
  first_seen     TEXT NOT NULL,
  last_seen      TEXT NOT NULL,
  sighting_count INTEGER NOT NULL DEFAULT 1,
  reviewed       INTEGER NOT NULL DEFAULT 0,
  decision       TEXT,
  accepted_at    TEXT,
  notes          TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_brand_candidates_pending ON brand_candidates(reviewed, last_seen);
`;

export function migrate(): void {
  getDb().exec(SCHEMA);
  // Safe column addition for DBs created before this column existed.
  try {
    getDb().exec("ALTER TABLE competitors ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]'");
  } catch {
    // Column already exists — no-op.
  }
  // Rename keyword→query in keywords table (must happen before table rename).
  try {
    getDb().exec('ALTER TABLE keywords RENAME COLUMN keyword TO query');
  } catch {
    // Already renamed — no-op.
  }
  // Rename keywords table → queries.
  try {
    getDb().exec('ALTER TABLE keywords RENAME TO queries');
  } catch {
    // Already renamed — no-op.
  }
  // Rename keyword column in runs table.
  try {
    getDb().exec('ALTER TABLE runs RENAME COLUMN keyword TO query');
  } catch {
    // Already renamed — no-op.
  }
}
