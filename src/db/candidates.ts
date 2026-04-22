import { getDb } from './connection.ts';
import { insertCompetitor, insertCompetitorModel } from './competitors.ts';

export interface BrandCandidate {
  name: string;
  first_seen: string;
  last_seen: string;
  sighting_count: number;
  reviewed: number;
  decision: string | null;
  accepted_at: string | null;
  notes: string;
}

export interface CandidateSource {
  date: string;
  query: string;
  pack: string;
  rank: number;
}

// Called from within appendRun's transaction — no inner tx needed.
export function upsertCandidate(name: string, date: string): void {
  getDb()
    .prepare(
      `INSERT INTO brand_candidates (name, first_seen, last_seen, sighting_count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(name) DO UPDATE SET
         last_seen      = CASE WHEN reviewed = 0 AND last_seen < excluded.last_seen THEN excluded.last_seen ELSE last_seen END,
         sighting_count = CASE WHEN reviewed = 0 THEN sighting_count + 1 ELSE sighting_count END`,
    )
    .run(name, date, date);
}

export function listCandidates(opts: {
  status?: string;
  pack?: string;
} = {}): BrandCandidate[] {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.status === 'pending') {
    where.push('bc.reviewed = 0');
  } else if (opts.status === 'accepted') {
    where.push("bc.decision = 'accepted'");
  } else if (opts.status === 'rejected') {
    where.push("bc.decision = 'rejected'");
  } else if (opts.status === 'reviewed') {
    where.push('bc.reviewed = 1');
  }

  if (opts.pack) {
    where.push(`bc.name IN (
      SELECT DISTINCT b.name FROM brands b JOIN runs r ON r.id = b.run_id WHERE r.pack = ?
    )`);
    params.push(opts.pack);
  }

  const sql =
    `SELECT bc.name, bc.first_seen, bc.last_seen, bc.sighting_count,
            bc.reviewed, bc.decision, bc.accepted_at, bc.notes
     FROM brand_candidates bc` +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ' ORDER BY bc.last_seen DESC, bc.sighting_count DESC';
  return db.prepare(sql).all(...params) as BrandCandidate[];
}

export function getCandidate(name: string): BrandCandidate | undefined {
  return getDb()
    .prepare('SELECT * FROM brand_candidates WHERE name = ?')
    .get(name) as BrandCandidate | undefined;
}

export function sourcesForCandidate(name: string): CandidateSource[] {
  return getDb()
    .prepare(
      `SELECT r.date, r.query, r.pack, b.rank
       FROM brands b JOIN runs r ON r.id = b.run_id
       WHERE b.name = ?
       ORDER BY r.date DESC, b.rank`,
    )
    .all(name) as CandidateSource[];
}

export function acceptCandidate(
  name: string,
  models: Array<{ name: string; aliases: string[] }>,
): { competitorInserted: boolean } {
  const db = getDb();
  let competitorInserted = false;
  const tx = db.transaction(() => {
    competitorInserted = insertCompetitor(name, 'candidate-accept');
    for (const m of models) {
      insertCompetitorModel(name, m.name, m.aliases);
    }
    db.prepare(
      `UPDATE brand_candidates
       SET reviewed = 1, decision = 'accepted', accepted_at = datetime('now')
       WHERE name = ?`,
    ).run(name);
  });
  tx();
  return { competitorInserted };
}

export function rejectCandidate(name: string, reason: string): void {
  getDb()
    .prepare(
      `UPDATE brand_candidates
       SET reviewed = 1, decision = 'rejected', notes = ?
       WHERE name = ?`,
    )
    .run(reason, name);
}
