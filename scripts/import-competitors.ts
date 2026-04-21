#!/usr/bin/env node
// One-time importer: reads competitors.json → upserts into competitors + competitor_models.
// Re-running is a no-op — INSERT OR IGNORE skips existing rows.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from '../src/db/migrate.ts';
import { insertCompetitor, insertCompetitorModel } from '../src/db/competitors.ts';
import { closeDb } from '../src/db/connection.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(__dirname, '..', 'competitors.json');

interface ModelEntry {
  name: string;
  aliases: string[];
}

interface CatalogEntry {
  aliases: string[];
  models: ModelEntry[];
}

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Record<string, CatalogEntry>;

migrate();

let insertedCompetitors = 0;
let insertedModels = 0;

for (const [brandName, { aliases, models }] of Object.entries(catalog)) {
  if (insertCompetitor(brandName, 'seed', aliases)) insertedCompetitors++;
  for (const model of models) {
    if (insertCompetitorModel(brandName, model.name, model.aliases)) insertedModels++;
  }
}

if (insertedCompetitors > 0 || insertedModels > 0) {
  console.log(`import-competitors: inserted ${insertedCompetitors} brands, ${insertedModels} models`);
} else {
  console.log('import-competitors: catalog already populated (no-op)');
}

closeDb();
