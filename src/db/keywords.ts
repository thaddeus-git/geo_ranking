import { getDb } from './connection.ts';

export interface Keyword {
  id: number;
  keyword: string;
  pack: string;
  active: number;
  created_at: string;
}

export function listKeywords(opts: { includeInactive?: boolean; pack?: string } = {}): Keyword[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!opts.includeInactive) where.push('active = 1');
  if (opts.pack) { where.push('pack = ?'); params.push(opts.pack); }
  const sql =
    'SELECT id, keyword, pack, active, created_at FROM keywords' +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ' ORDER BY pack, id';
  return getDb().prepare(sql).all(...params) as Keyword[];
}

export function addKeyword(keyword: string, pack: string): { inserted: boolean; id: number | null } {
  const db = getDb();
  const info = db.prepare('INSERT OR IGNORE INTO keywords (keyword, pack) VALUES (?, ?)').run(keyword, pack);
  if (info.changes > 0) return { inserted: true, id: Number(info.lastInsertRowid) };
  const existing = db.prepare('SELECT id FROM keywords WHERE keyword = ? AND pack = ?').get(keyword, pack) as { id: number } | undefined;
  return { inserted: false, id: existing ? existing.id : null };
}

export function setActive(id: number, active: boolean): boolean {
  const info = getDb()
    .prepare('UPDATE keywords SET active = ? WHERE id = ?')
    .run(active ? 1 : 0, id);
  return info.changes > 0;
}
