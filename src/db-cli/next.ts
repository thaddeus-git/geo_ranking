import { getDb } from '../db/connection.ts';

interface Candidate {
  id: number;
  query: string;
  pack: string;
  last_run_at: string | null;
  age_days: number | null; // null = never run
}

export async function cmdNext(flags: Record<string, string | boolean>): Promise<void> {
  const pack = typeof flags.pack === 'string' ? flags.pack : null;
  const days = typeof flags.days === 'string' ? Number(flags.days) : 7;
  const limit = typeof flags.limit === 'string' ? Number(flags.limit) : 1;
  const platform = typeof flags.platform === 'string' ? flags.platform : 'doubao';
  const claim = !flags['no-claim'];

  if (!Number.isFinite(days) || days <= 0) {
    console.error('next --days must be a positive number');
    process.exit(2);
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error('next --limit must be a positive number');
    process.exit(2);
  }

  const db = getDb();

  // Select candidates: active queries whose newest run is older than N days
  // (or that have never run), and whose claim has expired.
  const rows = db
    .prepare(
      `WITH last_run AS (
         SELECT query, pack, MAX(timestamp) AS last_run_at
           FROM runs
          WHERE platform = ?
          GROUP BY query, pack
       )
       SELECT q.id, q.query, q.pack, lr.last_run_at
         FROM queries q
         LEFT JOIN last_run lr ON lr.query = q.query AND lr.pack = q.pack
        WHERE q.active = 1
          AND (? IS NULL OR q.pack = ?)
          AND (lr.last_run_at IS NULL
               OR lr.last_run_at < datetime('now', '-' || ? || ' days'))
          AND (q.claimed_at IS NULL
               OR q.claimed_at < datetime('now', '-60 minutes'))
        ORDER BY (lr.last_run_at IS NULL) DESC,
                 lr.last_run_at ASC,
                 q.id ASC
        LIMIT ?`,
    )
    .all(platform, pack, pack, days, limit) as Array<{
      id: number; query: string; pack: string; last_run_at: string | null;
    }>;

  const claimStmt = db.prepare(
    `UPDATE queries
        SET claimed_at = datetime('now')
      WHERE id = ?
        AND (claimed_at IS NULL OR claimed_at < datetime('now', '-60 minutes'))`,
  );

  const accepted: Candidate[] = [];
  for (const r of rows) {
    if (claim) {
      const info = claimStmt.run(r.id);
      if (info.changes !== 1) continue; // race: another worker claimed it
    }
    const ageDays = r.last_run_at
      ? Math.floor((Date.now() - new Date(r.last_run_at).getTime()) / 86_400_000)
      : null;
    accepted.push({
      id: r.id,
      query: r.query,
      pack: r.pack,
      last_run_at: r.last_run_at,
      age_days: ageDays,
    });
  }

  if (flags.json) {
    process.stdout.write(JSON.stringify(accepted) + '\n');
    return;
  }
  if (flags['ids-only']) {
    for (const c of accepted) process.stdout.write(c.id + '\n');
    return;
  }
  // Default + --compact: tab-separated id, query, pack, age_days
  for (const c of accepted) {
    const age = c.age_days == null ? 'never' : String(c.age_days);
    process.stdout.write(`${c.id}\t${c.query}\t${c.pack}\t${age}\n`);
  }
}

export async function cmdRelease(positionals: string[]): Promise<void> {
  const id = Number(positionals[0]);
  if (!Number.isFinite(id) || id <= 0) {
    console.error('release requires a positive query id');
    process.exit(2);
  }
  const info = getDb()
    .prepare('UPDATE queries SET claimed_at = NULL WHERE id = ?')
    .run(id);
  process.stdout.write((info.changes === 1 ? 'released' : 'not_found') + '\n');
}
