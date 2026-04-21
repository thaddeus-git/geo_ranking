import { getDb } from './connection.ts';

export interface Competitor {
  name: string;
  aliases: string; // stored as JSON array string
  added_at: string;
  source: string;
}

export interface CompetitorModel {
  competitor_name: string;
  name: string;
  aliases: string; // stored as JSON array string
}

export function listCompetitors(): Competitor[] {
  return getDb()
    .prepare('SELECT name, aliases, added_at, source FROM competitors ORDER BY name')
    .all() as Competitor[];
}

export function getCompetitor(name: string): { competitor: Competitor | undefined; models: CompetitorModel[] } {
  const db = getDb();
  const competitor = db
    .prepare('SELECT name, aliases, added_at, source FROM competitors WHERE name = ?')
    .get(name) as Competitor | undefined;
  const models = competitor
    ? (db
        .prepare('SELECT competitor_name, name, aliases FROM competitor_models WHERE competitor_name = ? ORDER BY name')
        .all(name) as CompetitorModel[])
    : [];
  return { competitor, models };
}

export function insertCompetitor(
  name: string,
  source: 'seed' | 'candidate-accept' | 'manual' = 'manual',
  aliases: string[] = [],
): boolean {
  const info = getDb()
    .prepare('INSERT OR IGNORE INTO competitors (name, source, aliases) VALUES (?, ?, ?)')
    .run(name, source, JSON.stringify(aliases));
  return info.changes > 0;
}

export function setCompetitorAliases(name: string, aliases: string[]): boolean {
  const info = getDb()
    .prepare('UPDATE competitors SET aliases = ? WHERE name = ?')
    .run(JSON.stringify(aliases), name);
  return info.changes > 0;
}

export function insertCompetitorModel(competitorName: string, modelName: string, aliases: string[] = []): boolean {
  const info = getDb()
    .prepare('INSERT OR IGNORE INTO competitor_models (competitor_name, name, aliases) VALUES (?, ?, ?)')
    .run(competitorName, modelName, JSON.stringify(aliases));
  return info.changes > 0;
}

// Emits the same object shape as competitors.json for contract compatibility with brand-extractor.
export function listCompetitorsCatalog(): Record<string, { aliases: string[]; models: Array<{ name: string; aliases: string[] }> }> {
  const db = getDb();
  const competitors = listCompetitors();
  const result: Record<string, { aliases: string[]; models: Array<{ name: string; aliases: string[] }> }> = {};
  for (const c of competitors) {
    const models = db
      .prepare('SELECT name, aliases FROM competitor_models WHERE competitor_name = ? ORDER BY name')
      .all(c.name) as Array<{ name: string; aliases: string }>;
    result[c.name] = {
      aliases: JSON.parse(c.aliases) as string[],
      models: models.map((m) => ({ name: m.name, aliases: JSON.parse(m.aliases) as string[] })),
    };
  }
  return result;
}
