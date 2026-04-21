import { getDb } from './connection.ts';

export interface BrandRow {
  rank: number;
  name: string;
  known: boolean;
  matched_competitor?: string | null;
}

export interface RunRecord {
  date: string;
  keyword: string;
  pack: string;
  platform: string;
  response_text: string;
  timestamp: string;
  brands: BrandRow[];
  new_brands: string[];
}

export interface RunRow {
  id: number;
  date: string;
  keyword: string;
  pack: string;
  platform: string;
  response_text: string;
  timestamp: string;
  total_brands: number;
  new_brands: string;
}

export function hasRunToday(keyword: string, platform = 'doubao'): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const row = getDb()
    .prepare('SELECT 1 FROM runs WHERE date = ? AND keyword = ? AND platform = ? LIMIT 1')
    .get(today, keyword, platform);
  return row !== undefined;
}

export function appendRun(rec: RunRecord): number {
  const db = getDb();
  const insert = db.transaction((r: RunRecord) => {
    const info = db
      .prepare(
        `INSERT INTO runs (date, keyword, pack, platform, response_text, timestamp, total_brands, new_brands)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        r.date,
        r.keyword,
        r.pack,
        r.platform,
        r.response_text,
        r.timestamp,
        r.brands.length,
        JSON.stringify(r.new_brands),
      );
    const runId = Number(info.lastInsertRowid);
    const stmt = db.prepare(
      `INSERT INTO brands (run_id, rank, name, known, matched_competitor)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const b of r.brands) {
      stmt.run(runId, b.rank, b.name, b.known ? 1 : 0, b.matched_competitor ?? null);
    }
    return runId;
  });
  return insert(rec);
}

export function listRuns(opts: { date?: string; pack?: string } = {}): RunRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.date) { where.push('date = ?'); params.push(opts.date); }
  if (opts.pack) { where.push('pack = ?'); params.push(opts.pack); }
  const sql =
    `SELECT id, date, keyword, pack, platform, response_text, timestamp, total_brands, new_brands
     FROM runs` +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ' ORDER BY date DESC, id DESC';
  return getDb().prepare(sql).all(...params) as RunRow[];
}

export function getBrands(runId: number): BrandRow[] {
  const rows = getDb()
    .prepare('SELECT rank, name, known, matched_competitor FROM brands WHERE run_id = ? ORDER BY rank')
    .all(runId) as Array<{ rank: number; name: string; known: number; matched_competitor: string | null }>;
  return rows.map((r) => ({
    rank: r.rank,
    name: r.name,
    known: r.known === 1,
    ...(r.matched_competitor ? { matched_competitor: r.matched_competitor } : {}),
  }));
}

export function brandHistory(name: string): Array<{ date: string; keyword: string; pack: string; rank: number }> {
  return getDb()
    .prepare(
      `SELECT r.date, r.keyword, r.pack, b.rank
       FROM brands b JOIN runs r ON r.id = b.run_id
       WHERE b.name = ?
       ORDER BY r.date DESC, b.rank`,
    )
    .all(name) as Array<{ date: string; keyword: string; pack: string; rank: number }>;
}

export function counts(): { runs: number; today: number; keywords: number; brands: number } {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const total = db.prepare('SELECT COUNT(*) AS n FROM runs').get() as { n: number };
  const todayN = db.prepare('SELECT COUNT(*) AS n FROM runs WHERE date = ?').get(today) as { n: number };
  const kw = db.prepare('SELECT COUNT(DISTINCT keyword) AS n FROM runs').get() as { n: number };
  const br = db.prepare('SELECT COUNT(DISTINCT name) AS n FROM brands').get() as { n: number };
  return { runs: total.n, today: todayN.n, keywords: kw.n, brands: br.n };
}
