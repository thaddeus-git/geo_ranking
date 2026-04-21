import { listRuns, getBrands } from '../db/runs.ts';

export async function cmdList(flags: Record<string, string | boolean>): Promise<void> {
  const date = typeof flags.date === 'string' ? flags.date : undefined;
  const pack = typeof flags.pack === 'string' ? flags.pack : undefined;
  const rows = listRuns({ date, pack });

  if (flags.json) {
    const out = rows.map((r) => ({
      id: r.id,
      date: r.date,
      keyword: r.keyword,
      pack: r.pack,
      platform: r.platform,
      timestamp: r.timestamp,
      total_brands: r.total_brands,
      new_brands: JSON.parse(r.new_brands),
      brands: getBrands(r.id),
    }));
    console.log(JSON.stringify(out));
    return;
  }
  for (const r of rows) {
    console.log(`${r.date}\t${r.pack}\t${r.total_brands}\t${r.keyword}`);
  }
}
