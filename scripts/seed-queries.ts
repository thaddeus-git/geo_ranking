#!/usr/bin/env node
// Auto-discover query packs from data/seeds/*.tsv and seed the queries table.
// Re-running is a no-op: addQuery uses INSERT OR IGNORE on UNIQUE(query, pack).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from '../src/db/migrate.ts';
import { addQuery } from '../src/db/queries.ts';
import { closeDb } from '../src/db/connection.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedsDir = resolve(__dirname, '..', 'data', 'seeds');

if (!existsSync(seedsDir)) {
  console.log('seed-queries: data/seeds/ not found — nothing to seed');
  process.exit(0);
}

migrate();

const files = readdirSync(seedsDir)
  .filter(f => f.endsWith('.tsv') && !f.endsWith('.example'))
  .sort();

if (files.length === 0) {
  console.log('seed-queries: no *.tsv files found in data/seeds/');
  closeDb();
  process.exit(0);
}

let totalInserted = 0;
let totalPresent = 0;

for (const file of files) {
  const pack = basename(file, '.tsv');
  const content = readFileSync(resolve(seedsDir, file), 'utf8');
  let inserted = 0;
  let present = 0;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const tabIdx = trimmed.indexOf('\t');
    const query = (tabIdx === -1 ? trimmed : trimmed.slice(tabIdx + 1)).trim();
    if (!query) continue;
    const result = addQuery(query, pack);
    if (result.inserted) inserted++; else present++;
  }

  console.log(`  ${pack}: inserted ${inserted}, already present ${present}`);
  totalInserted += inserted;
  totalPresent += present;
}

console.log(
  `seed-queries: total inserted ${totalInserted}, already present ${totalPresent} (${files.length} pack${files.length === 1 ? '' : 's'})`
);
closeDb();
