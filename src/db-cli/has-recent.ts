import { getDb } from '../db/connection.ts';

export async function cmdHasRecent(flags: Record<string, string | boolean>): Promise<void> {
  const q = flags.query;
  if (typeof q !== 'string' || !q) {
    console.error('has-recent requires --query "<text>"');
    process.exit(2);
  }
  const platform = typeof flags.platform === 'string' ? flags.platform : 'doubao';
  const days = typeof flags.days === 'string' ? Number(flags.days) : 7;
  if (!Number.isFinite(days) || days <= 0) {
    console.error('has-recent --days must be a positive number');
    process.exit(2);
  }

  const row = getDb()
    .prepare(
      `SELECT MAX(timestamp) AS last_run_at
         FROM runs
        WHERE query = ? AND platform = ?`,
    )
    .get(q, platform) as { last_run_at: string | null };

  const lastRunAt = row.last_run_at;
  let ageDays: number | null = null;
  let fresh = false;
  if (lastRunAt) {
    const ageMs = Date.now() - new Date(lastRunAt).getTime();
    ageDays = Math.floor(ageMs / 86_400_000);
    fresh = ageMs < days * 86_400_000;
  }

  if (flags.json) {
    process.stdout.write(JSON.stringify({ fresh, last_run_at: lastRunAt, age_days: ageDays }) + '\n');
  } else {
    process.stdout.write((fresh ? 'fresh' : 'stale') + '\n');
  }
}
