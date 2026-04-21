import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { listRuns, getBrands } from '../db/runs.ts';

export async function cmdExport(flags: Record<string, string | boolean>): Promise<void> {
  const date = typeof flags.date === 'string' ? flags.date : undefined;
  const out = typeof flags.out === 'string' ? flags.out : 'data/results.jsonl';
  const rows = listRuns({ date });
  const lines = rows.map((r) => {
    const brands = getBrands(r.id);
    return JSON.stringify({
      date: r.date,
      keyword: r.keyword,
      keyword_file: r.pack,
      platform: r.platform,
      brands: brands.map((b) => ({
        rank: b.rank,
        name: b.name,
        known: b.known,
        ...(b.matched_competitor ? { matched_competitor: b.matched_competitor } : {}),
      })),
      new_brands: JSON.parse(r.new_brands),
      total_brands: r.total_brands,
      response_text: r.response_text,
      timestamp: r.timestamp,
    });
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.length ? lines.join('\n') + '\n' : '');
  console.log(`wrote ${lines.length} records → ${out}`);
}
