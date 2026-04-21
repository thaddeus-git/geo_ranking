import Database, { type Database as Db } from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

let cached: Db | null = null;

function dbPath(): string {
  const p = process.env.GEO_DB_PATH?.trim();
  return resolve(p && p.length > 0 ? p : 'data/geo_results.db');
}

export function getDb(): Db {
  if (cached) return cached;
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  cached = db;
  return db;
}

export function closeDb(): void {
  if (cached) {
    cached.close();
    cached = null;
  }
}
