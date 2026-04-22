import { getDb } from './connection.ts';

export interface Query {
  id: number;
  query: string;
  pack: string;
  active: number;
  created_at: string;
}

export function listQueries(opts: { includeInactive?: boolean; pack?: string } = {}): Query[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!opts.includeInactive) where.push('active = 1');
  if (opts.pack) { where.push('pack = ?'); params.push(opts.pack); }
  const sql =
    'SELECT id, query, pack, active, created_at FROM queries' +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ' ORDER BY pack, id';
  return getDb().prepare(sql).all(...params) as Query[];
}

export function addQuery(query: string, pack: string): { inserted: boolean; id: number | null } {
  const db = getDb();
  const info = db.prepare('INSERT OR IGNORE INTO queries (query, pack) VALUES (?, ?)').run(query, pack);
  if (info.changes > 0) return { inserted: true, id: Number(info.lastInsertRowid) };
  const existing = db.prepare('SELECT id FROM queries WHERE query = ? AND pack = ?').get(query, pack) as { id: number } | undefined;
  return { inserted: false, id: existing ? existing.id : null };
}

export function setActive(id: number, active: boolean): boolean {
  const info = getDb()
    .prepare('UPDATE queries SET active = ? WHERE id = ?')
    .run(active ? 1 : 0, id);
  return info.changes > 0;
}
